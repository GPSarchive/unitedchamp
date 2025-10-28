export type PlayerLite = {
  id: number; // Changed from 'Id' to 'number'
  first_name: string;
  last_name: string;
  photo: string;
  position: string;
  height_cm: number | null;
  birth_date: string | null;
  age: number | null;
  teams?: { id: number; name: string; logo: string | null }[]; // Array for multiple teams (replaces singular 'team')
  team?: TeamLite | null; // Deprecated/optional: Keep for backward compat, but prefer 'teams'
  matches: number; // Matches played
  goals: number; // All-time total goals (alias for total_goals)
  assists: number; // All-time total assists
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number; // MVP awards
  best_gk: number; // Best goalkeeper awards (display if >=1)
  wins: number;
  /** Present only when sorting/filtering by a tournament */
  tournament_goals?: number;
};

export type TeamLite = {
  id: number;
  name: string;
  logo: string | null;
};