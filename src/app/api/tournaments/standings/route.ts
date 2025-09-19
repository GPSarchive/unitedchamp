// app/api/tournaments/[slug]/standings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const s = await createSupabaseRouteClient();
  const { searchParams } = new URL(req.url);
  const stageId = Number(searchParams.get("stage_id") ?? "0");
  const groupId = Number(searchParams.get("group_id") ?? "0");

  const { slug } = await ctx.params; // Next 15: params is a Promise

  const { data: t } = await s
    .from("tournaments")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  let q = s.from("v_tournament_standings").select("*").eq("tournament_id", t.id);
  if (stageId) q = q.eq("stage_id", stageId);
  if (groupId) q = q.eq("group_id", groupId);

  const { data, error } = await q
    .order("points", { ascending: false })
    .order("goal_diff", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
