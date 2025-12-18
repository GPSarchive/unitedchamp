// app/lib/types.ts

/**
 * ---------------------------------
 * Utilities
 * ---------------------------------
 */
export type Id = number;
export type Nullable<T> = T | null;
export type MaybeArray<T> = T | T[] | null;

export interface SupaError {
  message: string;
}
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
  colour: string | null;
  created_at: string | null;
  am?: string | null;
  season_score?: number | null;
  /** Soft-delete timestamp (null = active) */
  deleted_at: string | null;
  is_dummy?: boolean;
}

export interface UserRow {
  id: Id;
  name: string;
}

export interface PlayerRow {
  id: Id;
  first_name: string;
  last_name: string;
  is_dummy?: boolean;

  // NEW fields from public.player
  photo: string; // NOT NULL in DB (default '/player-placeholder.jpg')
  height_cm: number | null;
  position: string | null;
  birth_date: string | null; // 'YYYY-MM-DD'

  // optional timestamps (exist in table but not always selected)
  created_at?: string | null;
  updated_at?: string | null;
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

/** Match status used in the UI + DB (three states: scheduled, postponed, finished) */
export type MatchStatus = "scheduled" | "postponed" | "finished";

/** Base match row (nullable date for drafts, three-state status) */
export interface MatchRow {
  id: Id;
  match_date: string | null;
  status: MatchStatus;
  team_a_score: number;
  team_b_score: number;
  winner_team_id: Id | null;
  team_a_id: Id;
  team_b_id: Id;
  field?: string | null; // Field/venue where match is played

  // ✅ Postponement fields (added 2025-12-01)
  postponement_reason?: string | null; // Reason why match was postponed
  original_match_date?: string | null; // Original date before postponement
  postponed_at?: string | null; // Timestamp when postponed
  postponed_by?: string | null; // UUID of admin who postponed the match
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
  referee?: string | null; // ← add this if you select it
  team_a: { id: Id; name: string; logo: string | null };
  team_b: { id: Id; name: string; logo: string | null };
  tournament?: { id: Id; name: string; season?: string | null; slug?: string | null } | null;
  stage_id?: Id | null;
  group_id?: Id | null;
  matchday?: number | null;
  round?: number | null;
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
export type Team = Pick<
  TeamRow,
  "id" | "name" | "logo" | "colour" | "created_at" | "am" | "season_score"
>;

/**
 * Compact player card/list item used by the Players page.
 * - `goals` = career/all-time goals (from player_statistics.total_goals)
 * - `tournament_goals` = optional per-tournament goals (attached when sorting by a tournament)
 */
export type PlayerLite = {
  id: Id;
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
  /** Present only when sorting/filtering by a tournament */
  tournament_goals?: number;
};

/** Calendar events for EventCalendar */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // 'YYYY-MM-DDTHH:mm:ss' (no tz)
  end: string; // 'YYYY-MM-DDTHH:mm:ss' (no tz)
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
    arr.sort((a, b) =>
      String(b[sortBy] ?? "").localeCompare(String(a[sortBy] ?? ""))
    );
  }
  return arr.slice(0, 1);
}

/** Normalize raw association rows from Supabase into the UI shape */
export function normalizeTeamPlayers(
  input: TeamPlayersRowRaw[] | null | undefined
): PlayerAssociation[] {
  return (input ?? []).map((row) => {
    const pRaw = normalizeOne(row.player);
    const base: PlayerWithStatsRaw =
      pRaw ?? {
        id: 0,
        first_name: "",
        last_name: "",
        // NEW defaults mirroring DB
        photo: "/player-placeholder.jpg",
        height_cm: null,
        position: null,
        birth_date: null,
        created_at: null,
        updated_at: null,

        player_statistics: null,
      };

    const stats = oneLatestStats(base.player_statistics, "id");

    const player: PlayerWithStats = {
      id: base.id,
      first_name: base.first_name,
      last_name: base.last_name,

      // NEW pass-throughs
      photo: base.photo,
      height_cm: base.height_cm,
      position: base.position,
      birth_date: base.birth_date,
      created_at: base.created_at ?? null,
      updated_at: base.updated_at ?? null,

      player_statistics: stats,
    };

    return { id: row.id, player };
  });
}

/**
 * ---------------------------------
 * Tournament payload + stage config
 * ---------------------------------
 */

export type StageKind = "league" | "groups" | "knockout";

export type NewTournamentPayload = {
  tournament: {
    name: string;
    slug?: string | null;
    logo?: string | null;
    season?: string | null;
    status?: "scheduled" | "running" | "completed" | "archived";
    format?: "league" | "groups" | "knockout" | "mixed";
    start_date?: string | null; // 'YYYY-MM-DD'
    end_date?: string | null;
    winner_team_id?: number | null;
  };
  stages: Array<{
    id?: number; // <- include if you hydrate from DB
    name: string;
    kind: StageKind;
    ordering?: number;
    config?: StageConfig | any;
    groups?: Array<{ name: string }>; // only when kind='groups'
  }>;
  tournament_team_ids?: number[]; // optional
};

export type TournamentStatus =
  | "scheduled"
  | "running"
  | "completed"
  | "archived";
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
  end_date: string | null; // 'YYYY-MM-DD'
  winner_team_id: Id | null;
}

/** Intake mapping (KO → Groups) used by UI config and server progression */
export type IntakeMapping = {
  group_idx: number;
  slot_idx: number;
  round: number;
  bracket_pos: number;
  outcome: "W" | "L";
};

/** Stage configuration shared across UI + server */
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

  /** Allow draws for non-knockout stages (UI defaults: true for league/groups, false for KO) */
  allow_draws?: boolean;

  // ----- KO stage sourcing from a previous stage -----
  from_stage_idx?: number;
  from_stage_id?: number | null;

  // ----- League → KO -----
  advancers_total?: number;

  // ----- Groups → KO -----
  advancers_per_group?: number;
  semis_cross?: "A1-B2" | "A1-B1";

  // ----- Standalone KO control -----
  standalone_bracket_size?: number;
  groups_signature?: string;

  // ----- KO → Groups intake -----
  from_knockout_stage_idx?: number;
  groups_intake?: IntakeMapping[];
};

/**
 * ---------------------------------
 * Bracket tree (knockout) shapes + helpers
 * ---------------------------------
 */
export type TeamsMap = Record<
  Id,
  { name: string; logo?: string | null; seed?: number | null }
>;

/** Stable pointer set (works before/after schema migration) */
export interface SourcePointers {
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
  home_source_match_id?: Id | null;
  away_source_match_id?: Id | null;
}

/** Single, canonical BracketMatch (no duplicates) */
export interface BracketMatch extends SourcePointers {
  id: Id;
  round: number | null;
  bracket_pos: number | null;
  team_a_id: Id | null;
  team_b_id: Id | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: MatchStatus;
}

export type BracketEdge = { fromId: Id; toId: Id };

/** Build a TeamsMap from simple list */
export function buildTeamsMap<
  T extends { id: Id; name: string; logo?: string | null; seed?: number | null }
>(teams: T[] | null | undefined): TeamsMap {
  const map: TeamsMap = {};
  (teams ?? []).forEach((t) => {
    map[t.id] = { name: t.name, logo: t.logo ?? null, seed: t.seed ?? null };
  });
  return map;
}

/** Prefer row values; fall back to extras (works before & after schema change) */
export function toBracketMatch(
  row: MatchRow &
    Partial<SourcePointers> &
    Partial<{ round: number | null; bracket_pos: number | null }>,
  extras?: Partial<SourcePointers> &
    Partial<{ round: number | null; bracket_pos: number | null }>
): BracketMatch {
  const src = { ...(extras ?? {}), ...(row as any) }; // row wins after schema migration
  return {
    id: row.id,
    round: src.round ?? null,
    bracket_pos: src.bracket_pos ?? null,
    team_a_id: row.team_a_id ?? null,
    team_b_id: row.team_b_id ?? null,
    team_a_score: row.status === "finished" ? row.team_a_score : null,
    team_b_score: row.status === "finished" ? row.team_b_score : null,
    status: row.status,
    // all pointer shapes
    home_source_match_id: src.home_source_match_id ?? null,
    away_source_match_id: src.away_source_match_id ?? null,
    home_source_round: src.home_source_round ?? null,
    home_source_bracket_pos: src.home_source_bracket_pos ?? null,
    away_source_round: src.away_source_round ?? null,
    away_source_bracket_pos: src.away_source_bracket_pos ?? null,
  };
}

/**
 * ---------------------------------
 * UI i18n labels for bracket components
 * ---------------------------------
 */
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

export type MatchPlayerStatRow = {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number;
  goals: number;
  assists: number;
  own_goals: number;  // ✅ ADD THIS LINE
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  position?: string | null;
  is_captain?: boolean;
  gk?: boolean;
  mvp?: boolean;
  best_goalkeeper?: boolean;
  player_number?: number | null;
};


export interface MatchParticipantRow {
  id: Id;
  match_id: Id;
  team_id: Id;
  player_id: Id;

  starter: boolean;
  minutes: number;
  position: string | null;
  shirt_number: number | null;
  is_captain: boolean;
  gk: boolean;

  sub_on_min: number | null;
  sub_off_min: number | null;

  created_at?: string | null;
  updated_at?: string | null;
}
