// Loads one match and shapes it into what the page shows (see model.ts). The
// match, squads, per-match numbers and penalties come from the same queries as
// the live match page; on top of those, the season numbers of the players
// involved are read so their big cards carry the same six figures as on their
// profile.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached } from "@/app/lib/seasonScope";
import {
  fetchLegOneScores,
  fetchMatch,
  fetchMatchStatsMap,
  fetchParticipantsMap,
  fetchPlayersForTeam,
} from "@/app/matches/[id]/queries";
import { extractYouTubeId } from "@/app/matches/[id]/utils";
import type { MatchPlayerStatRow } from "@/app/lib/types";
import { STAT_COLUMNS, toTuple, type StatColumns } from "@/app/preview/paiktes-v2/data";
import type { StatTuple } from "@/app/preview/paiktes-v2/model";
import {
  awardStars,
  orderRoster,
  orderSheet,
  scorerLines,
  seasonNote,
  topScorer,
  type MatchPlayer,
  type MatchTeam,
  type MatchView,
  type Pair,
  type SheetRow,
  type Star,
  type StatLine,
} from "./model";

/**
 * Where a player's card leads when it is opened in a new tab: this match page
 * with that player's profile open (?player=). A plain click opens the profile
 * on top of the page instead — see ProfileHost. Every real player has a
 * profile (see profileLoader.ts), so every card leads somewhere.
 */
const profileHref = (matchId: number, playerId: number) => `/matches/${matchId}?player=${playerId}`;

type PlayerRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  deleted_at: string | null;
};

const toLine = (s: MatchPlayerStatRow): StatLine => ({
  goals: s.goals ?? 0,
  assists: s.assists ?? 0,
  ownGoals: s.own_goals ?? 0,
  yellow: s.yellow_cards ?? 0,
  red: s.red_cards ?? 0,
  blue: s.blue_cards ?? 0,
  mvp: !!s.mvp,
  bestGk: !!s.best_goalkeeper,
  captain: !!s.is_captain,
  gk: !!s.gk,
  number: s.player_number ?? null,
});

/** Players named by the match's numbers who are no longer in either squad. */
async function fetchPlayers(ids: number[]): Promise<PlayerRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, deleted_at")
    .in("id", ids);
  if (error) throw new Error(`Failed reading player: ${error.message}`);
  return (data ?? []) as PlayerRow[];
}

async function fetchSeasonStats(label: string, playerIds: number[]): Promise<Map<number, StatTuple>> {
  const out = new Map<number, StatTuple>();
  if (playerIds.length === 0) return out;
  // At most one row per player and season, and two squads are far below the
  // 1000-row page, so one request is enough.
  const { data, error } = await supabaseAdmin
    .from("player_season_stats")
    .select(`player_id, ${STAT_COLUMNS}`)
    .eq("season_label", label)
    .in("player_id", playerIds);
  if (error) throw new Error(`Failed reading player_season_stats: ${error.message}`);
  for (const row of (data ?? []) as unknown as (StatColumns & { player_id: number })[]) {
    out.set(row.player_id, toTuple(row));
  }
  return out;
}

export async function loadMatchView(id: number): Promise<MatchView | null> {
  const match = await fetchMatch(id);
  if (!match) return null;

  const teamA: MatchTeam = { id: match.team_a.id, name: match.team_a.name, logo: match.team_a.logo ?? null };
  const teamB: MatchTeam = { id: match.team_b.id, name: match.team_b.name, logo: match.team_b.logo ?? null };
  const isDecider = match.leg === 2 && match.tie_leg1_match_id != null;

  const [squadA, squadB, stats, participants, legOne, activeSeason] = await Promise.all([
    fetchPlayersForTeam(teamA.id),
    fetchPlayersForTeam(teamB.id),
    fetchMatchStatsMap(match.id),
    fetchParticipantsMap(match.id),
    isDecider ? fetchLegOneScores(match.tie_leg1_match_id as number) : Promise.resolve(null),
    getActiveSeasonCached(),
  ]);

  // The cards print the active season's numbers on every page, the same as
  // /paiktes — also on a match of an earlier season.
  const label = activeSeason?.label ?? null;

  const players = new Map<number, MatchPlayer>();
  const add = (row: PlayerRow) => {
    if (!row.id || players.has(row.id)) return;
    const former = !!row.deleted_at;
    players.set(row.id, {
      id: row.id,
      first: (row.first_name ?? "").trim(),
      last: (row.last_name ?? "").trim(),
      photo: row.photo ?? null,
      former,
      href: profileHref(match.id, row.id),
    });
  };
  for (const pa of [...squadA, ...squadB]) add(pa.player as PlayerRow);

  // Who took part: everyone marked as played, plus anyone with numbers.
  const teamOf = new Map<number, number>();
  for (const p of participants.values()) teamOf.set(p.player_id, p.team_id);
  for (const s of stats.values()) if (!teamOf.has(s.player_id)) teamOf.set(s.player_id, s.team_id);

  const missing = [...teamOf.keys()].filter((pid) => !players.has(pid));
  for (const row of await fetchPlayers(missing)) add(row);

  const seasonStats = label
    ? await fetchSeasonStats(label, [...players.keys()])
    : new Map<number, StatTuple>();
  const seasonOf = (playerId: number) => seasonStats.get(playerId) ?? null;

  const sheetOf = (teamId: number): SheetRow[] => {
    const rows: SheetRow[] = [];
    for (const [playerId, tid] of teamOf) {
      const player = players.get(playerId);
      if (tid !== teamId || !player) continue;
      const stat = stats.get(playerId);
      rows.push({ player, line: stat ? toLine(stat) : null });
    }
    return orderSheet(rows);
  };
  const sheetA = sheetOf(teamA.id);
  const sheetB = sheetOf(teamB.id);

  const rosterOf = (squad: typeof squadA) =>
    orderRoster(squad.map((pa) => players.get(pa.player.id)).filter((p): p is MatchPlayer => !!p));
  const rosterA = rosterOf(squadA);
  const rosterB = rosterOf(squadB);

  const finished = match.status === "finished";
  const phase: MatchView["phase"] = finished ? "after" : "before";

  const score: Pair | null =
    phase === "after" && match.team_a_score != null && match.team_b_score != null
      ? { a: match.team_a_score, b: match.team_b_score }
      : null;
  const penalties: Pair | null =
    score && match.penalty_a != null && match.penalty_b != null
      ? { a: match.penalty_a, b: match.penalty_b }
      : null;

  // Both legs added up, per team: the two sides swap home and away between
  // the legs, so leg 1 is matched by team id, not by column.
  let aggregate: Pair | null = null;
  if (score && isDecider && legOne && legOne.team_a_score != null && legOne.team_b_score != null) {
    const legOneFor = (teamId: number) =>
      legOne.team_a_id === teamId
        ? (legOne.team_a_score ?? 0)
        : legOne.team_b_id === teamId
          ? (legOne.team_b_score ?? 0)
          : 0;
    aggregate = { a: score.a + legOneFor(teamA.id), b: score.b + legOneFor(teamB.id) };
  }

  let stars: Star[];
  if (phase === "after") {
    stars = awardStars(
      [
        { team: teamA, sheet: sheetA },
        { team: teamB, sheet: sheetB },
      ],
      seasonOf,
    );
  } else {
    stars = [];
    for (const [team, roster] of [
      [teamA, rosterA],
      [teamB, rosterB],
    ] as const) {
      const top = topScorer(roster, seasonOf);
      if (top) {
        stars.push({
          player: top.player,
          team,
          label: "Πρώτος σκόρερ",
          note: seasonNote(top.season),
          season: top.season,
        });
      }
    }
  }

  const after = phase === "after";
  return {
    id: match.id,
    phase,
    status: match.status,
    date: match.match_date ?? null,
    referee: match.referee ?? null,
    tournament: match.tournament
      ? { id: match.tournament.id, name: match.tournament.name, logo: match.tournament.logo ?? null }
      : null,
    score,
    aggregate,
    penalties,
    a: {
      team: teamA,
      scorers: after ? scorerLines(sheetA) : [],
      sheet: after ? sheetA : [],
      roster: rosterA,
    },
    b: {
      team: teamB,
      scorers: after ? scorerLines(sheetB) : [],
      sheet: after ? sheetB : [],
      roster: rosterB,
    },
    stars,
    videoId: after && match.video_url ? extractYouTubeId(match.video_url) : null,
  };
}
