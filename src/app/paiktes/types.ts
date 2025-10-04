export type TeamLite = { id: number; name: string; logo: string | null } | null;

export type PlayerLite = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string;
  position: string;
  height_cm: number | null;
  age: number | null;
  team: TeamLite;
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number;
  best_gk: number;
};
