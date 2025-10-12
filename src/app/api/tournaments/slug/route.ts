// app/api/tournaments/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const s = await createSupabaseRouteClient();
  const { slug } = await ctx.params; // Next 15: params is a Promise

  const { data: t, error: te } = await s
    .from("tournaments")
    .select("id,name,slug,logo,season,status,format,start_date,end_date,winner_team_id")
    .eq("slug", slug)
    .maybeSingle();

  if (te) return NextResponse.json({ error: te.message }, { status: 404 });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Stages + embedded groups in one trip
  const { data: stages, error: se } = await s
    .from("tournament_stages")
    .select("id,name,kind,ordering,tournament_groups(id,name)")
    .eq("tournament_id", t.id)
    .order("ordering");

  if (se) return NextResponse.json({ error: se.message }, { status: 500 });

  const groupsByStage: Record<number, any[]> = {};
  (stages ?? []).forEach((st: any) => {
    groupsByStage[st.id] = st.tournament_groups ?? [];
    delete st.tournament_groups;
  });

  return NextResponse.json({ tournament: t, stages, groupsByStage });
}
