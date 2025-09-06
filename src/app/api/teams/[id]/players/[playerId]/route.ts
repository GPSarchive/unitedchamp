// src/app/api/teams/[id]/players/[playerId]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";

type Ctx = { params: Promise<{ id: string; playerId: string }> };

/* =======================
   Minimal same-origin guard
   ======================= */
// .env: ALLOWED_ORIGINS=https://app.example.com,http://localhost:3000
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  // Build a whitelist: env + the API’s own origin at runtime (dev/preview safe)
  const whitelist = new Set(allowedOrigins);
  try {
    whitelist.add(new URL(req.url).origin);
  } catch {
    // ignore
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const ok = [origin, referer].some(val => {
    try {
      return !!val && whitelist.has(new URL(val).origin);
    } catch {
      return false;
    }
  });

  if (!ok) throw new Error("bad-origin");
}

/* ==============
   Helper utils
   ============== */
function parsePositiveInt(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ======================
   OPTIONS / HEAD handlers
   ====================== */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "DELETE,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "DELETE,OPTIONS,HEAD" } });
}

/* ==========================================
   DELETE /api/teams/[id]/players/[playerId]
   ========================================== */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id: idParam, playerId: playerIdParam } = await ctx.params; // Next 15: params is a Promise

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Validate ids
    const teamId = parsePositiveInt(idParam);
    const playerId = parsePositiveInt(playerIdParam);
    if (!teamId || !playerId) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    // Unlink ONLY the association; delete all duplicates if they exist
    const { error: delErr, count } = await supa
      .from("player_teams")
      .delete({ count: "exact" })
      .eq("team_id", teamId)
      .eq("player_id", playerId);

    if (delErr) {
      console.error("DELETE player_teams error", delErr);
      return NextResponse.json({ error: "Delete failed" }, { status: 400 });
    }
    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: "Player is not linked to this team" }, { status: 404 });
    }

    // Return the updated associations list (via user client so RLS applies)
    const { data: updated, error: listErr } = await supa
      .from("player_teams")
      .select(`
        id,
        player:player_id (
          id, first_name, last_name,
          player_statistics ( id, age, total_goals, total_assists )
        )
      `)
      .eq("team_id", teamId)
      .order("id", { ascending: true });

    if (listErr) {
      console.error("Refetch associations failed", listErr);
      return NextResponse.json({ ok: true, deleted: count ?? 1 });
    }

    return NextResponse.json({
      ok: true,
      deleted: count ?? 1,
      playerAssociations: updated ?? [],
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("DELETE /teams/[id]/players/[playerId] failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
