// Loads one tournament and shapes it into what its pages show (see model.ts).
//
// The tournament is split over several pages (table, matches, knockout,
// players, teams), each reading only what it shows. What they share — the
// tournament itself, its stages, teams and matches — is loaded once per render
// (React `cache`), so the header and the page under it do not ask twice.
//
// Called from ISR pages: a failed read throws, which keeps the last good page
// instead of caching a half-empty one.
import "server-only";

import { cache } from "react";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchAllRows, fetchInBatches } from "@/app/lib/supabasePaging";
import { getActiveSeasonCached } from "@/app/lib/seasonScope";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { STAT_COLUMNS, toTuple, type StatColumns } from "../../paiktes-v2/data";
import {
  advancersOf,
  orderMembers,
  stageKind,
  type PlayerLine,
  type RawStage,
  type Squad,
  type SquadMember,
  type StageTables,
  type TMatch,
  type TStage,
  type TTeam,
  type Table,
  type TableRow,
} from "./model";
import { TOURNAMENT_PATH } from "./paths";

const num = (v: unknown) => Number(v) || 0;

// ───────────────────────────────────────────────────────────────────────
// The tournament, its stages, teams and matches
// ───────────────────────────────────────────────────────────────────────

export type Base = {
  id: number;
  name: string;
  /** Storage path or URL, as stored (the image component signs it). */
  logo: string | null;
  status: string | null;
  season: { label: string; display: string; archived: boolean; active: boolean } | null;
  winner: TTeam | null;
  /** In competition order. */
  stages: TStage[];
  /** By name. */
  teams: TTeam[];
  /** Which table each team was entered in. */
  entries: { stageId: number; groupId: number | null; teamId: number }[];
  matches: TMatch[];
};

const MATCH_COLUMNS =
  "id, stage_id, group_id, matchday, round, bracket_pos, match_date, status, team_a_id, team_b_id, " +
  "team_a_score, team_b_score, winner_team_id, is_ko, leg, tie_leg1_match_id, penalty_a, penalty_b, " +
  "home_source_round, home_source_bracket_pos, home_source_outcome, " +
  "away_source_round, away_source_bracket_pos, away_source_outcome";

type RawMatch = {
  id: number;
  stage_id: number | null;
  group_id: number | null;
  matchday: number | null;
  round: number | null;
  bracket_pos: number | null;
  match_date: string | null;
  status: string | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_team_id: number | null;
  is_ko: boolean | null;
  leg: number | null;
  tie_leg1_match_id: number | null;
  penalty_a: number | null;
  penalty_b: number | null;
  home_source_round: number | null;
  home_source_bracket_pos: number | null;
  home_source_outcome: string | null;
  away_source_round: number | null;
  away_source_bracket_pos: number | null;
  away_source_outcome: string | null;
};

/** null when there is no such tournament. */
export const loadBase = cache(async (id: number): Promise<Base | null> => {
  const { data: tournament, error } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, season, logo, status, winner_team_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed reading tournaments: ${error.message}`);
  if (!tournament) return null;

  const seasonLabel = (tournament.season as string | null) ?? null;
  const [stagesRes, entriesRes, rawMatches, seasonRow, activeSeason] = await Promise.all([
    supabaseAdmin
      .from("tournament_stages")
      .select("id, name, kind, ordering, config")
      .eq("tournament_id", id)
      .order("ordering", { ascending: true }),
    supabaseAdmin.from("tournament_teams").select("stage_id, group_id, team_id").eq("tournament_id", id).range(0, 999),
    fetchAllRows<RawMatch>("matches", MATCH_COLUMNS, "id", { column: "tournament_id", value: id }),
    seasonLabel ? getSeasonByLabel(seasonLabel) : Promise.resolve(null),
    getActiveSeasonCached(),
  ]);
  if (stagesRes.error) throw new Error(`Failed reading tournament_stages: ${stagesRes.error.message}`);
  if (entriesRes.error) throw new Error(`Failed reading tournament_teams: ${entriesRes.error.message}`);
  const rawStages = (stagesRes.data ?? []) as RawStage[];

  // Fixtures with no stage and no date are leftovers of the planner, not
  // matches anyone will play.
  const live = rawMatches.filter((m) => !(m.stage_id == null && m.match_date == null && m.status === "scheduled"));

  const entries = (entriesRes.data ?? [])
    .filter((e) => e.team_id != null && e.stage_id != null)
    .map((e) => ({
      stageId: Number(e.stage_id),
      groupId: e.group_id != null ? Number(e.group_id) : null,
      teamId: Number(e.team_id),
    }));
  const teamIds = new Set<number>(entries.map((e) => e.teamId));
  for (const m of live) {
    if (m.team_a_id != null) teamIds.add(Number(m.team_a_id));
    if (m.team_b_id != null) teamIds.add(Number(m.team_b_id));
  }
  if (tournament.winner_team_id != null) teamIds.add(Number(tournament.winner_team_id));

  const stageIds = rawStages.map((s) => Number(s.id));
  const [groupsRes, teamRows] = await Promise.all([
    stageIds.length
      ? supabaseAdmin
          .from("tournament_groups")
          .select("id, stage_id, name, ordering")
          .in("stage_id", stageIds)
          .order("ordering", { ascending: true })
      : Promise.resolve({ data: [] as { id: number; stage_id: number; name: string | null }[], error: null }),
    fetchInBatches<{ id: number; name: string | null; logo: string | null }>(
      "teams",
      "id",
      [...teamIds],
      "id, name, logo",
    ),
  ]);
  if (groupsRes.error) throw new Error(`Failed reading tournament_groups: ${groupsRes.error.message}`);

  const teamById = new Map<number, TTeam>(
    teamRows.map((t) => [Number(t.id), { id: Number(t.id), name: t.name ?? "", logo: t.logo ?? null }]),
  );

  const stages: TStage[] = rawStages.map((s) => ({
    id: Number(s.id),
    name: s.name?.trim() || "Φάση",
    kind: stageKind(s.kind),
    groups: (groupsRes.data ?? [])
      .filter((g) => Number(g.stage_id) === Number(s.id))
      .map((g) => ({ id: Number(g.id), name: g.name?.trim() || "Όμιλος" })),
    advancers: advancersOf(s, rawStages),
  }));
  const kindOf = new Map(stages.map((s) => [s.id, s.kind]));

  const matches: TMatch[] = live.map((m) => {
    const finished = m.status === "finished";
    const source = (round: number | null, pos: number | null, outcome: string | null) =>
      round != null && pos != null ? { round, pos, loser: outcome === "L" } : null;
    return {
      id: Number(m.id),
      stageId: m.stage_id != null ? Number(m.stage_id) : null,
      groupId: m.group_id != null ? Number(m.group_id) : null,
      matchday: m.matchday ?? null,
      round: m.round ?? null,
      bracketPos: m.bracket_pos ?? null,
      date: m.match_date ?? null,
      status: finished ? "finished" : m.status === "postponed" ? "postponed" : "scheduled",
      a: m.team_a_id != null ? (teamById.get(Number(m.team_a_id)) ?? null) : null,
      b: m.team_b_id != null ? (teamById.get(Number(m.team_b_id)) ?? null) : null,
      score:
        finished && m.team_a_score != null && m.team_b_score != null
          ? { a: m.team_a_score, b: m.team_b_score }
          : null,
      pens: m.penalty_a != null && m.penalty_b != null ? { a: m.penalty_a, b: m.penalty_b } : null,
      winnerTeamId: m.winner_team_id != null ? Number(m.winner_team_id) : null,
      leg: m.leg ?? null,
      leg1Id: m.tie_leg1_match_id != null ? Number(m.tie_leg1_match_id) : null,
      ko: Boolean(m.is_ko) || m.leg != null || (m.stage_id != null && kindOf.get(Number(m.stage_id)) === "knockout"),
      sources: {
        a: source(m.home_source_round, m.home_source_bracket_pos, m.home_source_outcome),
        b: source(m.away_source_round, m.away_source_bracket_pos, m.away_source_outcome),
      },
    };
  });

  // The tournament's teams: the ones entered in it, and any other its matches name.
  const teams = [...teamById.values()]
    .filter((t) => entries.some((e) => e.teamId === t.id) || matches.some((m) => m.a?.id === t.id || m.b?.id === t.id))
    .sort((a, b) => a.name.localeCompare(b.name, "el"));

  return {
    id: Number(tournament.id),
    name: (tournament.name as string | null)?.trim() || "Διοργάνωση",
    logo: (tournament.logo as string | null) ?? null,
    status: (tournament.status as string | null) ?? null,
    season: seasonLabel
      ? {
          label: seasonLabel,
          display: seasonRow?.display_label ?? seasonLabel,
          archived: seasonRow?.status === "archived",
          active: seasonLabel === activeSeason?.label,
        }
      : null,
    winner: tournament.winner_team_id != null ? (teamById.get(Number(tournament.winner_team_id)) ?? null) : null,
    stages,
    teams,
    entries,
    matches,
  };
});

// ───────────────────────────────────────────────────────────────────────
// Tables
// ───────────────────────────────────────────────────────────────────────

type StandingRow = {
  stage_id: number;
  group_id: number | null;
  team_id: number;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  points: number | null;
  rank: number | null;
};

/**
 * The stored tables (stage_standings) of every league and group stage, in
 * competition order. A league's rows are stored under group 0. A stage nobody
 * has played in yet has no stored rows: its table is then made of the teams
 * entered in it, level on nothing, by name.
 */
export const loadTables = cache(async (id: number): Promise<StageTables[]> => {
  const base = await loadBase(id);
  if (!base) return [];
  const stages = base.stages.filter((s) => s.kind !== "knockout");
  if (stages.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("stage_standings")
    .select("stage_id, group_id, team_id, played, won, drawn, lost, gf, ga, gd, points, rank")
    .in(
      "stage_id",
      stages.map((s) => s.id),
    )
    .range(0, 1999);
  if (error) throw new Error(`Failed reading stage_standings: ${error.message}`);
  const stored = (data ?? []) as StandingRow[];
  const teamById = new Map(base.teams.map((t) => [t.id, t]));
  const team = (teamId: number): TTeam => teamById.get(teamId) ?? { id: teamId, name: "—", logo: null };

  const blank = (teamId: number): StandingRow => ({
    stage_id: 0,
    group_id: null,
    team_id: teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    rank: null,
  });

  const toRows = (rows: StandingRow[]): TableRow[] =>
    [...rows]
      .sort(
        (a, b) =>
          (a.rank ?? 9999) - (b.rank ?? 9999) ||
          num(b.points) - num(a.points) ||
          num(b.gd) - num(a.gd) ||
          num(b.gf) - num(a.gf) ||
          team(a.team_id).name.localeCompare(team(b.team_id).name, "el"),
      )
      .map((r, index) => ({
        team: team(Number(r.team_id)),
        rank: r.rank ?? index + 1,
        played: num(r.played),
        won: num(r.won),
        drawn: num(r.drawn),
        lost: num(r.lost),
        gf: num(r.gf),
        ga: num(r.ga),
        gd: num(r.gd),
        points: num(r.points),
      }));

  return stages
    .map((stage): StageTables => {
      const ofStage = stored.filter((r) => Number(r.stage_id) === stage.id);
      const entered = base.entries.filter((e) => e.stageId === stage.id);
      const tables: Table[] = [];
      if (stage.kind === "groups" && stage.groups.length > 0) {
        for (const group of stage.groups) {
          const rows = ofStage.filter((r) => Number(r.group_id) === group.id);
          const fallback = entered.filter((e) => e.groupId === group.id).map((e) => blank(e.teamId));
          const lines = toRows(rows.length > 0 ? rows : fallback);
          if (lines.length > 0) tables.push({ key: `${stage.id}-${group.id}`, groupName: group.name, rows: lines });
        }
      } else {
        const lines = toRows(ofStage.length > 0 ? ofStage : entered.map((e) => blank(e.teamId)));
        if (lines.length > 0) tables.push({ key: `${stage.id}`, groupName: null, rows: lines });
      }
      return { stage, tables };
    })
    .filter((s) => s.tables.length > 0);
});

// ───────────────────────────────────────────────────────────────────────
// Players
// ───────────────────────────────────────────────────────────────────────

type PlayerRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  deleted_at: string | null;
};

const PLAYER_COLUMNS = "id, first_name, last_name, photo, deleted_at";

/**
 * Every card opens its player's profile, on top of the page it is on: the link
 * is the page itself with ?player= (the profile is fetched for any player —
 * see paiktes-v3/ProfileHost and profileLoader), same as the match and team
 * pages.
 */
const profileHref = (tournamentId: number, tab: "players" | "teams", playerId: number) =>
  `${TOURNAMENT_PATH}/${tournamentId}/${tab}?player=${playerId}`;

/** Who is in which squad, for the tournament's teams. */
const loadMembership = cache(async (id: number): Promise<{ player_id: number; team_id: number }[]> => {
  const base = await loadBase(id);
  if (!base) return [];
  return fetchInBatches<{ player_id: number; team_id: number }>(
    "player_teams",
    "team_id",
    base.teams.map((t) => t.id),
    "player_id, team_id",
  );
});

/** The stored per-tournament totals (player_tournament_stats): one row per player who played. */
const loadTournamentStats = cache(async (id: number) =>
  fetchAllRows<StatColumns & { player_id: number }>(
    "player_tournament_stats",
    `player_id, ${STAT_COLUMNS}`,
    "player_id",
    { column: "tournament_id", value: id },
  ),
);

/**
 * Everyone with numbers in the tournament, each with his team(s) in it.
 * Archived players are left out, as on the live page. The stored totals are
 * per player, not per team: a player who appeared for two of the tournament's
 * teams has one line, naming both.
 */
export const loadPlayers = cache(async (id: number): Promise<PlayerLine[]> => {
  const base = await loadBase(id);
  if (!base) return [];
  const [stats, membership] = await Promise.all([loadTournamentStats(id), loadMembership(id)]);
  const rows = await fetchInBatches<PlayerRow>(
    "player",
    "id",
    stats.map((s) => Number(s.player_id)),
    PLAYER_COLUMNS,
  );
  const statsOf = new Map(stats.map((s) => [Number(s.player_id), s]));
  const teamById = new Map(base.teams.map((t) => [t.id, t]));
  const teamsOf = new Map<number, TTeam[]>();
  for (const m of membership) {
    const team = teamById.get(Number(m.team_id));
    if (!team) continue;
    teamsOf.set(Number(m.player_id), [...(teamsOf.get(Number(m.player_id)) ?? []), team]);
  }

  return rows
    .filter((p) => !p.deleted_at)
    .map((p): PlayerLine => {
      const pid = Number(p.id);
      const teams = (teamsOf.get(pid) ?? []).sort((a, b) => a.name.localeCompare(b.name, "el"));
      return {
        id: pid,
        first: (p.first_name ?? "").trim(),
        last: (p.last_name ?? "").trim(),
        photo: p.photo ?? null,
        former: false,
        href: profileHref(base.id, "players", pid),
        teams,
        numbers: toTuple(statsOf.get(pid)!),
      };
    });
});

/** Every team's squad (its season roster — there is no roster per tournament), teams by name. */
export const loadSquads = cache(async (id: number): Promise<Squad[]> => {
  const base = await loadBase(id);
  if (!base) return [];
  const [stats, membership] = await Promise.all([loadTournamentStats(id), loadMembership(id)]);
  const rows = await fetchInBatches<PlayerRow>(
    "player",
    "id",
    [...new Set(membership.map((m) => Number(m.player_id)))],
    PLAYER_COLUMNS,
  );
  const playerById = new Map(rows.map((p) => [Number(p.id), p]));
  const goalsOf = new Map(stats.map((s) => [Number(s.player_id), num(s.goals)]));

  return base.teams.map((team): Squad => {
    const players: SquadMember[] = [];
    for (const m of membership) {
      if (Number(m.team_id) !== team.id) continue;
      const p = playerById.get(Number(m.player_id));
      if (!p || p.deleted_at) continue;
      const pid = Number(p.id);
      players.push({
        id: pid,
        first: (p.first_name ?? "").trim(),
        last: (p.last_name ?? "").trim(),
        photo: p.photo ?? null,
        former: false,
        href: profileHref(base.id, "teams", pid),
        goals: goalsOf.get(pid) ?? 0,
      });
    }
    return { team, players: orderMembers(players) };
  });
});
