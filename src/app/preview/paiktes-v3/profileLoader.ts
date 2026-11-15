// The profile of ANY player, for the overlay that opens when a player card is
// clicked: every card opens one, not only the cards of the current squads.
//
//   · A player in an active-season squad gets exactly what the players page
//     shows (profileFor over the cached season directory).
//   · Anyone else — a player who left mid-season, an archived («πρώην»)
//     player, a player seen on an older match — gets the same shape, built
//     here for that one player and centred on their most recent season with
//     appearances (focusSeason): that season's totals on the card, split by
//     team and by tournament, ranked among that season's players, and the
//     other seasons as history.
//
// Reads the stored season / tournament totals like the players page; only the
// per-team split is aggregated (from this player's own match rows, with the
// same aggregator as the season writer).
import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import { listSeasons } from "@/app/lib/seasons";
import { fetchAllRows, fetchInBatches } from "@/app/lib/supabasePaging";
import { aggregateTournamentBuckets, type MpsRow } from "@/app/lib/playerStatsAggregation";
import { ageFromBirthDate } from "@/app/lib/playerAge";
import { STAT_COLUMNS, toTuple, type StatColumns } from "../paiktes-v2/data";
import type { DirectoryTeam, StatTuple } from "../paiktes-v2/model";
import { loadDirectoryV3Cached, MPS_COLUMNS, type SeasonLine, type TeamLine } from "./data";
import { focusSeason, profileFor, type PlayerProfile, type PlayerSeasonRow } from "./profile";
import type { TableLine } from "./SeasonStats";
import { seasonStanding, type StandingPool } from "./standing";

type PlayerRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  position: string | null;
  height_cm: number | null;
  birth_date: string | null;
  deleted_at: string | null;
  is_dummy: boolean | null;
};
type TeamRow = {
  id: number;
  name: string | null;
  logo: string | null;
  season_label: string | null;
  deleted_at: string | null;
};
type TournamentRow = { id: number; name: string | null; season: string | null; created_at: string | null };
type MatchRow = { id: number; winner_team_id: number | null; tournament_id: number | null };
type SeasonStatsRow = StatColumns & { season_label: string; primary_team_id: number | null };
type TournamentStatsRow = StatColumns & { tournament_id: number };

const must = <T>(res: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (res.error) throw new Error(`Failed reading ${what}: ${res.error.message}`);
  return (res.data ?? []) as T;
};

/** Everyone with numbers in a season: what a past season's ranks are counted among. */
const seasonPool = unstable_cache(
  async (label: string): Promise<StandingPool> => {
    const rows = await fetchAllRows<StatColumns & { player_id: number }>(
      "player_season_stats",
      `player_id, ${STAT_COLUMNS}`,
      "player_id",
      { column: "season_label", value: label },
    );
    return rows.map((r) => ({ id: r.player_id, season: toTuple(r) }));
  },
  ["preview-profile-season-pool"],
  { revalidate: 300 },
);

async function loadLooseProfile(playerId: number): Promise<PlayerProfile | null> {
  const [playerRes, active, seasons, rosterRes, seasonRes, tournamentStatsRes, matchRowsRes] = await Promise.all([
    supabaseAdmin
      .from("player")
      .select("id, first_name, last_name, photo, position, height_cm, birth_date, deleted_at, is_dummy")
      .eq("id", playerId)
      .maybeSingle(),
    getActiveSeasonCached(),
    listSeasons(),
    supabaseAdmin.from("player_teams").select("team_id").eq("player_id", playerId),
    supabaseAdmin
      .from("player_season_stats")
      .select(`season_label, primary_team_id, ${STAT_COLUMNS}`)
      .eq("player_id", playerId),
    supabaseAdmin.from("player_tournament_stats").select(`tournament_id, ${STAT_COLUMNS}`).eq("player_id", playerId),
    supabaseAdmin.from("match_player_stats").select(MPS_COLUMNS).eq("player_id", playerId),
  ]);
  if (playerRes.error) throw new Error(`Failed reading player ${playerId}: ${playerRes.error.message}`);
  const p = playerRes.data as PlayerRow | null;
  if (!p || p.is_dummy) return null;

  const rosterTeamIds = must(rosterRes, "player_teams").map((r: { team_id: number }) => r.team_id);
  const seasonRows: PlayerSeasonRow[] = must(seasonRes, "player_season_stats").map((r: SeasonStatsRow) => ({
    label: r.season_label,
    primaryTeamId: r.primary_team_id,
    stats: toTuple(r),
  }));
  const tournamentStats = must(tournamentStatsRes, "player_tournament_stats") as TournamentStatsRow[];
  const matchRows = must(matchRowsRes, "match_player_stats") as unknown as MpsRow[];

  const activeLabel = active?.label ?? NO_SEASON;
  const focus = focusSeason(seasonRows, activeLabel);
  const focusRow = seasonRows.find((r) => r.label === focus) ?? null;

  // The matches and teams this player's rows point at, then the tournaments
  // of both those matches and the stored tournament totals.
  const teamIds = new Set<number>(rosterTeamIds);
  for (const r of matchRows) teamIds.add(r.team_id);
  if (focusRow?.primaryTeamId != null) teamIds.add(focusRow.primaryTeamId);
  const [matches, teamRows] = await Promise.all([
    fetchInBatches<MatchRow>("matches", "id", [...new Set(matchRows.map((r) => r.match_id))], "id, winner_team_id, tournament_id"),
    fetchInBatches<TeamRow>("teams", "id", [...teamIds], "id, name, logo, season_label, deleted_at"),
  ]);
  const tournamentIds = new Set<number>(tournamentStats.map((r) => r.tournament_id));
  for (const m of matches) if (m.tournament_id != null) tournamentIds.add(m.tournament_id);
  const tournaments = (
    await fetchInBatches<TournamentRow>("tournaments", "id", [...tournamentIds], "id, name, season, created_at")
  ).sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id - a.id);
  const focusTournamentIds = new Set(tournaments.filter((t) => t.season === focus).map((t) => t.id));

  // The focus season split by team, from this player's own match rows.
  const winnerByMatch = new Map<number, number | null>();
  for (const m of matches) {
    if (m.tournament_id != null && focusTournamentIds.has(m.tournament_id)) winnerByMatch.set(m.id, m.winner_team_id);
  }
  const rowsByTeam = new Map<number, MpsRow[]>();
  for (const r of matchRows) {
    if (!winnerByMatch.has(r.match_id)) continue;
    const list = rowsByTeam.get(r.team_id) ?? [];
    list.push(r);
    rowsByTeam.set(r.team_id, list);
  }
  const lines: TeamLine[] = [];
  for (const [teamId, rows] of rowsByTeam) {
    const b = aggregateTournamentBuckets(rows, winnerByMatch).get(playerId);
    if (!b || b.matches === 0) continue;
    lines.push({
      teamId,
      stats: [b.matches, b.wins, b.goals, b.assists, b.mvp_count, b.best_gk_count, b.yellow_cards, b.red_cards, b.blue_cards],
    });
  }
  lines.sort((a, b) => b.stats[0] - a.stats[0] || a.teamId - b.teamId);

  // The focus season's teams: their squads in it, main team first; failing
  // that, the season row's main team. Archived teams are left out (no page).
  const teamsById = new Map(teamRows.map((t) => [t.id, t] as const));
  const live = (t: TeamRow | undefined): t is TeamRow => !!t && t.deleted_at == null;
  let seasonTeams = [...new Set(rosterTeamIds)].map((id) => teamsById.get(id)).filter(live).filter((t) => t.season_label === focus);
  if (seasonTeams.length === 0 && focusRow?.primaryTeamId != null) {
    const main = teamsById.get(focusRow.primaryTeamId);
    if (live(main)) seasonTeams = [main];
  }
  const primary = focusRow?.primaryTeamId ?? null;
  const teams: DirectoryTeam[] = seasonTeams
    .map((t) => ({ id: t.id, name: t.name ?? "", logo: t.logo }))
    .sort((a, b) => Number(b.id === primary) - Number(a.id === primary) || a.name.localeCompare(b.name, "el"))
    .slice(0, 3);

  const teamLines: TableLine[] = lines.map((line) => {
    const team = teamsById.get(line.teamId);
    return {
      key: `team-${line.teamId}`,
      label: team?.name || "Ομάδα",
      href: live(team) ? `/OMADA/${line.teamId}` : null,
      logo: team?.logo ?? null,
      stats: line.stats,
    };
  });

  const byTournament: Record<number, StatTuple> = {};
  for (const r of tournamentStats) if (focusTournamentIds.has(r.tournament_id)) byTournament[r.tournament_id] = toTuple(r);

  const displayBySeason = new Map(seasons.map((s) => [s.label, s.display_label] as const));
  const history: SeasonLine[] = seasonRows
    .filter((r) => r.label !== focus)
    .sort((a, b) => b.label.localeCompare(a.label))
    .map((r) => ({
      season: r.label,
      label: displayBySeason.get(r.label) ?? r.label,
      href: displayBySeason.has(r.label) ? `/seasons/${encodeURIComponent(r.label)}` : null,
      stats: r.stats,
    }));

  // Ranked among the same people as everyone else that season: the current
  // squads for the current season (as on the players page), otherwise
  // everyone with numbers in it.
  const me = { id: playerId, season: focusRow?.stats ?? null };
  const pool: StandingPool =
    focus === activeLabel ? (await loadDirectoryV3Cached()).players : await seasonPool(focus);
  const standing = seasonStanding(pool.some((x) => x.id === playerId) ? pool : [...pool, me], playerId);

  return {
    player: {
      id: p.id,
      first: (p.first_name ?? "").trim(),
      last: (p.last_name ?? "").trim(),
      photo: p.photo,
      position: (p.position ?? "").trim(),
      teamIds: teams.map((t) => t.id),
      season: focusRow?.stats ?? null,
      byTournament,
    },
    teams,
    extra: { age: ageFromBirthDate(p.birth_date), heightCm: p.height_cm ?? null, history, teams: lines },
    standing,
    teamLines,
    tournaments: tournaments
      .filter((t) => byTournament[t.id] !== undefined)
      .map((t) => ({ id: t.id, name: t.name ?? "" })),
    seasonLabel: displayBySeason.get(focus) ?? (focus === NO_SEASON ? null : focus),
    former: p.deleted_at != null,
  };
}

const loadLooseProfileCached = unstable_cache(loadLooseProfile, ["preview-player-profile-loose"], {
  revalidate: 300,
});

/** The profile of any player by id; null for an unknown or dummy player. */
export async function loadAnyProfile(playerId: number): Promise<PlayerProfile | null> {
  return profileFor(await loadDirectoryV3Cached(), playerId) ?? (await loadLooseProfileCached(playerId));
}
