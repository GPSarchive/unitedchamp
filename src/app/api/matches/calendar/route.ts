// app/api/matches/calendar/route.ts
// Returns matches within an [after, before] date window for the calendar.
// Used by Calendar.tsx when navigating to a month outside the initial SSR window.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

const MAX_PER_PAGE = 200;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const now = new Date();

  // Default: 60 days back → 90 days forward (same window as SSR)
  const defaultStart = new Date(now);
  defaultStart.setDate(now.getDate() - 60);
  const defaultEnd = new Date(now);
  defaultEnd.setDate(now.getDate() + 90);

  const afterRaw  = searchParams.get("after")  ?? defaultStart.toISOString();
  const beforeRaw = searchParams.get("before") ?? defaultEnd.toISOString();

  // Validate ISO strings
  if (isNaN(Date.parse(afterRaw)) || isNaN(Date.parse(beforeRaw))) {
    return NextResponse.json({ error: "Invalid after/before params" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      `id, match_date, status, team_a_score, team_b_score,
       teamA:teams!matches_team_a_id_fkey (name, logo),
       teamB:teams!matches_team_b_id_fkey (name, logo),
       tournament:tournament_id (id, name, logo)`
    )
    .gte("match_date", afterRaw)
    .lte("match_date", beforeRaw)
    .order("match_date", { ascending: true })
    .order("id",         { ascending: true })
    .limit(MAX_PER_PAGE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ matches: data ?? [] });
}
