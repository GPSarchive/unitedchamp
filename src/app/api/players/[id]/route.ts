// app/api/players/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

/* ================
   Same-origin guard
   ================ */
function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  const whitelist = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
  try { whitelist.add(new URL(req.url).origin); } catch {}

  const origin  = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const ok = [origin, referer].some(v => {
    try { return !!v && whitelist.has(new URL(v).origin); } catch { return false; }
  });
  if (!ok) throw new Error("bad-origin");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,PATCH,DELETE,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,PATCH,DELETE,OPTIONS,HEAD" } });
}

/* -------------------------
   GET /api/players/:id (admin)
   ------------------------- */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;                 // ← await params
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) {
    return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
  }

  const supa = await createSupabaseRouteClient();

  // Admin auth (cookie session)
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Read via service role so RLS on child rows can't hide stats
  const { data, error } = await supabaseAdmin
    .from("player")
    .select(`
      id,
      first_name,
      last_name,
      player_statistics (
        id,
        age,
        total_goals,
        total_assists
      )
    `)
    .eq("id", pid)
    .order("id", { foreignTable: "player_statistics", ascending: false })
    .limit(1, { foreignTable: "player_statistics" })
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  return NextResponse.json({ player: data });
}

/* --------------------------------
   PATCH /api/players/:id (admin)
   -------------------------------- */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id } = await ctx.params;               // ← await params
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid <= 0) {
      return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
    }

    const supa = await createSupabaseRouteClient();

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({} as any));

    // Player fields (apply only if provided)
    const patchPlayer: Record<string, any> = {};
    if (body.first_name !== undefined) patchPlayer.first_name = String(body.first_name ?? "").trim();
    if (body.last_name  !== undefined) patchPlayer.last_name  = String(body.last_name ?? "").trim();

    if (patchPlayer.first_name !== undefined && patchPlayer.first_name.length < 1) {
      return NextResponse.json({ error: "First name is required" }, { status: 400 });
    }
    if (patchPlayer.last_name !== undefined && patchPlayer.last_name.length < 1) {
      return NextResponse.json({ error: "Last name is required" }, { status: 400 });
    }

    if (Object.keys(patchPlayer).length > 0) {
      const { error: pErr } = await supa.from("player").update(patchPlayer).eq("id", pid);
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    }

    // Stats fields (optional)
    const statsPatch: Record<string, any> = {};
    if (body.age !== undefined) {
      statsPatch.age = body.age === null || body.age === "" ? null : Number(body.age);
      if (statsPatch.age !== null && (Number.isNaN(statsPatch.age) || statsPatch.age < 0)) {
        return NextResponse.json({ error: "Invalid age" }, { status: 400 });
      }
    }
    if (body.total_goals !== undefined) {
      statsPatch.total_goals = body.total_goals === "" || body.total_goals == null ? 0 : Number(body.total_goals);
      if (Number.isNaN(statsPatch.total_goals) || statsPatch.total_goals < 0) {
        return NextResponse.json({ error: "Invalid total_goals" }, { status: 400 });
      }
    }
    if (body.total_assists !== undefined) {
      statsPatch.total_assists = body.total_assists === "" || body.total_assists == null ? 0 : Number(body.total_assists);
      if (Number.isNaN(statsPatch.total_assists) || statsPatch.total_assists < 0) {
        return NextResponse.json({ error: "Invalid total_assists" }, { status: 400 });
      }
    }

    if (Object.keys(statsPatch).length > 0) {
      // Requires UNIQUE (player_id) on public.player_statistics
      statsPatch.player_id = pid;
      const { error: sErr } = await supa
        .from("player_statistics")
        .upsert(statsPatch, { onConflict: "player_id" });
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    }

    // Refetch combined row with service role
    const { data: player, error: refErr } = await supabaseAdmin
      .from("player")
      .select(`
        id,
        first_name,
        last_name,
        player_statistics (
          id,
          age,
          total_goals,
          total_assists
        )
      `)
      .eq("id", pid)
      .order("id", { foreignTable: "player_statistics", ascending: false })
      .limit(1, { foreignTable: "player_statistics" })
      .maybeSingle();

    if (refErr) return NextResponse.json({ error: refErr.message }, { status: 400 });
    if (!player) return NextResponse.json({ error: "Player not found after update" }, { status: 404 });

    return NextResponse.json({ player });
  } catch (e: any) {
    if (String(e?.message) === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ------------------------------
   DELETE /api/players/:id (admin)
   ------------------------------ */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id } = await ctx.params;               // ← await params
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid <= 0) {
      return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
    }

    const supa = await createSupabaseRouteClient();

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // If you don't have FKs with ON DELETE CASCADE, remove children first:
    await supa.from("player_statistics").delete().eq("player_id", pid);
    await supa.from("player_teams").delete().eq("player_id", pid);

    const { data, error } = await supa
      .from("player")
      .delete()
      .eq("id", pid)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data)  return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
