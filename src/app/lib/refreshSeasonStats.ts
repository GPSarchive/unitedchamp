// Server-only writer for player_season_stats (plans/seasonal-data-contract.md
// §2.1). Same contract as refreshPlayerStats.ts: no "use server", no auth of
// its own (callers hold it), aggregation math lives in
// playerStatsAggregation.ts, write failures THROW.
//
// Only the ACTIVE season is maintained live (refreshStatsForMatch calls
// refreshSeasonStatsForPlayers when the match's tournament belongs to it);
// an archived season changes only through an explicit re-snapshot, i.e. a
// deliberate call to refreshAllSeasonStats(label).
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  aggregateSeasonBuckets,
  chunk,
  type MpsRow,
  type SeasonBucket,
} from "@/app/lib/playerStatsAggregation";
import { BATCH_SIZE, PAGE_SIZE, fetchAllRows, fetchInBatches } from "@/app/lib/supabasePaging";
import { listTournamentIdsForSeason } from "@/app/lib/seasons";

const MPS_COLUMNS =
  "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper";

type MatchWinner = { id: number; winner_team_id: number | null };

/** Every match of every tournament assigned to `seasonLabel` (paginated). */
async function fetchSeasonMatches(seasonLabel: string): Promise<MatchWinner[]> {
  const tournamentIds = await listTournamentIdsForSeason(seasonLabel);
  if (tournamentIds.length === 0) return [];

  const out: MatchWinner[] = [];
  for (const batch of chunk(tournamentIds, BATCH_SIZE)) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("matches")
        .select("id, winner_team_id")
        .in("tournament_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading matches: ${error.message}`);
      if (!data || data.length === 0) break;
      out.push(...(data as MatchWinner[]));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return out;
}

async function upsertSeasonRows(
  seasonLabel: string,
  buckets: Map<number, SeasonBucket>,
): Promise<{ upserted: number; zeroed: number[] }> {
  const now = new Date().toISOString();
  const upserts = Array.from(buckets.entries())
    .filter(([, s]) => s.matches > 0)
    .map(([pid, s]) => ({
      player_id: pid,
      season_label: seasonLabel,
      ...s,
      updated_at: now,
    }));
  const zeroed = Array.from(buckets.entries())
    .filter(([, s]) => s.matches === 0)
    .map(([pid]) => pid);

  for (const batch of chunk(upserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_season_stats")
      .upsert(batch, { onConflict: "player_id,season_label" });
    if (error) throw new Error(`Failed upserting player_season_stats: ${error.message}`);
  }
  return { upserted: upserts.length, zeroed };
}

async function deleteSeasonRows(seasonLabel: string, playerIds: number[]): Promise<void> {
  for (const batch of chunk(playerIds, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("player_season_stats")
      .delete()
      .eq("season_label", seasonLabel)
      .in("player_id", batch);
    if (error) throw new Error(`Failed deleting player_season_stats: ${error.message}`);
  }
}

// ─── Incremental: refresh one season's rows for a set of players ─────────

export async function refreshSeasonStatsForPlayers(
  playerIds: number[],
  seasonLabel: string,
): Promise<void> {
  if (playerIds.length === 0) return;

  const seasonMatches = await fetchSeasonMatches(seasonLabel);
  const winnerByMatch = new Map(seasonMatches.map((m) => [m.id, m.winner_team_id]));

  // Rows for these players, restricted to this season's matches. Fetched by
  // player so each player's rows arrive in id order (primary-team tie-break).
  let mpsRows: MpsRow[] = [];
  if (seasonMatches.length > 0) {
    const all = await fetchInBatches<MpsRow>("match_player_stats", "player_id", playerIds, MPS_COLUMNS);
    mpsRows = all.filter((r) => winnerByMatch.has(r.match_id));
  }

  // Seeded so a player whose season rows were all deleted gets a 0-match
  // bucket → row deleted (not left stale).
  const buckets = aggregateSeasonBuckets(mpsRows, winnerByMatch, playerIds);
  const { zeroed } = await upsertSeasonRows(seasonLabel, buckets);
  if (zeroed.length > 0) await deleteSeasonRows(seasonLabel, zeroed);
}

// ─── Full rebuild of one season (backfill / close / re-snapshot) ──────────
// Non-destructive: upsert recomputed rows first, then delete only the rows of
// this season that no longer have source stats.

export async function refreshAllSeasonStats(seasonLabel: string): Promise<{
  seasonLabel: string;
  matches: number;
  mpsRowsProcessed: number;
  seasonRows: number;
  staleSeasonRowsDeleted: number;
}> {
  const seasonMatches = await fetchSeasonMatches(seasonLabel);
  const winnerByMatch = new Map(seasonMatches.map((m) => [m.id, m.winner_team_id]));

  // Fetched by match id in batches, so sort by stats-row id afterwards: the
  // primary-team tie-break is "first team seen in row order" and must equal
  // the career/global-id-order result (Phase 1 acceptance: season == career).
  type MpsRowWithId = MpsRow & { id: number };
  const rows = await fetchInBatches<MpsRowWithId>(
    "match_player_stats",
    "match_id",
    seasonMatches.map((m) => m.id),
    `id, ${MPS_COLUMNS}`,
  );
  rows.sort((a, b) => a.id - b.id);

  const buckets = aggregateSeasonBuckets(rows, winnerByMatch);
  const { upserted } = await upsertSeasonRows(seasonLabel, buckets);

  const existing = await fetchAllRows<{ player_id: number }>(
    "player_season_stats",
    "player_id",
    "player_id",
    { column: "season_label", value: seasonLabel },
  );
  const stale = existing.map((r) => r.player_id).filter((pid) => !buckets.has(pid));
  if (stale.length > 0) await deleteSeasonRows(seasonLabel, stale);

  return {
    seasonLabel,
    matches: seasonMatches.length,
    mpsRowsProcessed: rows.length,
    seasonRows: upserted,
    staleSeasonRowsDeleted: stale.length,
  };
}
