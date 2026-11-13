// app/api/matches/explorer/route.ts
// One page of the public /matches explorer (MatchesExplorer.tsx).
//
// The explorer used to query Supabase straight from the browser with the anon
// key, which required anon SELECT on matches/teams/tournaments — i.e. anyone
// holding the key from the bundle could download those tables wholesale. The
// read now happens here with the service role, so the anon key needs no table
// access at all (migrations/lock-anon-reads.sql) and every request passes the
// rate limiter in proxy.ts.
//
// Deliberately narrow: active season only, fixed page size, two tabs.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveScope } from "@/app/lib/seasonScope";

const PAGE_SIZE = 12;
const MAX_PAGE = 500;

const empty = () => NextResponse.json({ rows: [], total: 0, pageSize: PAGE_SIZE });

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const tab = sp.get("tab") === "finished" ? "finished" : "upcoming";

  const pageNum = Number(sp.get("page") ?? "1");
  const page = Number.isInteger(pageNum) ? Math.min(Math.max(pageNum, 1), MAX_PAGE) : 1;

  // The explorer never leaves the ACTIVE season: "all" is the union of its
  // tournaments, and a picked tournament must be one of them.
  const { tournamentIds } = await getActiveScope();
  let ids = tournamentIds;

  const tournamentRaw = sp.get("tournament");
  if (tournamentRaw) {
    const tid = Number(tournamentRaw);
    if (!Number.isInteger(tid) || !tournamentIds.includes(tid)) return empty();
    ids = [tid];
  }
  if (ids.length === 0) return empty();

  const isUpcoming = tab === "upcoming";
  const nowISO = new Date().toISOString();

  let q = supabaseAdmin
    .from("matches")
    .select(
      `id, match_date, status, team_a_score, team_b_score,
       matchday, round,
       teamA:teams!matches_team_a_id_fkey (name, logo),
       teamB:teams!matches_team_b_id_fkey (name, logo),
       tournament:tournament_id (id, name, logo)`,
      { count: "exact" }
    )
    .in("tournament_id", ids);

  // The two tabs must PARTITION all dated matches — nothing may vanish from
  // both. upcoming = future-dated and not finished; past = finished OR
  // past-dated (so an unscored/postponed yesterday match stays visible here
  // instead of disappearing until an admin finishes it).
  q = isUpcoming
    ? q.gte("match_date", nowISO).or("status.is.null,status.neq.finished")
    : q.or(`status.eq.finished,match_date.lt.${nowISO}`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await q
    .order("match_date", { ascending: isUpcoming })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    // PGRST103 = the requested page starts past the last row.
    if ((error as { code?: string }).code === "PGRST103") return empty();
    console.error("GET /api/matches/explorer failed", error);
    return NextResponse.json({ error: "Αποτυχία φόρτωσης αγώνων" }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE });
}
