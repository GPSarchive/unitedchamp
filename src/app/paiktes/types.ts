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

// Career stat keys that have a `tournament_*` twin. The twin key is always
// the career key prefixed with `tournament_` (e.g. goals → tournament_goals).
export type ScopableStatKey =
  | "matches"
  | "goals"
  | "assists"
  | "yellow_cards"
  | "red_cards"
  | "blue_cards"
  | "mvp"
  | "best_gk"
  | "wins";

/**
 * Single source of truth for "scoped vs career" stat selection.
 *
 * When a tournament is selected (`scoped`), prefer the player's tournament_*
 * value for `careerKey` if it is defined; otherwise fall back to the career
 * value, then 0. When not scoped, always return the career value (or 0).
 *
 * Used by the list rows, the profile card, and the server-side sort/filter so
 * the displayed number, the sort order, and the stat filter never diverge.
 */
export function resolveStat(
  p: PlayerLite,
  careerKey: ScopableStatKey,
  scoped: boolean,
): number {
  if (scoped) {
    const tournamentValue = p[`tournament_${careerKey}` as const];
    if (typeof tournamentValue === "number") return tournamentValue;
  }
  const careerValue = p[careerKey];
  return typeof careerValue === "number" ? careerValue : 0;
}
