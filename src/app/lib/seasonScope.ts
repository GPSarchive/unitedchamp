// The read-side season scope for public pages: "which season is active, and
// which tournaments belong to it". Request-deduped with React cache() so a
// page and its sections share one lookup; the pages themselves are ISR, so
// the pointer is read once per revalidate window, not per visit.
import "server-only";

import { cache } from "react";
import { getActiveSeason, listTournamentIdsForSeason, type SeasonRow } from "@/app/lib/seasons";

export const getActiveSeasonCached = cache(async (): Promise<SeasonRow | null> => getActiveSeason());

export const getActiveScope = cache(
  async (): Promise<{ season: SeasonRow | null; tournamentIds: number[] }> => {
    const season = await getActiveSeason();
    if (!season) return { season: null, tournamentIds: [] };
    return { season, tournamentIds: await listTournamentIdsForSeason(season.label) };
  },
);

/** A value that matches no row — for `.in()` / `.eq()` when there is no active season. */
export const NO_SEASON = "__no-active-season__";
