export type PlayerLite = {
  id: number; // Changed from 'Id' to 'number'
  first_name: string;
  last_name: string;
  photo: string;
  position: string;
  height_cm: number | null;
  birth_date: string | null;
  age: number | null;
  team: TeamLite | null;
  matches: number;
  goals: number; // all-time
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number;
  best_gk: number;
  wins: number;
  /** Present only when sorting/filtering by a tournament */
  tournament_goals?: number;
};

export type TeamLite = {
  id: number;
  name: string;
  logo: string | null;
};