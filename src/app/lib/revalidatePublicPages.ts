import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/** unstable_cache tag for the Γενική Κατάταξη points compute. Kept here (not
 *  imported from points.ts) so this module stays dependency-free; the value
 *  must match GENIKI_KATATAXI_CACHE_TAG in geniki-katataxi/points.ts. */
const GENIKI_KATATAXI_TAG = "geniki-katataxi";

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
  // /geniki-katataxi is dynamically rendered (season tabs) — the path call is
  // a no-op there; the tag is what actually drops the cached points compute.
  revalidatePath("/geniki-katataxi");
  revalidateTag(GENIKI_KATATAXI_TAG, "max");
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
  revalidateTag(GENIKI_KATATAXI_TAG, "max");
}
