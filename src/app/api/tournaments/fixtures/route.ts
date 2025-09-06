// app/api/tournaments/[slug]/fixtures/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const s = await createSupabaseRouteClient();
  const { searchParams } = new URL(req.url);
  const { slug } = await ctx.params; // Next 15: params is a Promise

  const stageId = Number(searchParams.get("stage_id") ?? "0");
  const groupId = Number(searchParams.get("group_id") ?? "0");
  const matchday = searchParams.get("matchday");
  const status = searchParams.getAll("status"); // allow multiple ?status=scheduled&status=live

  const { data: t } = await s.from("tournaments").select("id").eq("slug", slug).maybeSingle();
  if (!t) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  let q = s
    .from("matches")
    .select(
      "id,match_date,team_a_id,team_b_id,team_a_score,team_b_score,status,matchday,round,bracket_pos,stage_id,group_id"
    )
    .eq("tournament_id", t.id)
    .order("matchday", { ascending: true })
    .order("match_date", { ascending: true });

  if (stageId) q = q.eq("stage_id", stageId);
  if (groupId) q = q.eq("group_id", groupId);
  if (matchday && !Number.isNaN(Number(matchday))) q = q.eq("matchday", Number(matchday));
  if (status.length) q = q.in("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ matches: data ?? [] });
}
