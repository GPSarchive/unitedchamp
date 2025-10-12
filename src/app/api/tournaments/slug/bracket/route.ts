// app/api/tournaments/[slug]/bracket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const s = await createSupabaseRouteClient();
  const { searchParams } = new URL(req.url);
  const { slug } = await ctx.params; // Next 15: params is a Promise

  const stageId = Number(searchParams.get("stage_id") ?? "0");

  // Find tournament id
  const { data: t } = await s
    .from("tournaments")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  // If no stage provided, try to pick the first knockout stage
  let sid = stageId;
  if (!sid) {
    const { data: ks } = await s
      .from("tournament_stages")
      .select("id")
      .eq("tournament_id", t.id)
      .eq("kind", "knockout")
      .order("ordering")
      .limit(1)
      .maybeSingle();
    sid = ks?.id ?? 0;
  }
  if (!sid) return NextResponse.json({ matches: [] });

  const { data, error } = await s
    .from("matches")
    .select(
      "id,round,bracket_pos,team_a_id,team_b_id,team_a_score,team_b_score,status,home_source_match_id,home_source_outcome,away_source_match_id,away_source_outcome"
    )
    .eq("tournament_id", t.id)
    .eq("stage_id", sid)
    .order("round", { ascending: true })
    .order("bracket_pos", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ matches: data ?? [], stage_id: sid });
}
