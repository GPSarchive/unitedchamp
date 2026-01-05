import type { PlayerRow as Player, PlayerStatisticsRow as PlayerStat } from "@/app/lib/types";

export type PlayerWithStats = Player & { player_statistics?: PlayerStat[] };

export type PlayerFormPayload = {
  first_name: string;
  last_name: string;
  age: number | null;
  total_goals: number;
  total_assists: number;
  // NEW
  photo?: string | null;
  height_cm?: number | null;
  position?: string | null;
  birth_date?: string | null; // 'YYYY-MM-DD'
  player_number?: number | null; // Player's jersey/shirt number (not unique)
  yellow_cards?: number;
  red_cards?: number;
  blue_cards?: number;
};
