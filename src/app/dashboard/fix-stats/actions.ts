"use server";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/refreshPlayerStats";
import { revalidatePath } from "next/cache";

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

  const totals = new Map<
    number,
    {
      total_goals: number;
      total_assists: number;
      yellow_cards: number;
      red_cards: number;
      blue_cards: number;
    }
  >();

  for (const r of mpsRows) {
    if (!totals.has(r.player_id)) {
      totals.set(r.player_id, {
        total_goals: 0,
        total_assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
      });
    }
    const t = totals.get(r.player_id)!;
    t.total_goals += Number(r.goals) || 0;
    t.total_assists += Number(r.assists) || 0;
    t.yellow_cards += Number(r.yellow_cards) || 0;
    t.red_cards += Number(r.red_cards) || 0;
    t.blue_cards += Number(r.blue_cards) || 0;
  }

  // 2. Zero out all existing player_statistics (for players with no match entries)
  const { error: resetErr } = await supabaseAdmin
    .from("player_statistics")
    .update({
      total_goals: 0,
      total_assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      blue_cards: 0,
    })
    .gte("player_id", 0); // matches all rows

  if (resetErr) throw new Error(`Failed to reset player_statistics: ${resetErr.message}`);

  // 3. Upsert recalculated values
  if (totals.size > 0) {
    const upserts = Array.from(totals.entries()).map(([pid, t]) => ({
      player_id: pid,
      ...t,
    }));

    const { error: upsertErr } = await supabaseAdmin
      .from("player_statistics")
      .upsert(upserts, { onConflict: "player_id" });

    if (upsertErr) throw new Error(`Failed to upsert player_statistics: ${upsertErr.message}`);
  }

  revalidatePath("/dashboard/fix-stats");
  revalidatePath("/paiktes");

  return { updated: totals.size };
}
