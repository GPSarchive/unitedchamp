// app/types.ts

/**
 * ---------------------------------
 * Utilities
 * ---------------------------------
 */
export type Id = number;
export type Nullable<T> = T | null;
export type MaybeArray<T> = T | T[] | null;

export interface SupaError { message: string }
export type SupaResp<T> = { data: T | null; error: SupaError | null };

/**
 * ---------------------------------
 * Core DB rows (shape of your tables)
 * ---------------------------------
 */
export interface TeamRow {
  id: Id;
  name: string;
  logo: string ;
  created_at?: string; // present on the team page
}

export interface UserRow {
  id: Id;
  name: string;
}

export interface PlayerRow {
  id: Id;
  first_name: string;
  last_name: string;
}

export interface PlayerStatisticsRow {
  age: number | null;
  total_goals: number;
  total_assists: number;
}

export interface PlayerTeamsRow {
  player_id: Id;
  team_id: Id;
  // add joined_at/left_at if you later add those columns
}

export interface MatchRow {
  id: Id;
  match_date: string; // timestamptz (e.g. "2025-08-04T21:40:00+00:00")
  status: string;     // keep open-form, UI handles "completed/upcoming"
  team_a_score: number;
  team_b_score: number;
  winner_team_id: Id | null;
  team_a_id: Id;
  team_b_id: Id;
}

/**
 * ---------------------------------
 * Slim/Derived DB shapes used in selects
 * ---------------------------------
 */
export type TeamLite = Pick<TeamRow, "name" | "logo">;

/** OMADA/[id] page: matches joined to team_a/team_b objects */
export interface MatchWithTeams {
  id: Id;
  match_date: string;
  status: string;
  team_a_score: number;
  team_b_score: number;
  winner_team_id: Id | null;
  team_a: { id: Id; name: string; logo: string | null };
  team_b: { id: Id; name: string; logo: string | null };
}

/** Keep backward compatibility with earlier code that imported `Match` */
export type Match = MatchWithTeams;

/** Home page: aliased joins that can come back as single or array from Supabase */
export interface MatchRowRaw {
  id: Id;
  match_date: string;
  team_a_id: Id;
  team_b_id: Id;
  teamA: MaybeArray<TeamLite>;
  teamB: MaybeArray<TeamLite>;
}

/** Player association via player_teams (reverse relation arrays) */
export interface PlayerAssociation {
  player: PlayerRow & { player_statistics: PlayerStatisticsRow[] };
}

/** RPC: search_teams_fuzzy returns total_count alongside team fields */
export interface TeamWithCount extends TeamRow {
  total_count: number;
}

/**
 * ---------------------------------
 * View models (UI-facing shapes)
 * ---------------------------------
 */
export type Team = Pick<TeamRow, "id" | "name" | "logo" | "created_at">;

/** Calendar events for EventCalendar */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // 'YYYY-MM-DDTHH:mm:ss' (no tz)
  end: string;   // 'YYYY-MM-DDTHH:mm:ss' (no tz)
  all_day: boolean;
  teams: [string, string];
  logos: [string, string];
}

/**
 * ---------------------------------
 * Narrowing helpers (used by Home page)
 * ---------------------------------
 */
export function normalizeTeam(value: MaybeArray<TeamLite>): TeamLite | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
