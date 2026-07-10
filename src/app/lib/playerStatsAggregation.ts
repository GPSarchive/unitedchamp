// Pure aggregation math for the player-stats pipeline.
//
// Shared by the incremental refreshers AND the full rebuild in
// refreshPlayerStats.ts, so the two code paths cannot drift apart, and by the
// fix-stats tool for the legacy player_statistics totals. No I/O here — this
// module is unit-tested in isolation (see __tests__/playerStatsAggregation.test.ts).
//
// Semantics encoded here (deliberate, see docs/reviews/06-stats-pipeline-findings.md):
//  - A "win" is credited per stats row whose team matches matches.winner_team_id.
//    Two-legged ties stamp the winner only on the leg-2 decider, so a won tie
//    counts as exactly one win; leg 1 (winner_team_id = null) never counts.
//  - Forfeit wins have no match_player_stats rows, so nobody is credited an
//    appearance or a win for them.
//  - Matches are counted by distinct match_id per player, regardless of
//    match status.
//  - primary_team_id = the team with the most appearances; ties resolve to the
//    team first encountered in row order (i.e. lowest stats-row id).
//  - own_goals are intentionally NOT aggregated into any per-player total.

export type MpsRow = {
  player_id: number;
  match_id: number;
  team_id: number;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
  mvp: boolean | null;
  best_goalkeeper: boolean | null;
};

export type CareerBucket = {
  total_matches: number;
  total_goals: number;
  total_assists: number;
  total_yellow_cards: number;
  total_red_cards: number;
  total_blue_cards: number;
  total_mvp: number;
  total_best_gk: number;
  total_wins: number;
  primary_team_id: number | null;
};

export type TournamentBucket = {
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp_count: number;
  best_gk_count: number;
  wins: number;
};

export type LegacyTotals = {
  total_goals: number;
  total_assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
};

const num = (v: number | null | undefined) => Number(v) || 0;

/** Split an array into chunks */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function zeroCareer(): CareerBucket {
  return {
    total_matches: 0,
    total_goals: 0,
    total_assists: 0,
    total_yellow_cards: 0,
    total_red_cards: 0,
    total_blue_cards: 0,
    total_mvp: 0,
    total_best_gk: 0,
    total_wins: 0,
    primary_team_id: null,
  };
}

function zeroTournament(): TournamentBucket {
  return {
    matches: 0,
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    blue_cards: 0,
    mvp_count: 0,
    best_gk_count: 0,
    wins: 0,
  };
}

/**
 * Aggregate career (all-time) buckets from stats rows.
 *
 * `seedPlayerIds` pre-seeds zero buckets: the incremental refresh passes the
 * affected player ids so a player whose last stats row was deleted gets an
 * explicit zero row (overwriting the stale cache) instead of being skipped.
 * The full rebuild omits it — players absent from `rows` are deleted instead.
 */
export function aggregateCareerBuckets(
  rows: MpsRow[],
  winnerByMatch: Map<number, number | null>,
  seedPlayerIds?: number[],
): Map<number, CareerBucket> {
  const statsMap = new Map<number, CareerBucket>();
  const matchesPerPlayer = new Map<number, Set<number>>();
  // per-player insertion-ordered team counts; first-seen team wins count ties
  const teamCounts = new Map<number, Map<number, number>>();

  for (const pid of seedPlayerIds ?? []) statsMap.set(pid, zeroCareer());

  for (const r of rows) {
    let s = statsMap.get(r.player_id);
    if (!s) {
      s = zeroCareer();
      statsMap.set(r.player_id, s);
    }

    if (!matchesPerPlayer.has(r.player_id)) matchesPerPlayer.set(r.player_id, new Set());
    matchesPerPlayer.get(r.player_id)!.add(r.match_id);

    if (!teamCounts.has(r.player_id)) teamCounts.set(r.player_id, new Map());
    const tc = teamCounts.get(r.player_id)!;
    tc.set(r.team_id, (tc.get(r.team_id) ?? 0) + 1);

    s.total_goals += num(r.goals);
    s.total_assists += num(r.assists);
    s.total_yellow_cards += num(r.yellow_cards);
    s.total_red_cards += num(r.red_cards);
    s.total_blue_cards += num(r.blue_cards);
    if (r.mvp) s.total_mvp += 1;
    if (r.best_goalkeeper) s.total_best_gk += 1;

    const winner = winnerByMatch.get(r.match_id);
    if (winner != null && winner === r.team_id) s.total_wins += 1;
  }

  for (const [pid, s] of statsMap) {
    s.total_matches = matchesPerPlayer.get(pid)?.size ?? 0;
    let maxMatches = 0;
    for (const [teamId, count] of teamCounts.get(pid) ?? []) {
      if (count > maxMatches) {
        maxMatches = count;
        s.primary_team_id = teamId;
      }
    }
  }

  return statsMap;
}

/**
 * Aggregate per-tournament buckets from stats rows ALREADY FILTERED to one
 * tournament's matches. Same seeding contract as aggregateCareerBuckets;
 * callers delete rows whose bucket ends up with 0 matches.
 */
export function aggregateTournamentBuckets(
  rows: MpsRow[],
  winnerByMatch: Map<number, number | null>,
  seedPlayerIds?: number[],
): Map<number, TournamentBucket> {
  const statsMap = new Map<number, TournamentBucket>();
  const matchesPerPlayer = new Map<number, Set<number>>();

  for (const pid of seedPlayerIds ?? []) statsMap.set(pid, zeroTournament());

  for (const r of rows) {
    let s = statsMap.get(r.player_id);
    if (!s) {
      s = zeroTournament();
      statsMap.set(r.player_id, s);
    }

    if (!matchesPerPlayer.has(r.player_id)) matchesPerPlayer.set(r.player_id, new Set());
    matchesPerPlayer.get(r.player_id)!.add(r.match_id);

    s.goals += num(r.goals);
    s.assists += num(r.assists);
    s.yellow_cards += num(r.yellow_cards);
    s.red_cards += num(r.red_cards);
    s.blue_cards += num(r.blue_cards);
    if (r.mvp) s.mvp_count += 1;
    if (r.best_goalkeeper) s.best_gk_count += 1;

    const winner = winnerByMatch.get(r.match_id);
    if (winner != null && winner === r.team_id) s.wins += 1;
  }

  for (const [pid, s] of statsMap) {
    s.matches = matchesPerPlayer.get(pid)?.size ?? 0;
  }

  return statsMap;
}

/** Aggregate the legacy player_statistics totals (goals/assists/cards only). */
export function aggregateLegacyTotals(
  rows: Pick<MpsRow, "player_id" | "goals" | "assists" | "yellow_cards" | "red_cards" | "blue_cards">[],
  seedPlayerIds?: number[],
): Map<number, LegacyTotals> {
  const totals = new Map<number, LegacyTotals>();

  const zero = (): LegacyTotals => ({
    total_goals: 0,
    total_assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    blue_cards: 0,
  });

  for (const pid of seedPlayerIds ?? []) totals.set(pid, zero());

  for (const r of rows) {
    let t = totals.get(r.player_id);
    if (!t) {
      t = zero();
      totals.set(r.player_id, t);
    }
    t.total_goals += num(r.goals);
    t.total_assists += num(r.assists);
    t.yellow_cards += num(r.yellow_cards);
    t.red_cards += num(r.red_cards);
    t.blue_cards += num(r.blue_cards);
  }

  return totals;
}
