export type TeamLite = {
  id: number;
  name: string;
  logo: string | null;
};

export type PlayerLite = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string;
  position: string;
  height_cm: number | null;
  birth_date: string | null;
  age: number | null;

  // Team membership
  // - teams: up to 3 current teams, sorted by matches played (main team first)
  // - team: main team (most matches among current memberships), used in list views/headings
  teams?: { id: number; name: string; logo: string | null }[];
  team?: TeamLite | null;

  // Global stats (all-time)
  matches: number; // matches played (all competitions)
  goals: number; // total goals
  assists: number; // total assists
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number; // MVP awards
  best_gk: number; // Best goalkeeper awards
  wins: number; // matches won

  // Tournament-scoped stats (present only when filtering by a tournament)
  tournament_matches?: number;
  tournament_goals?: number;
  tournament_assists?: number;
  tournament_yellow_cards?: number;
  tournament_red_cards?: number;
  tournament_blue_cards?: number;
  tournament_mvp?: number;
  tournament_best_gk?: number;
  tournament_wins?: number;
};
