// Active-season numbers for a set of players, for admin APIs that list
// players. Reads the stored player_season_stats rows (no aggregation) for
// the ACTIVE season only; older seasons are reached through /dashboard/seasons
// and the public /seasons archive.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeason } from "@/app/lib/seasons";
import { chunk } from "@/app/lib/playerStatsAggregation";
import type { PlayerSeasonStatsRow } from "@/app/lib/types";

export type ActiveSeasonLite = { label: string; display_label: string } | null;

const COLUMNS =
  "player_id, season_label, matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins, primary_team_id, updated_at";

/**
 * { active, byPlayer }: byPlayer has an entry only for players with a stats
 * row in the active season; callers treat a miss as "no appearances".
 */
export async function loadActiveSeasonStatsByPlayer(
  playerIds: Iterable<number>,
): Promise<{ active: ActiveSeasonLite; byPlayer: Map<number, PlayerSeasonStatsRow> }> {
  const byPlayer = new Map<number, PlayerSeasonStatsRow>();
  const active = await getActiveSeason();
  if (!active) return { active: null, byPlayer };

  const ids = [...new Set([...playerIds].filter((x) => Number.isInteger(x) && x > 0))];
  for (const batch of chunk(ids, 300)) {
    const { data, error } = await supabaseAdmin
      .from("player_season_stats")
      .select(COLUMNS)
      .eq("season_label", active.label)
      .in("player_id", batch);
    if (error) throw new Error(`Failed reading player_season_stats: ${error.message}`);
    for (const r of data ?? []) {
      const { player_id, ...rest } = r as PlayerSeasonStatsRow & { player_id: number };
      byPlayer.set(player_id, rest);
    }
  }
  return { active: { label: active.label, display_label: active.display_label }, byPlayer };
}

/** Attach season_stats (or null) to each row that has an id. */
export async function withActiveSeasonStats<T extends { id: number }>(
  rows: T[],
): Promise<{ active: ActiveSeasonLite; rows: (T & { season_stats: PlayerSeasonStatsRow | null })[] }> {
  const { active, byPlayer } = await loadActiveSeasonStatsByPlayer(rows.map((r) => r.id));
  return {
    active,
    rows: rows.map((r) => ({ ...r, season_stats: byPlayer.get(r.id) ?? null })),
  };
}
