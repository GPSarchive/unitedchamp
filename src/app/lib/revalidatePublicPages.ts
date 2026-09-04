import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/** unstable_cache tag for the Γενική Κατάταξη points compute. Kept here (not
 *  imported from points.ts) so this module stays dependency-free; the value
 *  must match GENIKI_KATATAXI_CACHE_TAG in geniki-katataxi/points.ts. */
const GENIKI_KATATAXI_TAG = "geniki-katataxi";

/** unstable_cache tag for the home-page season recap. Must match
 *  SEASON_RECAP_CACHE_TAG in home/seasonRecap.ts. */
const SEASON_RECAP_TAG = "season-recap";

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
  revalidateStandingsSurfaces();
  revalidatePath("/paiktes");
  if (match.tournament_id != null) revalidateTournamentSurfaces(match.tournament_id);
  const teamIds = new Set(
    [match.team_a_id, match.team_b_id, ...(match.previous_team_ids ?? [])].filter(
      (t): t is number => t != null
    )
  );
  for (const teamId of teamIds) revalidatePath(`/OMADA/${teamId}`);
}

/**
 * Γενική Κατάταξη surfaces. /geniki-katataxi is a static ISR page reading the
 * stored season_team_standings rows, so the path call regenerates it; the tags
 * drop the cached unscoped points compute (recap) and anything else keyed on it.
 * Call AFTER refreshActiveSeasonStandings() so the regenerated page sees the
 * fresh rows.
 */
export function revalidateStandingsSurfaces() {
  revalidatePath("/geniki-katataxi");
  revalidateTag(GENIKI_KATATAXI_TAG, "max");
  revalidateTag(SEASON_RECAP_TAG, "max");
}

/** unstable_cache tag for the season list / active pointer. Must match
 *  SEASONS_CACHE_TAG in lib/seasons.ts. */
const SEASONS_TAG = "seasons";

/**
 * Everything that depends on WHICH season is active or on a season's stored
 * snapshot: called after closing / re-snapshotting / re-activating a season.
 * Pass the label(s) touched so their archive pages regenerate too.
 */
export function revalidateSeasonSurfaces(...labels: string[]) {
  revalidateTag(SEASONS_TAG, "max");
  revalidateStandingsSurfaces();
  for (const p of ["/", "/paiktes", "/OMADES", "/matches", "/tournaments", "/seasons"]) {
    revalidatePath(p);
  }
  for (const label of labels) revalidatePath(`/seasons/${label}`);
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
  revalidateStandingsSurfaces();
}
