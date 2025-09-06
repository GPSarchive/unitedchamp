// app/api/tournaments/[slug]/seed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST body options (one of):
 *  A) Manual pairs (recommended simplest):
 *     {
 *       "to_stage_id": number,
 *       "pairs": [
 *         { "team_a_id": 1, "team_b_id": 8, "round": 1, "bracket_pos": 1 },
 *         { "team_a_id": 4, "team_b_id": 5, "round": 1, "bracket_pos": 2 },
 *         ...
 *       ]
 *     }
 *
 *  B) If you created an RPC (e.g. seed_knockout_from_groups), you can call it by passing:
 *     { "rpc": "seed_knockout_from_groups", "args": { ... } }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const s = await createSupabaseRouteClient();

  // --- Admin gate (RLS): require user with 'admin' role in app_metadata
  const {
    data: { user },
  } = await s.auth.getUser();
  const roles = (user?.app_metadata as any)?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { to_stage_id, pairs, rpc, args } = body ?? {};

  const { slug } = await ctx.params; // Next 15: params is a Promise

  // Resolve tournament
  const { data: t } = await s
    .from("tournaments")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  // Path B: Call a DB RPC if you provided one
  if (rpc && typeof rpc === "string") {
    const { data, error } = await s.rpc(rpc, args ?? {});
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data ?? null });
  }

  // Path A: Manual pairs → create matches under the destination stage
  if (!Array.isArray(pairs) || !to_stage_id) {
    return NextResponse.json(
      {
        error:
          "Provide { to_stage_id, pairs:[{team_a_id,team_b_id,round,bracket_pos}, ...] } or { rpc, args }",
      },
      { status: 400 }
    );
  }

  // Validate destination stage belongs to same tournament
  const { data: stage } = await s
    .from("tournament_stages")
    .select("id,tournament_id,kind")
    .eq("id", to_stage_id)
    .maybeSingle();

  if (!stage || stage.tournament_id !== t.id || stage.kind !== "knockout") {
    return NextResponse.json(
      { error: "Invalid to_stage_id (must be a knockout stage of this tournament)" },
      { status: 400 }
    );
  }

  // Build rows to insert
  const rows = (pairs as any[]).map(p => ({
    tournament_id: t.id,
    stage_id: to_stage_id,
    group_id: null,
    matchday: null,
    round: p.round ?? 1,
    bracket_pos: p.bracket_pos ?? null,
    team_a_id: p.team_a_id ?? null,
    team_b_id: p.team_b_id ?? null,
    status: "scheduled",
  }));

  const { data, error } = await s.from("matches").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    created: data?.length ?? 0,
    match_ids: data?.map((r: any) => r.id) ?? [],
  });
}
