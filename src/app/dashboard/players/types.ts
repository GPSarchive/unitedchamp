import type {
  PlayerRow as Player,
  PlayerStatisticsRow as PlayerStat,
  PlayerSeasonStatsRow,
} from "@/app/lib/types";

/**
 * A player as GET /api/players returns it. season_stats = the ACTIVE
 * season's numbers (null = no appearances yet); player_statistics is the
 * legacy all-time row, kept only for its hand-typed age.
 */
export type PlayerWithStats = Player & {
  player_statistics?: PlayerStat[];
  season_stats?: PlayerSeasonStatsRow | null;
};

/** What the editor drawer submits. Numbers are never typed by hand any more. */
export type PlayerFormPayload = {
  first_name: string;
  last_name: string;
  age: number | null;
  photo?: string | null;
  height_cm?: number | null;
  position?: string | null;
  birth_date?: string | null; // YYYY-MM-DD
  player_number?: number | null; // jersey number (not unique)
};
