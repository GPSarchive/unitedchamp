// app/api/tournaments/[slug]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const s = await createSupabaseRouteClient();
  const { searchParams } = new URL(req.url);
  const { slug } = await ctx.params; // Next 15: params is a Promise

  const sort = (searchParams.get("sort") ?? "goals") as
    | "goals"
    | "assists"
    | "mvp_count"
    | "best_gk_count"
    | "yellow_cards"
    | "red_cards"
    | "blue_cards";

  const limit = Number(searchParams.get("limit") ?? "200");
  const includeNames = searchParams.get("includeNames") === "1";

  const { data: t } = await s
    .from("tournaments")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!t) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  const { data, error } = await s
    .from("v_tournament_player_stats")
    .select("*")
    .eq("tournament_id", t.id)
    .order(sort, { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!includeNames || !data?.length) {
    return NextResponse.json({ rows: data ?? [] });
  }

  const ids = Array.from(new Set((data as any[]).map((r: any) => r.player_id)));
  const { data: players } = await s
    .from("player")
    .select("id,first_name,last_name")
    .in("id", ids);

  const map = Object.fromEntries((players ?? []).map((p: any) => [p.id, p]));

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    player: map[r.player_id] ?? null,
  }));

  return NextResponse.json({ rows });
}
