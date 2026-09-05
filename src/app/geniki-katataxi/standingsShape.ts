// app/geniki-katataxi/standingsShape.ts
// Pure helpers shared by the points engine, the stored-standings writer
// (lib/refreshStandings.ts) and the renderers. No I/O, no Next imports —
// unit-tested in __tests__/standingsShape.test.ts.

import type { MatchDetail, PointsEvent, TeamSeasonLine } from "./rules";

export type RankedLine = TeamSeasonLine & { rank: number };

/** Sort order of a season's lines: points desc, wins desc, team id asc. */
export function compareLines(a: TeamSeasonLine, b: TeamSeasonLine): number {
  return b.points - a.points || b.wins - a.wins || a.teamId - b.teamId;
}

/**
 * Dense rank: teams with equal points share a rank, the next distinct points
 * total gets rank+1 (1,1,2 — never 1,1,3). Returns a sorted copy.
 */
export function rankLines(lines: TeamSeasonLine[]): RankedLine[] {
  const sorted = [...lines].sort(compareLines);
  let lastPts: number | null = null;
  let rank = 0;
  return sorted.map((l) => {
    if (lastPts === null || l.points !== lastPts) {
      rank += 1;
      lastPts = l.points;
    }
    return { ...l, rank };
  });
}

/** The owner-required per-team season extras (contract §6), stored next to the points. */
export interface TeamSeasonExtras {
  matches_played: number;
  goals_for: number;
  goals_against: number;
  clean_sheets: number;
  longest_win_streak: number;
}

/**
 * Extras derived from the team's W/D/L points events (each carries its
 * per-match breakdown). Matches are ordered by date for the streak; undated
 * matches sort last. A forfeit recorded without a score counts as a played
 * match and (if a win) extends the streak, but adds nothing to GF/GA and is
 * not a clean sheet. Cancelled events still count — cancellation only
 * neutralises points, not results.
 */
export function teamSeasonExtras(events: PointsEvent[]): TeamSeasonExtras {
  const results: { kind: "win" | "draw" | "loss"; m: MatchDetail }[] = [];
  for (const e of events) {
    if ((e.kind === "win" || e.kind === "draw" || e.kind === "loss") && e.matches) {
      for (const m of e.matches) results.push({ kind: e.kind, m });
    }
  }
  results.sort((a, b) => (a.m.date ?? "9999").localeCompare(b.m.date ?? "9999"));

  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let streak = 0;
  let best = 0;
  for (const { kind, m } of results) {
    if (m.goalsFor != null) goalsFor += m.goalsFor;
    if (m.goalsAgainst != null) {
      goalsAgainst += m.goalsAgainst;
      if (m.goalsAgainst === 0) cleanSheets += 1;
    }
    if (kind === "win") {
      streak += 1;
      if (streak > best) best = streak;
    } else {
      streak = 0;
    }
  }
  return {
    matches_played: results.length,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    clean_sheets: cleanSheets,
    longest_win_streak: best,
  };
}

/** One stored row of public.season_team_standings (migrations/add-season-aggregates.sql). */
export interface SeasonStandingRow extends TeamSeasonExtras {
  season_label: string;
  team_id: number;
  rank: number;
  points: number;
  participations: number;
  qualifications: number;
  titles: number;
  runner_ups: number;
  wins: number;
  draws: number;
  losses: number;
  adjustment_points: number;
  adjustment_count: number;
  events: PointsEvent[];
  refreshed_at: string;
}

/** Stored row → engine line shape (what every renderer already consumes). */
export function lineFromStoredRow(row: SeasonStandingRow): TeamSeasonLine {
  return {
    teamId: row.team_id,
    participations: row.participations,
    qualifications: row.qualifications,
    titles: row.titles,
    runnerUps: row.runner_ups,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    adjustmentPoints: row.adjustment_points,
    adjustmentCount: row.adjustment_count,
    points: row.points,
  };
}

/**
 * THE rank rule every surface shares: keep only the rows whose team is in
 * `visibleTeamIds`, then dense-rank the survivors (ranks close up). The live
 * standings page passes the season's non-deleted teams; the archive passes
 * every team of the season (which reproduces the stored rank); the team page
 * passes whichever set the page it links to would use — so the "#" a team
 * shows is the "#" the table shows.
 */
export function rankVisible(rows: SeasonStandingRow[], visibleTeamIds: Set<number>): RankedLine[] {
  return rankLines(rows.filter((r) => visibleTeamIds.has(r.team_id)).map(lineFromStoredRow));
}

/** Engine line + its events → stored row (minus refreshed_at, set by the writer). */
export function storedRowFromLine(
  seasonLabel: string,
  line: RankedLine,
  events: PointsEvent[],
): Omit<SeasonStandingRow, "refreshed_at"> {
  return {
    season_label: seasonLabel,
    team_id: line.teamId,
    rank: line.rank,
    points: line.points,
    participations: line.participations,
    qualifications: line.qualifications,
    titles: line.titles,
    runner_ups: line.runnerUps,
    wins: line.wins,
    draws: line.draws,
    losses: line.losses,
    adjustment_points: line.adjustmentPoints,
    adjustment_count: line.adjustmentCount,
    ...teamSeasonExtras(events),
    events,
  };
}
