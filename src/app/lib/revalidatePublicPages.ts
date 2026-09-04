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

/**
 * Everything that depends on WHICH season is active or on a season's stored
 * snapshot: called after closing / re-snapshotting / re-activating a season,
 * and after a tournament moves between seasons. The active pointer itself is
 * not cached (lib/seasons.ts reads it per request; the pages are ISR), so
 * this is purely path revalidation.
 */
export function revalidateSeasonSurfaces(...labels: string[]) {
  revalidateStandingsSurfaces();
  for (const p of ["/", "/paiktes", "/OMADES", "/matches", "/tournaments", "/seasons", "/sitemap.xml"]) {
    revalidatePath(p);
  }
  // Per-entity live routes: after a close every cached team/tournament page
  // must re-render — archived rows start redirecting, the new season's rows
  // render live. The "page" form drops every cached instance of the route.
  for (const p of ["/OMADA/[id]", "/tournaments/[id]", "/tournaments/[id]/v2", "/tournaments/[id]/v2-dark"]) {
    revalidatePath(p, "page");
  }
  // Archive routes: the touched hubs, plus every nested archive page (they
  // read the stored snapshot that a re-snapshot just rewrote).
  for (const label of labels) revalidatePath(`/seasons/${encodeURIComponent(label)}`);
  for (const p of [
    "/seasons/[season]/katataxi",
    "/seasons/[season]/teams/[id]",
    "/seasons/[season]/tournaments/[id]",
  ]) {
    revalidatePath(p, "page");
  }
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
