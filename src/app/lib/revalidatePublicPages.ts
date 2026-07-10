import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Central ISR invalidation for the public site.
 *
 * Public pages are ISR-cached (home 300s, matches/tournaments/teams 60s, …).
 * Those windows are the fallback, not the contract: any admin mutation that
 * changes match/tournament/stats data must call one of these so the public
 * pages regenerate on the next request instead of serving a stale snapshot.
 */

/** Every public surface that renders a specific match's data. */
export function revalidateMatchSurfaces(match: {
  id: number | string;
  tournament_id?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  /** pass when a PATCH moved the match to different teams */
  previous_team_ids?: Array<number | null | undefined>;
}) {
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath(`/matches/${match.id}`);
  revalidatePath("/geniki-katataxi");
  revalidatePath("/paiktes");
  if (match.tournament_id != null) revalidateTournamentSurfaces(match.tournament_id);
  const teamIds = new Set(
    [match.team_a_id, match.team_b_id, ...(match.previous_team_ids ?? [])].filter(
      (t): t is number => t != null
    )
  );
  for (const teamId of teamIds) revalidatePath(`/OMADA/${teamId}`);
}

/** The tournament detail routes (all three variants render the same loader). */
export function revalidateTournamentSurfaces(tournamentId: number | string) {
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/v2`);
  revalidatePath(`/tournaments/${tournamentId}/v2-dark`);
}

/** Surfaces that render player aggregate stats (leaderboards, home top players). */
export function revalidatePlayerStatSurfaces() {
  revalidatePath("/");
  revalidatePath("/paiktes");
}

/** Surfaces that render a team's name/logo/score prominently. Tournament pages
 *  also show team names but are left to their 60s ISR window. */
export function revalidateTeamSurfaces(teamId: number | string) {
  revalidatePath(`/OMADA/${teamId}`);
  revalidatePath("/OMADES");
  revalidatePath("/");
  revalidatePath("/geniki-katataxi");
}
