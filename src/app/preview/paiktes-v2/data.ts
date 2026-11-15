// Server-side loaders for the players directory and the player page. Both
// read the pre-computed player_season_stats / player_tournament_stats tables
// (never aggregate), and both are called from ISR pages — so a thrown error
// keeps the last good page instead of caching an empty one.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import { listSeasons } from "@/app/lib/seasons";
import { fetchAllRows, fetchInBatches, BATCH_SIZE, PAGE_SIZE } from "@/app/lib/supabasePaging";
import { chunk } from "@/app/lib/playerStatsAggregation";
import { ageFromBirthDate } from "@/app/lib/playerAge";
import type {
  DirectoryData,
  DirectoryPlayer,
  DirectoryTeam,
  StatTuple,
} from "./model";

export const STAT_COLUMNS =
  "matches, wins, goals, assists, mvp_count, best_gk_count, yellow_cards, red_cards, blue_cards";

export type StatColumns = {
  matches: number | null;
  wins: number | null;
  goals: number | null;
  assists: number | null;
  mvp_count: number | null;
  best_gk_count: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
};

export function toTuple(r: StatColumns): StatTuple {
  return [
    r.matches ?? 0,
    r.wins ?? 0,
    r.goals ?? 0,
    r.assists ?? 0,
    r.mvp_count ?? 0,
    r.best_gk_count ?? 0,
    r.yellow_cards ?? 0,
    r.red_cards ?? 0,
    r.blue_cards ?? 0,
  ];
}

type TeamRow = {
  id: number;
  name: string | null;
  logo: string | null;
  season_label: string | null;
  deleted_at: string | null;
  colour?: string | null;
};
type RosterRow = { player_id: number; team_id: number };
type PlayerRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  position: string | null;
  height_cm: number | null;
  birth_date: string | null;
  deleted_at: string | null;
};
type SeasonStatsRow = StatColumns & {
  player_id: number;
  season_label: string;
  primary_team_id: number | null;
};
type TournamentStatsRow = StatColumns & { player_id: number; tournament_id: number };

/**
 * Roster rows for a set of teams. player_teams has no single unique column to
 * page on, so each page is ordered by the (team_id, player_id) pair.
 */
async function fetchRoster(teamIds: number[]): Promise<RosterRow[]> {
  const out: RosterRow[] = [];
  for (const batch of chunk(teamIds, BATCH_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("player_teams")
        .select("player_id, team_id")
        .in("team_id", batch)
        .order("team_id", { ascending: true })
        .order("player_id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading player_teams: ${error.message}`);
      const rows = (data ?? []) as RosterRow[];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return out;
}

/** Main team first (the season row's primary_team_id), then by name. */
function orderTeams(teams: DirectoryTeam[], primaryId: number | null): DirectoryTeam[] {
  return [...teams].sort((a, b) => {
    if (a.id === primaryId && b.id !== primaryId) return -1;
    if (b.id === primaryId && a.id !== primaryId) return 1;
    return a.name.localeCompare(b.name, "el");
  });
}

// ───────────────────────────────────────────────────────────────────────
// Directory: every player rostered on an active-season team
// ───────────────────────────────────────────────────────────────────────

export async function loadDirectory(): Promise<DirectoryData> {
  const season = await getActiveSeasonCached();
  const label = season?.label ?? NO_SEASON;

  const [tournamentsRes, teamRows, seasonRows] = await Promise.all([
    supabaseAdmin
      .from("tournaments")
      .select("id, name")
      .eq("season", label)
      .order("created_at", { ascending: false }),
    fetchAllRows<TeamRow>("teams", "id, name, logo, season_label, deleted_at", "id", {
      column: "season_label",
      value: label,
    }),
    fetchAllRows<SeasonStatsRow>(
      "player_season_stats",
      `player_id, season_label, primary_team_id, ${STAT_COLUMNS}`,
      "player_id",
      { column: "season_label", value: label },
    ),
  ]);
  if (tournamentsRes.error) {
    throw new Error(`Failed reading tournaments: ${tournamentsRes.error.message}`);
  }
  const tournaments = ((tournamentsRes.data ?? []) as { id: number; name: string | null }[]).map(
    (t) => ({ id: t.id, name: t.name ?? "" }),
  );

  const teams: DirectoryTeam[] = teamRows
    .filter((t) => t.deleted_at == null)
    .map((t) => ({ id: t.id, name: t.name ?? "", logo: t.logo }));
  const teamsById = new Map(teams.map((t) => [t.id, t] as const));

  const roster = await fetchRoster(teams.map((t) => t.id));
  const teamIdsByPlayer = new Map<number, Set<number>>();
  for (const r of roster) {
    const set = teamIdsByPlayer.get(r.player_id) ?? new Set<number>();
    set.add(r.team_id);
    teamIdsByPlayer.set(r.player_id, set);
  }
  const playerIds = [...teamIdsByPlayer.keys()];

  const [playerRows, tournamentStats] = await Promise.all([
    fetchInBatches<Omit<PlayerRow, "height_cm" | "birth_date">>(
      "player",
      "id",
      playerIds,
      "id, first_name, last_name, photo, position, deleted_at",
    ),
    // One tournament per read, so each can page on its unique player_id.
    Promise.all(
      tournaments.map((t) =>
        fetchAllRows<TournamentStatsRow>(
          "player_tournament_stats",
          `player_id, tournament_id, ${STAT_COLUMNS}`,
          "player_id",
          { column: "tournament_id", value: t.id },
        ),
      ),
    ),
  ]);

  const seasonByPlayer = new Map(seasonRows.map((r) => [r.player_id, r] as const));
  const byTournamentByPlayer = new Map<number, Record<number, StatTuple>>();
  for (const r of tournamentStats.flat()) {
    const lines = byTournamentByPlayer.get(r.player_id) ?? {};
    lines[r.tournament_id] = toTuple(r);
    byTournamentByPlayer.set(r.player_id, lines);
  }

  const players: DirectoryPlayer[] = playerRows
    .filter((p) => p.deleted_at == null)
    .map((p) => {
      const seasonRow = seasonByPlayer.get(p.id);
      const playerTeams = [...(teamIdsByPlayer.get(p.id) ?? [])]
        .map((id) => teamsById.get(id))
        .filter((t): t is DirectoryTeam => t !== undefined);
      return {
        id: p.id,
        first: (p.first_name ?? "").trim(),
        last: (p.last_name ?? "").trim(),
        photo: p.photo,
        position: (p.position ?? "").trim(),
        teamIds: orderTeams(playerTeams, seasonRow?.primary_team_id ?? null)
          .slice(0, 3)
          .map((t) => t.id),
        season: seasonRow ? toTuple(seasonRow) : null,
        byTournament: byTournamentByPlayer.get(p.id) ?? {},
      };
    });

  return {
    seasonLabel: season?.display_label ?? null,
    teams,
    tournaments,
    players,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Player page
// ───────────────────────────────────────────────────────────────────────

export type ProfileStatLine = {
  key: string;
  label: string;
  /** Where the label links to (tournament page / season archive), if anywhere. */
  href: string | null;
  stats: StatTuple;
};

export type CardTier = "gold" | "silver" | "bronze";

type ContributionRow = {
  player_id: number;
  matches: number | null;
  goals: number | null;
  assists: number | null;
  mvp_count: number | null;
  best_gk_count: number | null;
};

const contribution = (r: ContributionRow) =>
  (r.goals ?? 0) + (r.assists ?? 0) + 2 * (r.mvp_count ?? 0) + 2 * (r.best_gk_count ?? 0);

function tierOf(playerId: number, rows: ContributionRow[]): CardTier | null {
  const played = rows.filter((r) => (r.matches ?? 0) > 0);
  const own = played.find((r) => r.player_id === playerId);
  if (!own) return null;
  const score = contribution(own);
  const better = played.filter((r) => contribution(r) > score).length;
  const share = better / played.length;
  return share < 0.1 ? "gold" : share < 0.4 ? "silver" : "bronze";
}

export type PlayerProfile = {
  id: number;
  first: string;
  last: string;
  photo: string | null;
  position: string;
  age: number | null;
  heightCm: number | null;
  /** Active-season teams, main team first. */
  teams: DirectoryTeam[];
  /** Printed label of the active season; null if none is active. */
  seasonLabel: string | null;
  /** Active-season totals; null = no appearances yet this season. */
  season: StatTuple | null;
  /** Main team's colour as "#rrggbb", if it has a valid one. */
  teamColour: string | null;
  /**
   * Where the player's season stands among everyone who played this season,
   * by contribution (goals + assists + 2 per MVP / best-goalkeeper award):
   * top 10% gold, next 30% silver, the rest bronze. null = no appearances.
   */
  tier: CardTier | null;
  /** One line per active-season tournament the player has numbers in. */
  tournaments: ProfileStatLine[];
  /** One line per earlier season, newest first. */
  history: ProfileStatLine[];
};

/** null when the player does not exist or is archived. */
export async function loadPlayerProfile(playerId: number): Promise<PlayerProfile | null> {
  const { data: playerData, error: playerErr } = await supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, position, height_cm, birth_date, deleted_at")
    .eq("id", playerId)
    .maybeSingle();
  if (playerErr) throw new Error(`Failed reading player ${playerId}: ${playerErr.message}`);
  const player = playerData as PlayerRow | null;
  if (!player || player.deleted_at != null) return null;

  const activeSeason = await getActiveSeasonCached();
  const [season, seasons, rosterRes, seasonStatsRes, tournamentStatsRes, contributionRows] = await Promise.all([
    activeSeason,
    listSeasons(),
    supabaseAdmin.from("player_teams").select("player_id, team_id").eq("player_id", playerId),
    supabaseAdmin
      .from("player_season_stats")
      .select(`player_id, season_label, primary_team_id, ${STAT_COLUMNS}`)
      .eq("player_id", playerId),
    supabaseAdmin
      .from("player_tournament_stats")
      .select(`player_id, tournament_id, ${STAT_COLUMNS}`)
      .eq("player_id", playerId),
    fetchAllRows<ContributionRow>(
      "player_season_stats",
      "player_id, matches, goals, assists, mvp_count, best_gk_count",
      "player_id",
      { column: "season_label", value: activeSeason?.label ?? NO_SEASON },
    ),
  ]);
  if (rosterRes.error) throw new Error(`Failed reading player_teams: ${rosterRes.error.message}`);
  if (seasonStatsRes.error) {
    throw new Error(`Failed reading player_season_stats: ${seasonStatsRes.error.message}`);
  }
  if (tournamentStatsRes.error) {
    throw new Error(`Failed reading player_tournament_stats: ${tournamentStatsRes.error.message}`);
  }

  const activeLabel = season?.label ?? NO_SEASON;
  const seasonRows = (seasonStatsRes.data ?? []) as SeasonStatsRow[];
  const tournamentRows = (tournamentStatsRes.data ?? []) as TournamentStatsRow[];
  const teamIds = ((rosterRes.data ?? []) as RosterRow[]).map((r) => r.team_id);
  const tournamentIds = tournamentRows.map((r) => r.tournament_id);

  const [teamsRes, tournamentsRes] = await Promise.all([
    teamIds.length
      ? supabaseAdmin
          .from("teams")
          .select("id, name, logo, colour, season_label, deleted_at")
          .in("id", teamIds)
      : Promise.resolve({ data: [] as TeamRow[], error: null }),
    tournamentIds.length
      ? supabaseAdmin
          .from("tournaments")
          .select("id, name, season, created_at")
          .in("id", tournamentIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as { id: number; name: string | null; season: string | null }[],
          error: null,
        }),
  ]);
  if (teamsRes.error) throw new Error(`Failed reading teams: ${teamsRes.error.message}`);
  if (tournamentsRes.error) {
    throw new Error(`Failed reading tournaments: ${tournamentsRes.error.message}`);
  }

  const activeSeasonRow = seasonRows.find((r) => r.season_label === activeLabel) ?? null;
  const activeTeamRows = ((teamsRes.data ?? []) as TeamRow[]).filter(
    (t) => t.season_label === activeLabel && t.deleted_at == null,
  );
  const teams = orderTeams(
    activeTeamRows
      .map((t) => ({ id: t.id, name: t.name ?? "", logo: t.logo })),
    activeSeasonRow?.primary_team_id ?? null,
  );
  const mainColour = activeTeamRows.find((t) => t.id === teams[0]?.id)?.colour ?? null;

  const statsByTournament = new Map(tournamentRows.map((r) => [r.tournament_id, r] as const));
  const tournaments: ProfileStatLine[] = (
    (tournamentsRes.data ?? []) as { id: number; name: string | null; season: string | null }[]
  )
    .filter((t) => t.season === activeLabel)
    .flatMap((t) => {
      const row = statsByTournament.get(t.id);
      return row
        ? [{ key: `t-${t.id}`, label: t.name ?? "", href: `/tournaments/${t.id}`, stats: toTuple(row) }]
        : [];
    });

  const displayBySeason = new Map(seasons.map((s) => [s.label, s.display_label] as const));
  const history: ProfileStatLine[] = seasonRows
    .filter((r) => r.season_label !== activeLabel)
    .sort((a, b) => b.season_label.localeCompare(a.season_label))
    .map((r) => ({
      key: `s-${r.season_label}`,
      label: displayBySeason.get(r.season_label) ?? r.season_label,
      href: displayBySeason.has(r.season_label)
        ? `/seasons/${encodeURIComponent(r.season_label)}`
        : null,
      stats: toTuple(r),
    }));

  return {
    id: player.id,
    first: (player.first_name ?? "").trim(),
    last: (player.last_name ?? "").trim(),
    photo: player.photo,
    position: (player.position ?? "").trim(),
    age: ageFromBirthDate(player.birth_date),
    heightCm: player.height_cm ?? null,
    teams,
    seasonLabel: season?.display_label ?? null,
    season: activeSeasonRow ? toTuple(activeSeasonRow) : null,
    teamColour: mainColour && /^#[0-9A-Fa-f]{6}$/.test(mainColour) ? mainColour : null,
    tier: tierOf(player.id, contributionRows),
    tournaments,
    history,
  };
}
