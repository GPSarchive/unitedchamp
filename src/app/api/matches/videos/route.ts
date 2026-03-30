// app/api/matches/videos/route.ts
// Cursor-paginated video matches endpoint.
//
// First page:  GET /api/matches/videos
// Next pages:  GET /api/matches/videos?cursorDate=<ISO>&cursorId=<number>
//
// Cursor is the (match_date, id) of the LAST item from the previous page.
// Returns up to 10 matches ordered newest-first.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cursorDate = searchParams.get("cursorDate");
  const cursorId   = searchParams.get("cursorId");

  let query = supabaseAdmin
    .from("matches")
    .select(
      `id, video_url, match_date,
       team_a_score, team_b_score,
       teamA:teams!matches_team_a_id_fkey (name, logo),
       teamB:teams!matches_team_b_id_fkey (name, logo),
       tournament:tournament_id (name)`
    )
    .not("video_url", "is", null)
    .neq("video_url", "")
    .order("match_date", { ascending: false })
    .order("id",         { ascending: false })
    .limit(PAGE_SIZE);

  if (cursorDate && cursorId && !isNaN(Number(cursorId))) {
    // Compound cursor: rows older than the cursor
    // (match_date < cursorDate) OR (match_date = cursorDate AND id < cursorId)
    query = query.or(
      `match_date.lt.${cursorDate},and(match_date.eq.${cursorDate},id.lt.${Number(cursorId)})`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = data ?? [];
  const last  = items[items.length - 1];
  const nextCursor =
    items.length === PAGE_SIZE && last
      ? { cursorDate: last.match_date, cursorId: last.id }
      : null;

  return NextResponse.json({ videos: items, nextCursor });
}
