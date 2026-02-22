"use server";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

const BATCH_SIZE = 300;

/** Split an array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Fetch rows in batches to avoid Supabase's 1000-row default limit */
async function fetchInBatches<T>(
  table: string,
  idColumn: string,
  ids: number[],
  selectColumns: string,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results = await Promise.all(
    chunk(ids, BATCH_SIZE).map((batch) =>
      supabaseAdmin
        .from(table)
        .select(selectColumns)
        .in(idColumn, batch)
        .limit(10000)
        .then(({ data }) => (data ?? []) as T[]),
    ),
  );
  return results.flat();
}

// ─── Types ──────────────────────────────────────────────────────────

type MpsRow = {
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

type CareerBucket = {
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

type TournamentBucket = {
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

// ─── Core: refresh career stats for a set of players ────────────────

export async function refreshCareerStatsForPlayers(playerIds: number[]) {
  if (playerIds.length === 0) return;

  // 1. Fetch all match_player_stats for these players
  const allMps = await fetchInBatches<MpsRow>(
    "match_player_stats",
    "player_id",
    playerIds,
    "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper",
  );

  // 2. Fetch match winners for those matches
  const matchIds = [...new Set(allMps.map((r) => r.match_id))];
  const winnerRows = await fetchInBatches<{ id: number; winner_team_id: number | null }>(
    "matches",
    "id",
    matchIds,
    "id, winner_team_id",
  );
  const winnerByMatch = new Map(winnerRows.map((m) => [m.id, m.winner_team_id]));

  // 3. Aggregate
  const statsMap = new Map<number, CareerBucket>();
  const matchesPerPlayer = new Map<number, Set<number>>();
  const matchesPerPlayerTeam = new Map<string, number>();

  // Initialize all players with zeroes (handles players whose stats were deleted)
  for (const pid of playerIds) {
    statsMap.set(pid, {
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
    });
  }

  for (const r of allMps) {
    const s = statsMap.get(r.player_id)!;

    // Unique matches
    if (!matchesPerPlayer.has(r.player_id)) matchesPerPlayer.set(r.player_id, new Set());
    matchesPerPlayer.get(r.player_id)!.add(r.match_id);

    // Matches per (player, team) for primary team calc
    const ptKey = `${r.player_id}:${r.team_id}`;
    matchesPerPlayerTeam.set(ptKey, (matchesPerPlayerTeam.get(ptKey) ?? 0) + 1);

    s.total_goals += r.goals ?? 0;
    s.total_assists += r.assists ?? 0;
    s.total_yellow_cards += r.yellow_cards ?? 0;
    s.total_red_cards += r.red_cards ?? 0;
    s.total_blue_cards += r.blue_cards ?? 0;
    if (r.mvp) s.total_mvp += 1;
    if (r.best_goalkeeper) s.total_best_gk += 1;

    const winner = winnerByMatch.get(r.match_id);
    if (winner != null && winner === r.team_id) s.total_wins += 1;
  }

  // Set match counts + primary team
  for (const pid of playerIds) {
    const s = statsMap.get(pid)!;
    s.total_matches = matchesPerPlayer.get(pid)?.size ?? 0;

    // Primary team = team with the most match appearances
    let maxMatches = 0;
    for (const [key, count] of matchesPerPlayerTeam) {
      if (key.startsWith(`${pid}:`) && count > maxMatches) {
        maxMatches = count;
        s.primary_team_id = Number(key.split(":")[1]);
      }
    }
  }

  // 4. Upsert
  const upserts = Array.from(statsMap.entries()).map(([pid, s]) => ({
    player_id: pid,
    ...s,
    updated_at: new Date().toISOString(),
  }));

  // Batch upserts to avoid payload size limits
  for (const batch of chunk(upserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_career_stats")
      .upsert(batch, { onConflict: "player_id" });
    if (error) console.error("[refreshCareerStats] upsert error:", error.message);
  }
}

// ─── Core: refresh tournament stats for a set of players ────────────

export async function refreshTournamentStatsForPlayers(
  playerIds: number[],
  tournamentId: number,
) {
  if (playerIds.length === 0) return;

  // 1. Get matches for this tournament
  const { data: tournamentMatches } = await supabaseAdmin
    .from("matches")
    .select("id, winner_team_id")
    .eq("tournament_id", tournamentId);

  const tMatchIds = (tournamentMatches ?? []).map((m) => m.id as number);
  const winnerByMatch = new Map(
    (tournamentMatches ?? []).map((m) => [m.id as number, m.winner_team_id as number | null]),
  );

  // 2. Get match_player_stats for these players in these tournament matches
  let mpsRows: MpsRow[] = [];
  if (tMatchIds.length > 0) {
    // We need rows where player_id IN playerIds AND match_id IN tMatchIds
    // Fetch by player, then filter by match
    const allRows = await fetchInBatches<MpsRow>(
      "match_player_stats",
      "player_id",
      playerIds,
      "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper",
    );
    const tMatchSet = new Set(tMatchIds);
    mpsRows = allRows.filter((r) => tMatchSet.has(r.match_id));
  }

  // 3. Aggregate
  const statsMap = new Map<number, TournamentBucket>();
  const matchesPerPlayer = new Map<number, Set<number>>();

  for (const pid of playerIds) {
    statsMap.set(pid, {
      matches: 0,
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      blue_cards: 0,
      mvp_count: 0,
      best_gk_count: 0,
      wins: 0,
    });
  }

  for (const r of mpsRows) {
    const s = statsMap.get(r.player_id);
    if (!s) continue;

    if (!matchesPerPlayer.has(r.player_id)) matchesPerPlayer.set(r.player_id, new Set());
    matchesPerPlayer.get(r.player_id)!.add(r.match_id);

    s.goals += r.goals ?? 0;
    s.assists += r.assists ?? 0;
    s.yellow_cards += r.yellow_cards ?? 0;
    s.red_cards += r.red_cards ?? 0;
    s.blue_cards += r.blue_cards ?? 0;
    if (r.mvp) s.mvp_count += 1;
    if (r.best_goalkeeper) s.best_gk_count += 1;

    const winner = winnerByMatch.get(r.match_id);
    if (winner != null && winner === r.team_id) s.wins += 1;
  }

  for (const pid of playerIds) {
    const s = statsMap.get(pid)!;
    s.matches = matchesPerPlayer.get(pid)?.size ?? 0;
  }

  // 4. Upsert rows with stats, delete rows with 0 matches (after revert)
  const upserts = Array.from(statsMap.entries())
    .filter(([, s]) => s.matches > 0)
    .map(([pid, s]) => ({
      player_id: pid,
      tournament_id: tournamentId,
      ...s,
      updated_at: new Date().toISOString(),
    }));

  const deleteIds = Array.from(statsMap.entries())
    .filter(([, s]) => s.matches === 0)
    .map(([pid]) => pid);

  if (upserts.length > 0) {
    for (const batch of chunk(upserts, BATCH_SIZE)) {
      const { error } = await supabaseAdmin
        .from("player_tournament_stats")
        .upsert(batch, { onConflict: "player_id,tournament_id" });
      if (error) console.error("[refreshTournamentStats] upsert error:", error.message);
    }
  }

  if (deleteIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("player_tournament_stats")
      .delete()
      .in("player_id", deleteIds)
      .eq("tournament_id", tournamentId);
    if (error) console.error("[refreshTournamentStats] delete error:", error.message);
  }
}

// ─── Public: refresh stats for all players involved in a single match ──

export async function refreshStatsForMatch(matchId: number) {
  // 1. Get match info
  const { data: match } = await supabaseAdmin
    .from("matches")
    .select("id, tournament_id")
    .eq("id", matchId)
    .single();
  if (!match) return;

  // 2. Get affected player IDs
  const { data: mpsRows } = await supabaseAdmin
    .from("match_player_stats")
    .select("player_id")
    .eq("match_id", matchId);

  const playerIds = [...new Set((mpsRows ?? []).map((r) => r.player_id))];
  if (playerIds.length === 0) return;

  // 3. Refresh career stats
  await refreshCareerStatsForPlayers(playerIds);

  // 4. Refresh tournament stats (if match belongs to a tournament)
  if (match.tournament_id) {
    await refreshTournamentStatsForPlayers(playerIds, match.tournament_id);
  }
}

// ─── Helper: paginate through an entire table ───────────────────────
// Supabase PostgREST caps responses at ~1000 rows (server max-rows setting).
// A single .limit(100000) does NOT override this. We must paginate with .range().

const PAGE_SIZE = 500;

async function fetchAllRows<T>(
  table: string,
  selectColumns: string,
  orderColumn = "id",
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(selectColumns)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }
  return all;
}

// ─── Public: full backfill of ALL players ───────────────────────────

export async function refreshAllPlayerStats(): Promise<{
  careerRows: number;
  tournamentRows: number;
  mpsRowsProcessed: number;
}> {
  // 1. Paginate through ALL match_player_stats rows
  const rows = await fetchAllRows<MpsRow>(
    "match_player_stats",
    "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper",
  );

  // 2. Get ALL matches (for tournament_id + winner) — via batched ID lookup
  const matchIds = [...new Set(rows.map((r) => r.match_id))];
  const matchRows = await fetchInBatches<{
    id: number;
    tournament_id: number | null;
    winner_team_id: number | null;
  }>("matches", "id", matchIds, "id, tournament_id, winner_team_id");

  const matchInfo = new Map(matchRows.map((m) => [m.id, m]));

  // 3. Aggregate career stats
  const careerMap = new Map<number, CareerBucket>();
  const matchesPerPlayer = new Map<number, Set<number>>();
  const matchesPerPlayerTeam = new Map<string, number>();

  for (const r of rows) {
    if (!careerMap.has(r.player_id)) {
      careerMap.set(r.player_id, {
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
      });
    }
    const s = careerMap.get(r.player_id)!;

    if (!matchesPerPlayer.has(r.player_id)) matchesPerPlayer.set(r.player_id, new Set());
    matchesPerPlayer.get(r.player_id)!.add(r.match_id);

    const ptKey = `${r.player_id}:${r.team_id}`;
    matchesPerPlayerTeam.set(ptKey, (matchesPerPlayerTeam.get(ptKey) ?? 0) + 1);

    s.total_goals += r.goals ?? 0;
    s.total_assists += r.assists ?? 0;
    s.total_yellow_cards += r.yellow_cards ?? 0;
    s.total_red_cards += r.red_cards ?? 0;
    s.total_blue_cards += r.blue_cards ?? 0;
    if (r.mvp) s.total_mvp += 1;
    if (r.best_goalkeeper) s.total_best_gk += 1;

    const mi = matchInfo.get(r.match_id);
    if (mi?.winner_team_id != null && mi.winner_team_id === r.team_id) s.total_wins += 1;
  }

  for (const [pid, s] of careerMap) {
    s.total_matches = matchesPerPlayer.get(pid)?.size ?? 0;
    let maxMatches = 0;
    for (const [key, count] of matchesPerPlayerTeam) {
      if (key.startsWith(`${pid}:`) && count > maxMatches) {
        maxMatches = count;
        s.primary_team_id = Number(key.split(":")[1]);
      }
    }
  }

  // 4. Aggregate tournament stats
  const tourneyKey = (pid: number, tid: number) => `${pid}:${tid}`;
  const tourneyMap = new Map<string, TournamentBucket & { player_id: number; tournament_id: number }>();
  const tourneyMatchesPerPlayer = new Map<string, Set<number>>();

  for (const r of rows) {
    const mi = matchInfo.get(r.match_id);
    if (!mi?.tournament_id) continue;
    const tid = mi.tournament_id;
    const key = tourneyKey(r.player_id, tid);

    if (!tourneyMap.has(key)) {
      tourneyMap.set(key, {
        player_id: r.player_id,
        tournament_id: tid,
        matches: 0,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
        mvp_count: 0,
        best_gk_count: 0,
        wins: 0,
      });
    }
    const s = tourneyMap.get(key)!;

    if (!tourneyMatchesPerPlayer.has(key)) tourneyMatchesPerPlayer.set(key, new Set());
    tourneyMatchesPerPlayer.get(key)!.add(r.match_id);

    s.goals += r.goals ?? 0;
    s.assists += r.assists ?? 0;
    s.yellow_cards += r.yellow_cards ?? 0;
    s.red_cards += r.red_cards ?? 0;
    s.blue_cards += r.blue_cards ?? 0;
    if (r.mvp) s.mvp_count += 1;
    if (r.best_goalkeeper) s.best_gk_count += 1;

    if (mi.winner_team_id != null && mi.winner_team_id === r.team_id) s.wins += 1;
  }

  for (const [key, s] of tourneyMap) {
    s.matches = tourneyMatchesPerPlayer.get(key)?.size ?? 0;
  }

  // 5. Clear and upsert career stats
  await supabaseAdmin.from("player_career_stats").delete().gte("player_id", 0);

  const careerUpserts = Array.from(careerMap.entries()).map(([pid, s]) => ({
    player_id: pid,
    ...s,
    updated_at: new Date().toISOString(),
  }));

  for (const batch of chunk(careerUpserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_career_stats")
      .upsert(batch, { onConflict: "player_id" });
    if (error) console.error("[backfill career] upsert error:", error.message);
  }

  // 6. Clear and upsert tournament stats
  await supabaseAdmin.from("player_tournament_stats").delete().gte("player_id", 0);

  const tourneyUpserts = Array.from(tourneyMap.values()).map((s) => ({
    ...s,
    updated_at: new Date().toISOString(),
  }));

  for (const batch of chunk(tourneyUpserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_tournament_stats")
      .upsert(batch, { onConflict: "player_id,tournament_id" });
    if (error) console.error("[backfill tournament] upsert error:", error.message);
  }

  return {
    careerRows: careerUpserts.length,
    tournamentRows: tourneyUpserts.length,
    mpsRowsProcessed: rows.length,
  };
}
