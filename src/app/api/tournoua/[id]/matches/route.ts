// app/api/tournaments/[id]/matches/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supa = await createSupabaseRouteClient();

  // You can broaden/narrow these columns as needed for your tree
  const { data: matches, error } = await supa
    .from("matches")
    .select(`
      id,tournament_id,stage_id,group_id,matchday,round,bracket_pos,
      team_a_id,team_b_id,team_a_score,team_b_score,status,match_date,
      home_source_match_id,home_source_outcome,away_source_match_id,away_source_outcome
    `)
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("bracket_pos", { ascending: true })
    .order("matchday", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ matches });
}
