import type { PlayerRow as Player, PlayerStatisticsRow as PlayerStat } from "@/app/lib/types";

export type PlayerWithStats = Player & { player_statistics?: PlayerStat[] };

export type PlayerFormPayload = {
  first_name: string;
  last_name: string;
  age: number | null;
  total_goals: number;
  total_assists: number;
};