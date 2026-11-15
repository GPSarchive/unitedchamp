// Loads one team and shapes it into what the page shows (see model.ts).
//
// Teams are one row per season (plans/seasonal-data-contract.md D1), so every
// read keyed by the team id is already scoped to that season: its squad, its
// matches, its match sheets.
//
// Called from an ISR page: a failed read throws, which keeps the last good
// page instead of caching a half-empty one. Only the head-to-head line, which
// is a nicety built from several small reads, fails quietly.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchInBatches } from "@/app/lib/supabasePaging";
import { nowWallClockIso } from "@/app/lib/datetime";
import { getActiveSeasonCached } from "@/app/lib/seasonScope";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { getSeasonStandings } from "@/app/lib/refreshStandings";
import { rankVisible } from "@/app/geniki-katataxi/standingsShape";
import { kickoffEpoch } from "./clock";
import {
  isKeeper,
  orderSquad,
  playerTotals,
  seasonRecord,
  sideResult,
  splitSchedule,
  totalsTuple,
  type GroupTable,
  type MatchLike,
  type Outcome,
  type SquadPlayer,
  type StandingLine,
  type StatRow,
  type TeamMatch,
  type TeamRef,
  type TeamView,
} from "./model";
import { TEAM_PATH } from "./paths";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const num = (v: unknown) => Number(v) || 0;

// ───────────────────────────────────────────────────────────────────────
// Matches
// ───────────────────────────────────────────────────────────────────────

const MATCH_LIKE_COLUMNS =
  "id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, stage_id, " +
  "is_ko, leg, tie_leg1_match_id, penalty_a, penalty_b";

const MATCH_COLUMNS =
  MATCH_LIKE_COLUMNS +
  ", matchday, " +
  "team_a:teams!matches_team_a_id_fkey (id, name, logo), " +
  "team_b:teams!matches_team_b_id_fkey (id, name, logo), " +
  "tournament:tournament_id (id, name), " +
  "stage:stage_id (id, name, kind), " +
  "group:group_id (id, name)";

type RawMatch = MatchLike & {
  match_date: string | null;
  stage_id: number | null;
  is_ko: boolean | null;
  matchday?: number | null;
  team_a?: unknown;
  team_b?: unknown;
  tournament?: unknown;
  stage?: unknown;
  group?: unknown;
};

const isKo = (m: RawMatch) =>
  Boolean(m.is_ko) || m.leg != null || one(m.stage as { kind?: string } | null)?.kind === "knockout";

const teamRef = (v: unknown): TeamRef | null => {
  const t = one(v as { id: number; name: string | null; logo: string | null } | null);
  return t ? { id: Number(t.id), name: t.name ?? "", logo: t.logo ?? null } : null;
};

function toTeamMatch(m: RawMatch, teamId: number, byId: Map<number, RawMatch>): TeamMatch {
  const isA = Number(m.team_a_id) === teamId;
  const tournament = one(m.tournament as { id: number; name: string } | null);
  const stage = one(m.stage as { id: number; name: string; kind: string } | null);
  const group = one(m.group as { id: number; name: string } | null);
  const leg1 = m.tie_leg1_match_id ? (byId.get(Number(m.tie_leg1_match_id)) ?? null) : null;
  const ko = isKo(m);
  return {
    id: Number(m.id),
    opponent: teamRef(isA ? m.team_b : m.team_a),
    date: m.match_date,
    status: m.status === "finished" || m.status === "postponed" ? m.status : "scheduled",
    competition: tournament ? { id: Number(tournament.id), name: tournament.name } : null,
    stageName: stage?.name ?? null,
    groupName: group?.name ?? null,
    matchday: m.matchday ?? null,
    leg: m.leg ?? null,
    ko,
    result: sideResult(m, teamId, ko, leg1),
  };
}

async function fetchMatches(teamId: number): Promise<RawMatch[]> {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(MATCH_COLUMNS)
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("match_date", { ascending: true, nullsFirst: false })
    .range(0, 999);
  if (error) throw new Error(`Failed reading matches: ${error.message}`);
  // Fixtures with no stage and no date are leftovers of the planner, not
  // matches anyone will play.
  return ((data ?? []) as unknown as RawMatch[]).filter(
    (m) => !(m.stage_id == null && m.match_date == null && m.status === "scheduled"),
  );
}

// ───────────────────────────────────────────────────────────────────────
// League / group tables
// ───────────────────────────────────────────────────────────────────────

/**
 * The league and group tables the team is in, the one with the most matches
 * played first (that is its main competition). Knockout stages have no table.
 */
async function loadTables(teamId: number): Promise<GroupTable[]> {
  const { data: own, error: ownError } = await supabaseAdmin
    .from("stage_standings")
    .select("stage_id, group_id")
    .eq("team_id", teamId);
  if (ownError) throw new Error(`Failed reading stage_standings: ${ownError.message}`);
  const stageIds = [...new Set((own ?? []).map((r) => Number(r.stage_id)))];
  if (stageIds.length === 0) return [];

  const [rowsRes, stagesRes] = await Promise.all([
    supabaseAdmin
      .from("stage_standings")
      .select("stage_id, group_id, team_id, played, won, drawn, lost, gf, ga, gd, points, rank")
      .in("stage_id", stageIds)
      .range(0, 999),
    supabaseAdmin
      .from("tournament_stages")
      .select("id, name, kind, tournament:tournament_id (id, name)")
      .in("id", stageIds),
  ]);
  if (rowsRes.error) throw new Error(`Failed reading stage_standings: ${rowsRes.error.message}`);
  if (stagesRes.error) throw new Error(`Failed reading tournament_stages: ${stagesRes.error.message}`);
  const rows = rowsRes.data ?? [];

  const groupIds = [...new Set(rows.map((r) => Number(r.group_id)).filter((g) => g > 0))];
  const teamIds = [...new Set(rows.map((r) => Number(r.team_id)))];
  const [groupsRes, teamsRes] = await Promise.all([
    groupIds.length
      ? supabaseAdmin.from("tournament_groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] as { id: number; name: string | null }[], error: null }),
    supabaseAdmin.from("teams").select("id, name, logo").in("id", teamIds),
  ]);
  if (groupsRes.error) throw new Error(`Failed reading tournament_groups: ${groupsRes.error.message}`);
  if (teamsRes.error) throw new Error(`Failed reading teams: ${teamsRes.error.message}`);
  const groupName = new Map((groupsRes.data ?? []).map((g) => [Number(g.id), (g.name as string | null) ?? null]));
  const teamInfo = new Map((teamsRes.data ?? []).map((t) => [Number(t.id), t]));
  const stageInfo = new Map((stagesRes.data ?? []).map((s) => [Number(s.id), s]));

  const tables: GroupTable[] = [];
  const seen = new Set<string>();
  for (const mine of own ?? []) {
    const key = `${mine.stage_id}:${mine.group_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const stage = stageInfo.get(Number(mine.stage_id));
    if (!stage || stage.kind === "knockout") continue;
    const lines = rows
      .filter((r) => Number(r.stage_id) === Number(mine.stage_id) && Number(r.group_id) === Number(mine.group_id))
      .sort(
        (a, b) =>
          (a.rank ?? 9999) - (b.rank ?? 9999) ||
          num(b.points) - num(a.points) ||
          num(b.gd) - num(a.gd) ||
          num(b.gf) - num(a.gf),
      )
      .map(
        (r, index): StandingLine => ({
          teamId: Number(r.team_id),
          name: (teamInfo.get(Number(r.team_id))?.name as string | null) ?? "—",
          logo: (teamInfo.get(Number(r.team_id))?.logo as string | null) ?? null,
          rank: r.rank ?? index + 1,
          played: num(r.played),
          won: num(r.won),
          drawn: num(r.drawn),
          lost: num(r.lost),
          gf: num(r.gf),
          ga: num(r.ga),
          gd: num(r.gd),
          points: num(r.points),
        }),
      );
    const ownIndex = lines.findIndex((l) => l.teamId === teamId);
    if (ownIndex === -1) continue;
    const tournament = one(stage.tournament as { id: number; name: string } | { id: number; name: string }[] | null);
    tables.push({
      stageId: Number(stage.id),
      stageName: (stage.name as string | null) ?? "",
      groupName: groupName.get(Number(mine.group_id)) ?? null,
      competition: tournament ? { id: Number(tournament.id), name: tournament.name } : null,
      rows: lines,
      ownIndex,
    });
  }
  return tables.sort((a, b) => b.rows[b.ownIndex].played - a.rows[a.ownIndex].played || a.stageId - b.stageId);
}

// ───────────────────────────────────────────────────────────────────────
// Head to head
// ───────────────────────────────────────────────────────────────────────

/** A club across seasons: the rows it was copied from, plus every team row with the same name. */
async function teamFamily(teamId: number): Promise<number[]> {
  const ids = new Set<number>([teamId]);
  const { data: team, error } = await supabaseAdmin
    .from("teams")
    .select("id, name, copied_from_team_id")
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw new Error(`Failed reading teams: ${error.message}`);
  let parent = team?.copied_from_team_id as number | null | undefined;
  for (let depth = 0; parent && depth < 8 && !ids.has(Number(parent)); depth++) {
    ids.add(Number(parent));
    const { data } = await supabaseAdmin
      .from("teams")
      .select("copied_from_team_id")
      .eq("id", parent)
      .maybeSingle();
    parent = data?.copied_from_team_id as number | null | undefined;
  }
  if (team?.name) {
    const { data: namesakes } = await supabaseAdmin.from("teams").select("id").eq("name", team.name).range(0, 99);
    for (const t of namesakes ?? []) ids.add(Number(t.id));
  }
  return [...ids];
}

/** Every finished meeting of the two clubs, all seasons, from `teamId`'s side. null when they never met. */
async function loadHeadToHead(
  teamId: number,
  opponentId: number,
): Promise<{ won: number; drawn: number; lost: number } | null> {
  const [mine, theirs] = await Promise.all([teamFamily(teamId), teamFamily(opponentId)]);
  const mineSet = new Set(mine);
  const theirSet = new Set(theirs);
  const all = [...new Set([...mine, ...theirs])];
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(MATCH_LIKE_COLUMNS + ", stage:stage_id (kind)")
    .in("team_a_id", all)
    .in("team_b_id", all)
    .eq("status", "finished")
    .range(0, 999);
  if (error) throw new Error(`Failed reading matches: ${error.message}`);
  const rows = (data ?? []) as unknown as RawMatch[];
  const byId = new Map(rows.map((m) => [Number(m.id), m]));
  const record = { won: 0, drawn: 0, lost: 0 };
  for (const m of rows) {
    const a = Number(m.team_a_id);
    const b = Number(m.team_b_id);
    const side = mineSet.has(a) && theirSet.has(b) ? a : mineSet.has(b) && theirSet.has(a) ? b : null;
    if (side === null) continue;
    const leg1 = m.tie_leg1_match_id ? (byId.get(Number(m.tie_leg1_match_id)) ?? null) : null;
    const res = sideResult(m, side, isKo(m), leg1);
    if (!res) continue;
    if (res.outcome === "W") record.won += 1;
    else if (res.outcome === "D") record.drawn += 1;
    else record.lost += 1;
  }
  return record.won + record.drawn + record.lost > 0 ? record : null;
}

// ───────────────────────────────────────────────────────────────────────
// Γενική Κατάταξη
// ───────────────────────────────────────────────────────────────────────

/**
 * The team's position with the SAME rule as the table it links to
 * (standingsShape.rankVisible): the live table hides archived teams and closes
 * the ranks up, a past season shows every team it had.
 */
async function loadGeneralStanding(
  teamId: number,
  seasonLabel: string,
  seasonActive: boolean,
): Promise<{ rank: number; points: number } | null> {
  const rows = await getSeasonStandings(seasonLabel);
  if (rows.length === 0) return null;
  let visibleQuery = supabaseAdmin.from("teams").select("id").eq("season_label", seasonLabel);
  if (seasonActive) visibleQuery = visibleQuery.is("deleted_at", null);
  const { data: visible, error } = await visibleQuery.range(0, 999);
  if (error) throw new Error(`Failed reading teams: ${error.message}`);
  const ranked = rankVisible(rows, new Set((visible ?? []).map((t) => Number(t.id))));
  const mine = ranked.find((l) => l.teamId === teamId);
  return mine ? { rank: mine.rank, points: mine.points } : null;
}

// ───────────────────────────────────────────────────────────────────────
// The page
// ───────────────────────────────────────────────────────────────────────

type TeamRow = {
  id: number;
  name: string | null;
  logo: string | null;
  colour: string | null;
  am: string | number | null;
  season_label: string | null;
};

type PlayerRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  deleted_at: string | null;
};

type SheetRow = {
  match_id: number;
  team_id: number;
  player_id: number;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
  mvp: boolean | null;
  best_goalkeeper: boolean | null;
  gk: boolean | null;
};

const PLAYER_COLUMNS = "id, first_name, last_name, photo, deleted_at";

/** null when there is no such team. */
export async function loadTeamView(teamId: number): Promise<TeamView | null> {
  const [teamRes, membershipRes, titlesRes, rosterRes, rawMatches, activeSeason] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name, logo, colour, am, season_label")
      .eq("id", teamId)
      .maybeSingle(),
    // A team can be linked to a tournament through more than one group: one line per tournament below.
    supabaseAdmin
      .from("tournament_teams")
      .select("tournament:tournament_id (id, name, status, winner_team_id)")
      .eq("team_id", teamId)
      .order("tournament_id", { ascending: false }),
    supabaseAdmin.from("tournaments").select("id, name").eq("winner_team_id", teamId).order("id", { ascending: false }),
    supabaseAdmin
      .from("player_teams")
      .select(`player:player_id (${PLAYER_COLUMNS})`)
      .eq("team_id", teamId)
      .order("player_id", { ascending: true }),
    fetchMatches(teamId),
    getActiveSeasonCached(),
  ]);
  if (teamRes.error) throw new Error(`Failed reading teams: ${teamRes.error.message}`);
  if (membershipRes.error) throw new Error(`Failed reading tournament_teams: ${membershipRes.error.message}`);
  if (titlesRes.error) throw new Error(`Failed reading tournaments: ${titlesRes.error.message}`);
  if (rosterRes.error) throw new Error(`Failed reading player_teams: ${rosterRes.error.message}`);
  const team = teamRes.data as TeamRow | null;
  if (!team) return null;

  const byId = new Map(rawMatches.map((m) => [Number(m.id), m]));
  const matches = rawMatches.map((m) => toTeamMatch(m, teamId, byId));
  const schedule = splitSchedule(matches, nowWallClockIso());
  const outcomes = new Map<number, Outcome>(
    schedule.results.map((m) => [m.id, m.result!.outcome] as const),
  );

  const seasonLabel = team.season_label ?? null;
  const seasonActive = seasonLabel != null && seasonLabel === activeSeason?.label;
  const nextOpponent = schedule.next?.opponent ?? null;
  const quietly = (what: string) => (err: unknown) => {
    console.error(`[loadTeamView] ${what}:`, err);
    return null;
  };
  const [sheetRows, seasonRow, tables, general, headToHead] = await Promise.all([
    // Both teams' lines of each match come back; the opponents' are dropped below.
    fetchInBatches<SheetRow>(
      "match_player_stats",
      "match_id",
      [...outcomes.keys()],
      "match_id, team_id, player_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper, gk",
    ),
    seasonLabel ? getSeasonByLabel(seasonLabel) : Promise.resolve(null),
    loadTables(teamId),
    // The two lines below are extras: the page stands without them.
    seasonLabel
      ? loadGeneralStanding(teamId, seasonLabel, seasonActive).catch(quietly("general standing"))
      : Promise.resolve(null),
    nextOpponent
      ? loadHeadToHead(teamId, nextOpponent.id).catch(quietly("head to head"))
      : Promise.resolve(null),
  ]);

  const totals = playerTotals(
    outcomes,
    sheetRows
      .filter((r) => Number(r.team_id) === teamId)
      .map(
        (r): StatRow => ({
          matchId: Number(r.match_id),
          playerId: Number(r.player_id),
          goals: num(r.goals),
          assists: num(r.assists),
          yellow: num(r.yellow_cards),
          red: num(r.red_cards),
          blue: num(r.blue_cards),
          mvp: !!r.mvp,
          bestGk: !!r.best_goalkeeper,
          gk: !!r.gk,
        }),
      ),
  );

  // Every real player has a profile (paiktes-v3/profileLoader.ts), so every
  // card opens one. The link — used for "open in new tab" — is this team page
  // with that profile open.
  const toSquad = (row: PlayerRow, left: boolean): SquadPlayer => {
    const id = Number(row.id);
    const t = totals.get(id) ?? null;
    const former = !!row.deleted_at;
    return {
      id,
      first: (row.first_name ?? "").trim(),
      last: (row.last_name ?? "").trim(),
      photo: row.photo ?? null,
      former,
      href: `${TEAM_PATH}/${teamId}?player=${id}`,
      left,
      keeper: isKeeper(t),
      numbers: t ? totalsTuple(t) : null,
    };
  };

  const members = new Map<number, PlayerRow>();
  for (const row of rosterRes.data ?? []) {
    const p = one(row.player as unknown as PlayerRow | PlayerRow[] | null);
    if (p && !p.deleted_at) members.set(Number(p.id), p);
  }
  // On the match sheets, but not (or no longer) in the squad.
  const departedIds = [...totals.keys()].filter((id) => !members.has(id));
  const departedRows = await fetchInBatches<PlayerRow>("player", "id", departedIds, PLAYER_COLUMNS);

  const squad = orderSquad([...members.values()].map((p) => toSquad(p, false)));

  const seenTournaments = new Set<number>();
  const tournaments: TeamView["tournaments"] = [];
  for (const row of membershipRes.data ?? []) {
    const t = one(
      row.tournament as unknown as {
        id: number;
        name: string | null;
        status: string | null;
        winner_team_id: number | null;
      } | null,
    );
    if (!t || seenTournaments.has(Number(t.id))) continue;
    seenTournaments.add(Number(t.id));
    tournaments.push({
      id: Number(t.id),
      name: t.name ?? "Τουρνουά",
      status: t.status ?? null,
      won: Number(t.winner_team_id) === teamId,
    });
  }
  // A title whose tournament link to the team is missing still counts.
  for (const t of (titlesRes.data ?? []) as { id: number; name: string | null }[]) {
    if (seenTournaments.has(Number(t.id))) continue;
    seenTournaments.add(Number(t.id));
    tournaments.push({ id: Number(t.id), name: t.name ?? "Τουρνουά", status: "completed", won: true });
  }

  return {
    team: {
      id: Number(team.id),
      name: team.name?.trim() || "Ομάδα",
      logo: team.logo ?? null,
      colour: team.colour ?? null,
      am: team.am != null && String(team.am).trim() !== "" ? String(team.am).trim() : null,
    },
    season: seasonLabel
      ? {
          label: seasonLabel,
          display: seasonRow?.display_label ?? seasonLabel,
          archived: seasonRow?.status === "archived",
        }
      : null,
    general,
    schedule,
    record: seasonRecord(schedule.results),
    kickoffMs: schedule.next ? kickoffEpoch(schedule.next.date) : null,
    headToHead,
    tables,
    squad,
    departed: orderSquad(departedRows.map((p) => toSquad(p, true))),
    tournaments,
  };
}
