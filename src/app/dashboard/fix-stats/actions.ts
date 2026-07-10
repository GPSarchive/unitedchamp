"use server";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/refreshPlayerStats";
import { aggregateLegacyTotals, chunk, type LegacyTotals } from "@/app/lib/playerStatsAggregation";
import { revalidatePath } from "next/cache";

const BATCH_SIZE = 300;

export async function applySyncFix() {
  // 1. Aggregate all-time stats from match_player_stats.
  //    Paginated: a plain .select() is capped at ~1000 rows by PostgREST and
  //    would silently write truncated (undercounted) totals.
  const mpsRows = await fetchAllRows<{
    player_id: number;
    goals: number | null;
    assists: number | null;
    yellow_cards: number | null;
    red_cards: number | null;
    blue_cards: number | null;
  }>("match_player_stats", "player_id, goals, assists, yellow_cards, red_cards, blue_cards");

  const totals = aggregateLegacyTotals(mpsRows);

  // 2. Players that have a player_statistics row but no source stats anymore
  //    get zeroed (not deleted) — in ONE upsert pass with everyone else.
  //    The previous implementation zeroed ALL rows first and re-upserted after,
  //    which briefly published all-zero totals to public readers and, on a
  //    crash between the two steps, left them that way.
  const existingRows = await fetchAllRows<{ player_id: number }>(
    "player_statistics",
    "player_id",
    "player_id",
  );
  for (const r of existingRows) {
    if (!totals.has(r.player_id)) {
      totals.set(r.player_id, {
        total_goals: 0,
        total_assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
      } satisfies LegacyTotals);
    }
  }

  // 3. Upsert recalculated values (batched to avoid payload limits)
  const upserts = Array.from(totals.entries()).map(([pid, t]) => ({
    player_id: pid,
    ...t,
  }));

  for (const batch of chunk(upserts, BATCH_SIZE)) {
    const { error: upsertErr } = await supabaseAdmin
      .from("player_statistics")
      .upsert(batch, { onConflict: "player_id" });
    if (upsertErr) throw new Error(`Failed to upsert player_statistics: ${upsertErr.message}`);
  }

  revalidatePath("/dashboard/fix-stats");
  revalidatePath("/paiktes");
  revalidatePath("/"); // home top-players section reads player_statistics

  return { updated: upserts.length };
}
