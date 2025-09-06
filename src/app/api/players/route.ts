// app/api/players/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin"; // ← service role (server-only)

/* same-origin guard (like matches) */
function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;
  const wl = new Set((process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean));
  try { wl.add(new URL(req.url).origin); } catch {}
  const ok = [req.headers.get("origin"), req.headers.get("referer")].some(v => {
    try { return !!v && wl.has(new URL(v).origin); } catch { return false; }
  });
  if (!ok) throw new Error("bad-origin");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}

/* ---------- GET (admin; reads via supabaseAdmin) ---------- */
export async function GET(req: Request) {
  const routeClient = await createSupabaseRouteClient();

  // Admin auth (cookie-based session), then do the read via service role
  const { data: auth } = await routeClient.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = Array.isArray(user.app_metadata?.roles) ? (user.app_metadata!.roles as string[]) : [];
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const excludeTeamId = Number(url.searchParams.get("excludeTeamId") || "");
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);

  // Read with service role so RLS on child tables can't hide stats
  let query = supabaseAdmin
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
    .order("last_name", { ascending: true })
    .limit(limit)
    .limit(1, { foreignTable: "player_statistics" }); // only 1 stats row per player

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (Number.isFinite(excludeTeamId)) {
    const { data: links, error: linkErr } = await supabaseAdmin
      .from("player_teams")
      .select("player_id")
      .eq("team_id", excludeTeamId);
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

    const linked = new Set((links ?? []).map((l: any) => l.player_id));
    return NextResponse.json({ players: (rows ?? []).filter((p: any) => !linked.has(p.id)) });
  }

  return NextResponse.json({ players: rows ?? [] });
}

/* ---------- POST (create player + stats; unchanged) ---------- */
export async function POST(req: Request) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();

    // admin auth (same pattern as matches)
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const first = String(body.first_name ?? "").trim();
    const last  = String(body.last_name ?? "").trim();
    if (!first || !last) return NextResponse.json({ error: "First/last name required" }, { status: 400 });

    const age           = body.age == null || body.age === "" ? null : Number(body.age);
    const total_goals   = body.total_goals == null || body.total_goals === "" ? 0 : Number(body.total_goals);
    const total_assists = body.total_assists == null || body.total_assists === "" ? 0 : Number(body.total_assists);

    // 1) create player
    const { data: player, error: pErr } = await supa
      .from("player")
      .insert({ first_name: first, last_name: last })
      .select("id, first_name, last_name")
      .single();
    if (pErr || !player) return NextResponse.json({ error: pErr?.message || "Create failed" }, { status: 400 });

    // 2) upsert stats (requires UNIQUE (player_id) on player_statistics)
    const { data: stats, error: sErr } = await supa
      .from("player_statistics")
      .upsert(
        { player_id: player.id, age, total_goals, total_assists },
        { onConflict: "player_id" }
      )
      .select("player_id, age, total_goals, total_assists")
      .single();

    if (sErr) {
      // best-effort cleanup if stats fail
      await supa.from("player").delete().eq("id", player.id);
      return NextResponse.json({ error: sErr.message }, { status: 400 });
    }

    return NextResponse.json({ player: { ...player, player_statistics: [stats] } }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message) === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
