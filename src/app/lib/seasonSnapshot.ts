// One season, all three stored artefacts, in dependency order:
//   player_season_stats → season_team_standings → season_recaps
// This is "the snapshot" of contract §4: the final refresh at close, the
// explicit re-snapshot of an archived season, and the CLI backfill
// (scripts/snapshot-season.ts). Throws on the first failure — callers report
// it; nothing here flips the season pointer.
import "server-only";

import { refreshAllSeasonStats } from "@/app/lib/refreshSeasonStats";
import { refreshSeasonStandings } from "@/app/lib/refreshStandings";
import { refreshSeasonRecap } from "@/app/lib/refreshSeasonRecap";

export interface SeasonSnapshotResult {
  seasonLabel: string;
  statsRows: number;
  staleStatsRowsDeleted: number;
  standingsRows: number;
  staleStandingsRowsDeleted: number;
  recapStored: boolean;
}

export async function snapshotSeason(seasonLabel: string): Promise<SeasonSnapshotResult> {
  const stats = await refreshAllSeasonStats(seasonLabel);
  const standings = await refreshSeasonStandings(seasonLabel);
  const recap = await refreshSeasonRecap(seasonLabel);
  return {
    seasonLabel,
    statsRows: stats.seasonRows,
    staleStatsRowsDeleted: stats.staleSeasonRowsDeleted,
    standingsRows: standings.rows,
    staleStandingsRowsDeleted: standings.staleRowsDeleted,
    recapStored: recap.stored,
  };
}
