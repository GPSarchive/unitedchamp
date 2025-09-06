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
  logo: string | null;
  created_at: string | null;
  /** Soft-delete timestamp (null = active) */
  deleted_at: string | null;
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
  /** PK on player_statistics */
  id: Id;
  /** optional timestamps in your table */
  created_at: string | null;
  updated_at: string | null;

  /** existing fields */
  age: number | null;
  total_goals: number;
  total_assists: number;

  /** new card counters */
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
}

export interface PlayerTeamsRow {
  player_id: Id;
  team_id: Id;
}

/** Match status used in the UI + DB */
export type MatchStatus = "scheduled" | "live" | "finished" | "canceled";

/** Base match row (nullable date for drafts, union status for safety) */
export interface MatchRow {
  id: Id;
  match_date: string | null; // timestamptz ISO (UTC) or null
  status: MatchStatus;
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
export type TeamLite = Pick<TeamRow, "id" | "name" | "logo">;

/** OMADA/[id] page: matches joined to team_a/team_b objects */
export interface MatchWithTeams {
  id: Id;
  match_date: string | null;
  status: MatchStatus;
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
  match_date: string | null;
  team_a_id: Id;
  team_b_id: Id;
  teamA: MaybeArray<TeamLite>;
  teamB: MaybeArray<TeamLite>;
}

/**
 * Player shapes
 *
 * - PlayerWithStatsRaw: incoming (DB) shape → stats may be object | array | null
 * - PlayerWithStats:    normalized (UI) shape → stats is always an array (0..1)
 */
export interface PlayerWithStatsRaw extends PlayerRow {
  player_statistics: MaybeArray<PlayerStatisticsRow>;
}

export interface PlayerWithStats extends PlayerRow {
  player_statistics: PlayerStatisticsRow[]; // normalized to length 0 or 1
}

/**
 * Player association via player_teams
 *
 * - TeamPlayersRowRaw: incoming (DB) shape → player may be object | array | null
 * - PlayerAssociation: normalized (UI) shape
 */
export interface TeamPlayersRowRaw {
  id: Id;
  player: MaybeArray<PlayerWithStatsRaw>;
}

export interface PlayerAssociation {
  id?: number; // some endpoints return an association id
  player: PlayerWithStats;
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
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/**
 * ---------------------------------
 * Helpers for player + stats normalization
 * ---------------------------------
 */

/** Collapse 'one-or-many' to one (or null) */
export function normalizeOne<T>(value: MaybeArray<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/**
 * Keep only the latest stats row so the UI can do `.player_statistics[0]`.
 * Accepts object | array | null and always returns an array (0..1).
 */
export function oneLatestStats(
  rows: MaybeArray<PlayerStatisticsRow> | undefined,
  sortBy: keyof PlayerStatisticsRow = "id"
): PlayerStatisticsRow[] {
  // Coerce object | null → array
  const arr: PlayerStatisticsRow[] = Array.isArray(rows)
    ? rows.slice()
    : rows
    ? [rows]
    : [];

  if (arr.length <= 1) return arr;

  if (sortBy === "id") {
    arr.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  } else {
    // falls back to string compare; works for ISO timestamps too
    arr.sort((a, b) => String(b[sortBy] ?? "").localeCompare(String(a[sortBy] ?? "")));
  }
  return arr.slice(0, 1);
}

/** Normalize raw association rows from Supabase into the UI shape */
export function normalizeTeamPlayers(
  input: TeamPlayersRowRaw[] | null | undefined
): PlayerAssociation[] {
  return (input ?? []).map((row) => {
    const pRaw = normalizeOne(row.player);
    const base: PlayerWithStatsRaw = pRaw ?? {
      id: 0,
      first_name: "",
      last_name: "",
      player_statistics: null,
    };

    const stats = oneLatestStats(base.player_statistics, "id");

    const player: PlayerWithStats = {
      id: base.id,
      first_name: base.first_name,
      last_name: base.last_name,
      player_statistics: stats,
    };

    return { id: row.id, player };
  });
}

export type StageKind = 'league' | 'groups' | 'knockout';

export type NewTournamentPayload = {
  tournament: {
    name: string;
    slug?: string | null;
    logo?: string | null;
    season?: string | null;
    status?: 'scheduled' | 'running' | 'completed' | 'archived';
    format?: 'league' | 'groups' | 'knockout' | 'mixed';
    start_date?: string | null; // 'YYYY-MM-DD'
    end_date?: string | null;
    winner_team_id?: number | null;
  };
  stages: Array<{
    name: string;
    kind: StageKind;
    ordering?: number;
    config?: any;
    groups?: Array<{ name: string }>; // only when kind='groups'
  }>;
  tournament_team_ids?: number[]; // optional
};
