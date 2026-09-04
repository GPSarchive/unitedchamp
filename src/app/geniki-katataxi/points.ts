// app/geniki-katataxi/points.ts
// I/O side of the Γενική Κατάταξη: loads the rows the engine needs (optionally
// scoped to ONE assigned season) and caches the unscoped compute for the home
// recap. Every rule lives in ./engine (pure, unit-tested); every point value in
// ./rules.

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { chunk } from "@/app/lib/playerStatsAggregation";
import type { TeamSeasonLine } from "./rules";
import {
  computeStandingsFromInputs,
  type GeneralStandings,
  type MatchRow,
  type ParticipationRow,
  type SeasonAdjustment,
  type StageRow,
  type StandingsInputs,
  type TournamentRow,
} from "./engine";

export { ADJUSTMENT_PRESETS, NO_SEASON_LABEL, POINTS } from "./rules";
export type { AdjustmentKind, EventKind, PointsEvent, TeamSeasonLine } from "./rules";
export { computeStandingsFromInputs } from "./engine";
export type { GeneralStandings, SeasonAdjustment, StandingsInputs } from "./engine";

const PAGE = 1000;
/** Ids per IN (...) clause (kept well under the URL length PostgREST accepts). */
const IN_BATCH = 300;

type RowFilter = {
  eq?: [column: string, value: string | number];
  in?: [column: string, values: number[]];
};

/**
 * Every row of `table`, paginated past the PostgREST row cap, in id order.
 * With `filter.in` the ids are sent in batches (an empty list reads nothing).
 */
async function fetchAll<T>(table: string, columns: string, filter?: RowFilter): Promise<T[]> {
  const batches: (number[] | null)[] = filter?.in ? chunk(filter.in[1], IN_BATCH) : [null];
  const out: T[] = [];
  for (const batch of batches) {
    for (let from = 0; ; from += PAGE) {
      let q = supabaseAdmin.from(table).select(columns);
      if (filter?.eq) q = q.eq(filter.eq[0], filter.eq[1]);
      if (batch) q = q.in(filter!.in![0], batch);
      const { data, error } = await q.order("id", { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw new Error(`[geniki-katataxi] ${table}: ${error.message}`);
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

export interface ComputeOptions {
  /**
   * Restrict the compute to ONE season label. The loader then reads only that
   * season's tournaments and the rows hanging off them, so the per-mutation
   * refresh (lib/refreshStandings.ts) never scans other seasons. The unscoped
   * compute still serves the home recap's fallback.
   */
  seasonScope?: { onlyLabel: string };
}

/** Rows for the engine — the whole database, or one assigned season's slice. */
export async function loadStandingsInputs(onlyLabel: string | null = null): Promise<StandingsInputs> {
  const tournaments = await fetchAll<TournamentRow>(
    "tournaments",
    "id, name, season, status, winner_team_id, start_date",
    onlyLabel != null ? { eq: ["season", onlyLabel] } : undefined,
  );
  const scope: RowFilter | undefined =
    onlyLabel != null ? { in: ["tournament_id", tournaments.map((t) => t.id)] } : undefined;

  const [stages, participations, matches] = await Promise.all([
    fetchAll<StageRow>("tournament_stages", "id, tournament_id, kind, ordering", scope),
    fetchAll<ParticipationRow>("tournament_teams", "tournament_id, team_id, stage_id", scope),
    fetchAll<MatchRow>(
      "matches",
      "tournament_id, stage_id, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id, status, round, bracket_pos, leg, match_date",
      scope,
    ),
  ]);

  // Manual adjustments live in an optional table; degrade gracefully until the migration runs.
  let adjustments: SeasonAdjustment[] = [];
  let adjustmentsAvailable = true;
  try {
    adjustments = await fetchAll<SeasonAdjustment>(
      "season_team_adjustments",
      "id, season, team_id, kind, points, reason",
      onlyLabel != null ? { eq: ["season", onlyLabel] } : undefined,
    );
  } catch {
    adjustmentsAvailable = false;
  }

  return { tournaments, stages, participations, matches, adjustments, adjustmentsAvailable };
}

export async function computeGeneralStandings(
  options: ComputeOptions = {}
): Promise<GeneralStandings> {
  const onlyLabel = options.seasonScope?.onlyLabel ?? null;
  const inputs = await loadStandingsInputs(onlyLabel);
  return computeStandingsFromInputs(inputs, onlyLabel);
}

/* =========================================================
   Cached, unscoped variant — used by the home recap as the fallback for a
   season that has no stored season_team_standings rows yet.

   unstable_cache keeps the raw compute (full-table scans of five tables) to
   at most one run per 60s and is invalidated eagerly via the
   "geniki-katataxi" tag by the revalidation helpers and the adjustments
   dashboard.

   GeneralStandings holds a Map, which JSON round-tripping (how unstable_cache
   stores values) would silently turn into {} — so the cached payload carries
   the entries as an array and the Map is rebuilt per call.
   ========================================================= */

export const GENIKI_KATATAXI_CACHE_TAG = "geniki-katataxi";

type CachedStandings = Omit<GeneralStandings, "bySeason"> & {
  bySeasonEntries: Array<[string, TeamSeasonLine[]]>;
};

const computeGeneralStandingsRawCached = unstable_cache(
  async (): Promise<CachedStandings> => {
    const { bySeason, ...rest } = await computeGeneralStandings();
    return { ...rest, bySeasonEntries: [...bySeason.entries()] };
  },
  // Key versioned: v2 dropped the (date-derived) season-mode argument.
  ["geniki-katataxi-standings-v2"],
  { revalidate: 60, tags: [GENIKI_KATATAXI_CACHE_TAG] }
);

export async function computeGeneralStandingsCached(): Promise<GeneralStandings> {
  const { bySeasonEntries, ...rest } = await computeGeneralStandingsRawCached();
  return { ...rest, bySeason: new Map(bySeasonEntries) };
}
