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

/** Match status used in the UI + DB (two states only) */
export type MatchStatus = "scheduled" | "finished";

/** Base match row (nullable date for drafts, two-state status) */
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
export type TournamentStatus = "scheduled" | "running" | "completed" | "archived";
export type TournamentFormat = "league" | "groups" | "knockout" | "mixed";

export interface TournamentRow {
  id: Id;
  created_at: string | null;
  name: string;
  slug: string;
  logo: string | null;
  season: string | null;
  status: TournamentStatus;
  format: TournamentFormat;
  start_date: string | null; // 'YYYY-MM-DD'
  end_date: string | null;   // 'YYYY-MM-DD'
  winner_team_id: Id | null;
}

/**
 * ---------------------------------
 * Bracket tree (knockout) shapes + helpers
 * ---------------------------------
 */
export type TeamsMap = Record<
  Id,
  { name: string; logo?: string | null; seed?: number | null }
>;

export interface BracketMatch {
  id: Id;
  round: number | null;
  bracket_pos: number | null;
  team_a_id: Id | null;
  team_b_id: Id | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: MatchStatus; // two-state
  home_source_match_id?: Id | null;
  away_source_match_id?: Id | null;
}

export type BracketEdge = { fromId: Id; toId: Id };

export function buildTeamsMap<T extends { id: Id; name: string; logo?: string | null; seed?: number | null }>(
  teams: T[] | null | undefined
): TeamsMap {
  const map: TeamsMap = {};
  (teams ?? []).forEach(t => {
    map[t.id] = { name: t.name, logo: t.logo ?? null, seed: t.seed ?? null };
  });
  return map;
}

export function toBracketMatch(
  row: MatchRow,
  extras?: Partial<Pick<BracketMatch,
    "round" | "bracket_pos" | "home_source_match_id" | "away_source_match_id"
  >>
): BracketMatch {
  return {
    id: row.id,
    round: extras?.round ?? null,
    bracket_pos: extras?.bracket_pos ?? null,
    team_a_id: row.team_a_id ?? null,
    team_b_id: row.team_b_id ?? null,
    team_a_score: row.status === "finished" ? row.team_a_score : null,
    team_b_score: row.status === "finished" ? row.team_b_score : null,
    status: row.status,
    home_source_match_id: extras?.home_source_match_id ?? null,
    away_source_match_id: extras?.away_source_match_id ?? null,
  };
}

// UI i18n labels for bracket components
export type Labels = {
  final: string;
  semifinals: string;
  quarterfinals: string;
  roundOf: (n: number) => string;
  roundN: (r: number) => string;
  bye: string;
  tbd: string;
  pair: (a?: number | null, b?: number | null) => string;
  seedTaken: string;
  pickTeam: string;
  autoSeed: string;
  clearRound: string;
  swap: string;
};

export type IntakeMapping = {
  group_idx: number;
  slot_idx: number;
  round: number;
  bracket_pos: number;
  outcome: "W" | "L";
};

export type StageConfig = {
  // League/Groups controls (Greek + mirrors)
  διπλός_γύρος?: boolean;
  τυχαία_σειρά?: boolean;
  αγώνες_ανά_αντίπαλο?: number;
  μέγιστες_αγωνιστικές?: number;
  double_round?: boolean;
  shuffle?: boolean;
  rounds_per_opponent?: number;
  limit_matchdays?: number;

  // Groups → KO (KO stage sources this groups stage)
  from_stage_idx?: number;
  advancers_per_group?: number;
  semis_cross?: "A1-B2" | "A1-B1";

  // Standalone KO control
  standalone_bracket_size?: number;

  // KO → Groups intake (this groups stage sources a KO stage)
  from_knockout_stage_idx?: number;
  groups_intake?: IntakeMapping[];
};
