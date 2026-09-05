// The read-side season scope for public pages: "which season is active, and
// which tournaments belong to it". Request-deduped with React cache() so a
// page and its sections share one lookup; the pages themselves are ISR, so
// the pointer is read once per revalidate window, not per visit.
import "server-only";

import { cache } from "react";
import {
  getActiveSeason,
  getSeasonByLabel,
  listTournamentIdsForSeason,
  type SeasonRow,
  type SeasonStatus,
} from "@/app/lib/seasons";

export const getActiveSeasonCached = cache(async (): Promise<SeasonRow | null> => getActiveSeason());

/**
 * Status of one season label (null when unknown). The archive/live redirect
 * guards use THIS rather than comparing against the active pointer, so an
 * archived row redirects even while no season is active (mid-flip).
 */
export const getSeasonStatusCached = cache(
  async (label: string): Promise<SeasonStatus | null> => (await getSeasonByLabel(label))?.status ?? null,
);

export const getActiveScope = cache(
  async (): Promise<{ season: SeasonRow | null; tournamentIds: number[] }> => {
    const season = await getActiveSeason();
    if (!season) return { season: null, tournamentIds: [] };
    return { season, tournamentIds: await listTournamentIdsForSeason(season.label) };
  },
);

/** A value that matches no row — for `.in()` / `.eq()` when there is no active season. */
export const NO_SEASON = "__no-active-season__";
