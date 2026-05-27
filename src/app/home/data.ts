// Home-page data layer.
//
// Everything the home page needs to render is fetched and shaped here.
// The page itself just calls `loadHomeData()` and hands the result to components.
//
// Each fetcher is small, single-purpose, and independently importable —
// e.g. a future admin tool or API route can reuse them without dragging
// the page along.

import { cache } from "react";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchRecentNewsCount } from "@/app/lib/fetchRecentNewsCount";
import { MatchRowRaw, CalendarEvent, normalizeTeam } from "@/app/lib/types";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { signTournamentLogos } from "@/app/tournaments/signTournamentLogos";

// NOTE: date helpers are inlined here for Step 1. Step 2 will extract them
// into `@/app/lib/datetime` so other features can reuse them.
const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const pad2 = (n: number) => String(n).padStart(2, "0");
type DateParts = { y: number; M: number; d: number; h: number; min: number; s: number };

function parseIsoPreserveClock(iso: string): DateParts {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Unrecognized ISO datetime: ${iso}`);
  const [, y, M, d, h, min, s] = m;
  return { y: +y, M: +M, d: +d, h: +h, min: +min, s: +s };
}
function toNaiveIso(iso: string) {
  const { y, M, d, h, min, s } = parseIsoPreserveClock(iso);
  return `${y}-${pad2(M)}-${pad2(d)}T${pad2(h)}:${pad2(min)}:${pad2(s)}`;
}
function daysInMonth(y: number, M: number) {
  return new Date(y, M, 0).getDate();
}
function addMinutesNaive(parts: DateParts, deltaMin: number): DateParts {
  const start = parts.h * 60 + parts.min;
  const total = start + deltaMin;
  let dayDelta = Math.floor(total / 1440);
  let minutesInDay = total % 1440;
  if (minutesInDay < 0) {
    minutesInDay += 1440;
    dayDelta -= 1;
  }
  const h = Math.floor(minutesInDay / 60);
  const min = minutesInDay % 60;
  let { y, M, d } = parts;
  d += dayDelta;
  while (true) {
    const dim = daysInMonth(y, M);
    if (d <= dim) break;
    d -= dim;
    M += 1;
    if (M > 12) {
      M = 1;
      y += 1;
    }
  }
  return { y, M, d, h, min, s: parts.s };
}
function partsToIso(parts: DateParts) {
  const { y, M, d, h, min, s } = parts;
  return `${y}-${pad2(M)}-${pad2(d)}T${pad2(h)}:${pad2(min)}:${pad2(s)}`;
}

// ──────────────────────────────────────────────────────────────────────
// Fetchers
// ──────────────────────────────────────────────────────────────────────

// Matches in a window from 60 days ago to 90 days ahead, with team + tournament joins.
// Wrapped in `cache()` so multiple callers in the same request share one query.
export const fetchMatchesWithTeams = cache(async () => {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - 60);
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 90);

  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      `
      id, match_date, team_a_id, team_b_id, team_a_score, team_b_score,
      status, stage_id, group_id, matchday, round,
      teamA:teams!matches_team_a_id_fkey (name, logo),
      teamB:teams!matches_team_b_id_fkey (name, logo),
      tournament:tournament_id (id, name, logo)
    `
    )
    .gte("match_date", windowStart.toISOString())
    .lte("match_date", windowEnd.toISOString())
    .order("match_date", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("[home/data] fetchMatchesWithTeams failed:", error.message);
    return [] as MatchRowRaw[];
  }
  return (data ?? []) as unknown as MatchRowRaw[];
});

// Six most-recent tournaments, with team + match counts and signed logo URLs.
export const fetchTournaments = cache(async (): Promise<Tournament[]> => {
  const { data, error } = await supabaseAdmin
    .from("tournaments")
    .select(
      `id, name, slug, format, season, logo, status, winner_team_id,
       tournament_teams(count), matches(count)`
    )
    .order("id", { ascending: false })
    .limit(6);

  if (error) {
    console.error("[home/data] fetchTournaments failed:", error.message);
    return [];
  }

  const withCounts = (data ?? []).map((t: any) => ({
    ...t,
    teams_count: t.tournament_teams?.[0]?.count ?? 0,
    matches_count: t.matches?.[0]?.count ?? 0,
    tournament_teams: undefined,
    matches: undefined,
  }));

  return signTournamentLogos(withCounts as Tournament[]);
});

// Most-recent 20 matches that have a video_url, with team logos resolved.
export const fetchVideoMatches = cache(async () => {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      `
      id, video_url, match_date, created_at, team_a_score, team_b_score,
      teamA:teams!matches_team_a_id_fkey (name, logo),
      teamB:teams!matches_team_b_id_fkey (name, logo),
      tournament:tournament_id (name)
    `
    )
    .not("video_url", "is", null)
    .neq("video_url", "")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[home/data] fetchVideoMatches failed:", error.message);
    return [];
  }

  return (data ?? []).map((m: any) => {
    const a = normalizeTeam(m.teamA);
    const b = normalizeTeam(m.teamB);
    return {
      id: m.id,
      video_url: m.video_url,
      team_a_name: a?.name ?? null,
      team_b_name: b?.name ?? null,
      team_a_logo: a?.logo ? resolveImageUrl(a.logo, ImageType.TEAM) : null,
      team_b_logo: b?.logo ? resolveImageUrl(b.logo, ImageType.TEAM) : null,
      team_a_score: m.team_a_score ?? null,
      team_b_score: m.team_b_score ?? null,
      match_date: m.match_date ?? null,
      created_at: m.created_at ?? null,
      tournament_name: m.tournament?.name ?? null,
    };
  });
});

// ──────────────────────────────────────────────────────────────────────
// Mappers — pure functions that shape DB rows into UI-friendly events.
// ──────────────────────────────────────────────────────────────────────

function matchRowToEvent(m: MatchRowRaw): CalendarEvent | null {
  if (!m.match_date) return null;
  const a = normalizeTeam(m.teamA);
  const b = normalizeTeam(m.teamB);
  const startParts = parseIsoPreserveClock(m.match_date);
  const startIso = toNaiveIso(m.match_date);
  const endIso = partsToIso(addMinutesNaive(startParts, 50));

  const teamAScore = (m as any).team_a_score ?? null;
  const teamBScore = (m as any).team_b_score ?? null;
  const tournament = (m as any).tournament ?? null;

  return {
    id: String(m.id),
    title: `${a?.name ?? "Άγνωστο"} vs ${b?.name ?? "Άγνωστο"}`,
    start: startIso,
    end: endIso,
    all_day: false,
    teams: [a?.name ?? "Άγνωστο", b?.name ?? "Άγνωστο"],
    logos: [a?.logo ?? "/placeholder.png", b?.logo ?? "/placeholder.png"],
    status: (m as any).status ?? null,
    home_score: teamAScore,
    away_score: teamBScore,
    score:
      typeof teamAScore === "number" && typeof teamBScore === "number"
        ? [teamAScore, teamBScore]
        : undefined,
    tournament_name: tournament?.name ?? null,
    tournament_logo: tournament?.logo
      ? resolveImageUrl(tournament.logo, ImageType.TOURNAMENT)
      : null,
    matchday: (m as any).matchday ?? null,
    round: (m as any).round ?? null,
  } as CalendarEvent;
}

function mapMatchesToEvents(rows: MatchRowRaw[]): CalendarEvent[] {
  return rows
    .map(matchRowToEvent)
    .filter((e): e is CalendarEvent => e !== null);
}

// ──────────────────────────────────────────────────────────────────────
// Aggregate — one call returns everything the home page needs.
// ──────────────────────────────────────────────────────────────────────

export async function loadHomeData() {
  const [rawMatches, tournaments, recentContentCount, videoMatches] =
    await Promise.all([
      fetchMatchesWithTeams(),
      fetchTournaments(),
      fetchRecentNewsCount(),
      fetchVideoMatches(),
    ]);

  return {
    events: mapMatchesToEvents(rawMatches),
    tournaments,
    recentContentCount,
    videoMatches,
  };
}
