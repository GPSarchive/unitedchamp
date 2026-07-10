// Server-only stat-cache rebuilders. Deliberately NOT "use server": these run
// with the service-role client and carry no auth checks of their own, so they
// must not be compiled into publicly invokable Server Action endpoints. Auth
// lives in the routes/actions that call them.
//
// All aggregation math lives in playerStatsAggregation.ts (pure, unit-tested);
// this module only does the I/O around it. Write failures THROW — callers
// already wrap these functions in try/catch and must not report success when
// a cache write was dropped.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  aggregateCareerBuckets,
  aggregateTournamentBuckets,
  aggregateLegacyTotals,
  chunk,
  type MpsRow,
} from "@/app/lib/playerStatsAggregation";

const BATCH_SIZE = 300;

// PostgREST caps every response at ~1000 rows (server max-rows setting); a
// large .limit() does NOT override it. All reads here must paginate.
const PAGE_SIZE = 500;

const MPS_COLUMNS =
  "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper";

/** Fetch all rows matching `idColumn IN ids`, paginating past the row cap */
async function fetchInBatches<T>(
  table: string,
  idColumn: string,
  ids: number[],
  selectColumns: string,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (const batch of chunk(ids, BATCH_SIZE)) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(selectColumns)
        .in(idColumn, batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
      if (!data || data.length === 0) break;
      out.push(...(data as T[]));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return out;
}

// ─── Core: refresh career stats for a set of players ────────────────

export async function refreshCareerStatsForPlayers(playerIds: number[]) {
  if (playerIds.length === 0) return;

  // 1. Fetch all match_player_stats for these players
  const allMps = await fetchInBatches<MpsRow>(
    "match_player_stats",
    "player_id",
    playerIds,
    MPS_COLUMNS,
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

  // 3. Aggregate (seeding zero buckets so players whose stats were all deleted
  //    get their stale cache row overwritten with zeroes)
  const statsMap = aggregateCareerBuckets(allMps, winnerByMatch, playerIds);

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
    if (error) throw new Error(`Failed upserting player_career_stats: ${error.message}`);
  }
}

// ─── Core: refresh tournament stats for a set of players ────────────

export async function refreshTournamentStatsForPlayers(
  playerIds: number[],
  tournamentId: number,
) {
  if (playerIds.length === 0) return;

  // 1. Get matches for this tournament (paginated — a busy tournament can
  //    exceed the PostgREST row cap)
  const tournamentMatches: { id: number; winner_team_id: number | null }[] = [];
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("matches")
        .select("id, winner_team_id")
        .eq("tournament_id", tournamentId)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading matches: ${error.message}`);
      if (!data || data.length === 0) break;
      tournamentMatches.push(...(data as typeof tournamentMatches));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  const winnerByMatch = new Map(tournamentMatches.map((m) => [m.id, m.winner_team_id]));

  // 2. Get match_player_stats for these players in these tournament matches
  let mpsRows: MpsRow[] = [];
  if (tournamentMatches.length > 0) {
    // We need rows where player_id IN playerIds AND match_id IN tMatchIds
    // Fetch by player, then filter by match
    const allRows = await fetchInBatches<MpsRow>(
      "match_player_stats",
      "player_id",
      playerIds,
      MPS_COLUMNS,
    );
    mpsRows = allRows.filter((r) => winnerByMatch.has(r.match_id));
  }

  // 3. Aggregate
  const statsMap = aggregateTournamentBuckets(mpsRows, winnerByMatch, playerIds);

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

  for (const batch of chunk(upserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_tournament_stats")
      .upsert(batch, { onConflict: "player_id,tournament_id" });
    if (error) throw new Error(`Failed upserting player_tournament_stats: ${error.message}`);
  }

  if (deleteIds.length > 0) {
    for (const batch of chunk(deleteIds, BATCH_SIZE)) {
      const { error } = await supabaseAdmin
        .from("player_tournament_stats")
        .delete()
        .in("player_id", batch)
        .eq("tournament_id", tournamentId);
      if (error) throw new Error(`Failed deleting player_tournament_stats: ${error.message}`);
    }
  }
}

// ─── Core: sync the legacy player_statistics table for a set of players ──
// Recomputes all-time totals from match_player_stats (paginated) and upserts.
// Players left with no stats rows get zeroed, not deleted.

export async function syncPlayerStatisticsForPlayers(playerIds: number[]) {
  if (playerIds.length === 0) return;

  const rows = await fetchInBatches<MpsRow>(
    "match_player_stats",
    "player_id",
    playerIds,
    "player_id, goals, assists, yellow_cards, red_cards, blue_cards",
  );

  const totals = aggregateLegacyTotals(rows, playerIds);

  const upserts = Array.from(totals.entries()).map(([pid, t]) => ({ player_id: pid, ...t }));
  for (const batch of chunk(upserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_statistics")
      .upsert(batch, { onConflict: "player_id" });
    if (error) throw new Error(`Failed upserting player_statistics: ${error.message}`);
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

export async function fetchAllRows<T>(
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
// Non-destructive: upserts recomputed rows first, then deletes only the rows
// that no longer have any source stats. Public readers never see an empty
// cache mid-rebuild (the previous delete-all-then-reinsert did exactly that,
// and a crash mid-run left the caches gutted until the next manual run).

export async function refreshAllPlayerStats(): Promise<{
  careerRows: number;
  tournamentRows: number;
  mpsRowsProcessed: number;
  staleCareerRowsDeleted: number;
  staleTournamentRowsDeleted: number;
}> {
  // 1. Paginate through ALL match_player_stats rows
  const rows = await fetchAllRows<MpsRow>("match_player_stats", MPS_COLUMNS);

  // 2. Get ALL matches (for tournament_id + winner) — via batched ID lookup
  const matchIds = [...new Set(rows.map((r) => r.match_id))];
  const matchRows = await fetchInBatches<{
    id: number;
    tournament_id: number | null;
    winner_team_id: number | null;
  }>("matches", "id", matchIds, "id, tournament_id, winner_team_id");

  const matchInfo = new Map(matchRows.map((m) => [m.id, m]));
  const winnerByMatch = new Map(matchRows.map((m) => [m.id, m.winner_team_id]));

  // 3. Aggregate career stats (same pure function the incremental path uses)
  const careerMap = aggregateCareerBuckets(rows, winnerByMatch);

  // 4. Aggregate tournament stats: group rows by tournament, then reuse the
  //    per-tournament aggregator
  const rowsByTournament = new Map<number, MpsRow[]>();
  for (const r of rows) {
    const tid = matchInfo.get(r.match_id)?.tournament_id;
    if (!tid) continue;
    if (!rowsByTournament.has(tid)) rowsByTournament.set(tid, []);
    rowsByTournament.get(tid)!.push(r);
  }

  const tourneyUpserts: Record<string, unknown>[] = [];
  const liveTourneyKeys = new Set<string>();
  for (const [tid, tRows] of rowsByTournament) {
    const buckets = aggregateTournamentBuckets(tRows, winnerByMatch);
    for (const [pid, s] of buckets) {
      if (s.matches === 0) continue;
      liveTourneyKeys.add(`${pid}:${tid}`);
      tourneyUpserts.push({
        player_id: pid,
        tournament_id: tid,
        ...s,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // 5. Upsert career stats, then delete rows for players with no stats left
  const careerUpserts = Array.from(careerMap.entries()).map(([pid, s]) => ({
    player_id: pid,
    ...s,
    updated_at: new Date().toISOString(),
  }));

  for (const batch of chunk(careerUpserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_career_stats")
      .upsert(batch, { onConflict: "player_id" });
    if (error) throw new Error(`Failed upserting player_career_stats: ${error.message}`);
  }

  const existingCareerIds = await fetchAllRows<{ player_id: number }>(
    "player_career_stats",
    "player_id",
    "player_id",
  );
  const staleCareerIds = existingCareerIds
    .map((r) => r.player_id)
    .filter((pid) => !careerMap.has(pid));

  for (const batch of chunk(staleCareerIds, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_career_stats")
      .delete()
      .in("player_id", batch);
    if (error) throw new Error(`Failed deleting stale player_career_stats: ${error.message}`);
  }

  // 6. Upsert tournament stats, then delete stale (player, tournament) rows
  for (const batch of chunk(tourneyUpserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_tournament_stats")
      .upsert(batch, { onConflict: "player_id,tournament_id" });
    if (error) throw new Error(`Failed upserting player_tournament_stats: ${error.message}`);
  }

  // player_tournament_stats has a composite PK, so paginate with a stable
  // two-column order (a single non-unique order column can skip/dup rows
  // across pages)
  const existingTourneyKeys: { player_id: number; tournament_id: number }[] = [];
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("player_tournament_stats")
        .select("player_id, tournament_id")
        .order("player_id", { ascending: true })
        .order("tournament_id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading player_tournament_stats: ${error.message}`);
      if (!data || data.length === 0) break;
      existingTourneyKeys.push(...(data as typeof existingTourneyKeys));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  const staleByTournament = new Map<number, number[]>();
  for (const k of existingTourneyKeys) {
    if (liveTourneyKeys.has(`${k.player_id}:${k.tournament_id}`)) continue;
    if (!staleByTournament.has(k.tournament_id)) staleByTournament.set(k.tournament_id, []);
    staleByTournament.get(k.tournament_id)!.push(k.player_id);
  }

  let staleTournamentRowsDeleted = 0;
  for (const [tid, pids] of staleByTournament) {
    for (const batch of chunk(pids, BATCH_SIZE)) {
      const { error } = await supabaseAdmin
        .from("player_tournament_stats")
        .delete()
        .eq("tournament_id", tid)
        .in("player_id", batch);
      if (error) throw new Error(`Failed deleting stale player_tournament_stats: ${error.message}`);
      staleTournamentRowsDeleted += batch.length;
    }
  }

  return {
    careerRows: careerUpserts.length,
    tournamentRows: tourneyUpserts.length,
    mpsRowsProcessed: rows.length,
    staleCareerRowsDeleted: staleCareerIds.length,
    staleTournamentRowsDeleted,
  };
}
