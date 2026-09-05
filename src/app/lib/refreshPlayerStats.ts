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
  aggregateTournamentBuckets,
  aggregateLegacyTotals,
  chunk,
  type MpsRow,
} from "@/app/lib/playerStatsAggregation";
import { BATCH_SIZE, PAGE_SIZE, fetchAllRows, fetchInBatches } from "@/app/lib/supabasePaging";
import { getActiveSeason, getTournamentSeasonLabel } from "@/app/lib/seasons";
import { refreshAllSeasonStats, refreshSeasonStatsForPlayers } from "@/app/lib/refreshSeasonStats";

// Kept as a named export: dashboard/fix-stats imports it from here.
export { fetchAllRows };

const MPS_COLUMNS =
  "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper";

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

// ─── Public: refresh the per-tournament + per-season rows of some players ──
// The two stored tables a player's numbers live in (contract D3: the career
// table is retired). Season rows are refreshed ONLY when the tournament
// belongs to the active season; archived seasons are frozen and change only
// via an explicit re-snapshot (plans/seasonal-data-contract.md §4).

export async function refreshStatsForPlayersInTournament(
  playerIds: number[],
  tournamentId: number,
): Promise<void> {
  if (playerIds.length === 0) return;
  await refreshTournamentStatsForPlayers(playerIds, tournamentId);
  const [seasonLabel, active] = await Promise.all([
    getTournamentSeasonLabel(tournamentId),
    getActiveSeason(),
  ]);
  if (seasonLabel && active && seasonLabel === active.label) {
    await refreshSeasonStatsForPlayers(playerIds, seasonLabel);
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
  if (!match?.tournament_id) return;

  // 2. Get affected player IDs
  const { data: mpsRows } = await supabaseAdmin
    .from("match_player_stats")
    .select("player_id")
    .eq("match_id", matchId);

  const playerIds = [...new Set((mpsRows ?? []).map((r) => r.player_id))];
  if (playerIds.length === 0) return;

  // 3. Tournament + (active) season rows
  await refreshStatsForPlayersInTournament(playerIds, match.tournament_id);
}

// ─── Public: full backfill of ALL players ───────────────────────────
// Non-destructive: upserts recomputed rows first, then deletes only the rows
// that no longer have any source stats. Public readers never see an empty
// cache mid-rebuild (the previous delete-all-then-reinsert did exactly that,
// and a crash mid-run left the caches gutted until the next manual run).

export async function refreshAllPlayerStats(): Promise<{
  tournamentRows: number;
  mpsRowsProcessed: number;
  staleTournamentRowsDeleted: number;
  /** Active season that was rebuilt (null when no season is active). */
  seasonLabel: string | null;
  seasonRows: number;
  staleSeasonRowsDeleted: number;
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

  // 3. Aggregate tournament stats: group rows by tournament, then reuse the
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

  // 4. Upsert tournament stats, then delete stale (player, tournament) rows
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

  // 5. Season stats for the ACTIVE season only (the manual safety net covers
  //    the live season; archived seasons are re-snapshotted deliberately).
  const active = await getActiveSeason();
  let seasonRows = 0;
  let staleSeasonRowsDeleted = 0;
  if (active) {
    const r = await refreshAllSeasonStats(active.label);
    seasonRows = r.seasonRows;
    staleSeasonRowsDeleted = r.staleSeasonRowsDeleted;
  }

  return {
    tournamentRows: tourneyUpserts.length,
    mpsRowsProcessed: rows.length,
    staleTournamentRowsDeleted,
    seasonLabel: active?.label ?? null,
    seasonRows,
    staleSeasonRowsDeleted,
  };
}
