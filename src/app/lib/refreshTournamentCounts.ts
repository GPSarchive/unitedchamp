"use server";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

/**
 * Recompute and persist teams_count / matches_count for a single tournament.
 * Uses two COUNT queries then a single UPDATE.
 */
export async function refreshTournamentCounts(tournamentId: number) {
  // Distinct team count (a team can appear in multiple group stages)
  const { data: teamRows } = await supabaseAdmin
    .from("tournament_teams")
    .select("team_id")
    .eq("tournament_id", tournamentId);

  const teamsCount = new Set((teamRows ?? []).map((r: any) => r.team_id)).size;

  const { count: matchesCount } = await supabaseAdmin
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const { error } = await supabaseAdmin
    .from("tournaments")
    .update({
      teams_count: teamsCount,
      matches_count: matchesCount ?? 0,
    })
    .eq("id", tournamentId);

  if (error) {
    console.error("[refreshTournamentCounts] update error:", error.message);
  }
}

/**
 * Backfill teams_count / matches_count for ALL tournaments.
 * Returns the number of tournaments updated.
 */
export async function refreshAllTournamentCounts(): Promise<number> {
  // Fetch all tournament IDs
  const { data: tournaments, error: fetchErr } = await supabaseAdmin
    .from("tournaments")
    .select("id")
    .order("id", { ascending: true });

  if (fetchErr || !tournaments) {
    console.error("[refreshAllTournamentCounts] fetch error:", fetchErr?.message);
    return 0;
  }

  for (const t of tournaments) {
    await refreshTournamentCounts(t.id);
  }

  return tournaments.length;
}
