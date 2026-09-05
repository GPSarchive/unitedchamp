// Data loader shared by the live team page (/OMADA/[id]) and the archived
// one (/seasons/[season]/teams/[id]). Teams are per-season rows (contract D1),
// so every query keyed by team id is already season-scoped: the roster, the
// matches and the per-player stats below belong to that one season.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getSeasonStandings } from "@/app/lib/refreshStandings";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { rankVisible } from "@/app/geniki-katataxi/standingsShape";
import {
  type Team,
  type PlayerAssociation,
  type Match,
  normalizeTeamPlayers,
  type TeamPlayersRowRaw,
} from "@/app/lib/types";

export type TeamPageTeam = Team & { season_label: string | null; deleted_at: string | null };

export type SeasonStats = {
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number;
  best_gk: number;
};

export type TeamPageData = {
  team: TeamPageTeam;
  tournaments: {
    id: number;
    name: string | null;
    season: string | null;
    status?: string | null;
    winner_team_id?: number | null;
  }[];
  wins: { id: number; name: string | null; season: string | null }[];
  playerAssociations: PlayerAssociation[];
  seasonStatsByPlayer: Record<number, SeasonStats>;
  matches: Match[] | null;
  /**
   * The team's Γενική Κατάταξη position for its season, ranked with the same
   * rule as the standings page it links to (see standingsShape.rankVisible).
   */
  standing: { rank: number; points: number } | null;
};

export type TeamPageResult =
  | { ok: true; data: TeamPageData }
  /** `notFound` = no such team row (callers answer 404, not an error card). */
  | { ok: false; error: string; notFound?: boolean };

export async function loadTeamPageData(teamId: number): Promise<TeamPageResult> {
  // Independent reads batched in one round-trip wave. The stats aggregation
  // below is the only query that needs a prior result (the finished-match ids).
  const [
    { data: team, error: teamError },
    { data: tournamentMembership },
    { data: winsList },
    { data: playerAssociationsData },
    { data: teamMatches },
    { data: matchesData },
  ] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name, logo, colour, am, created_at, season_label, deleted_at")
      .eq("id", teamId)
      .maybeSingle(),
    // Tournament memberships (dedup per tournament — a team can be linked via multiple groups)
    supabaseAdmin
      .from("tournament_teams")
      .select(`id, tournament:tournament_id (id, name, season, status, winner_team_id)`)
      .eq("team_id", teamId)
      .order("tournament_id", { ascending: false }),
    // Championships
    supabaseAdmin.from("tournaments").select("id, name, season").eq("winner_team_id", teamId),
    // Players + latest stats snapshot (only `age` is rendered from it;
    // season aggregates come from match_player_stats below)
    supabaseAdmin
      .from("player_teams")
      .select(
        `
        id,
        player:player_id (
          id,
          first_name,
          last_name,
          photo,
          height_cm,
          position,
          birth_date,
          deleted_at,
          player_statistics (
            id,
            age
          )
        )
      `,
      )
      .eq("team_id", teamId)
      .order("player_id", { ascending: true })
      .order("id", { foreignTable: "player.player_statistics", ascending: false })
      .limit(1, { foreignTable: "player.player_statistics" }),
    // Finished-match ids feeding the stats aggregation
    supabaseAdmin
      .from("matches")
      .select("id")
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .eq("status", "finished"),
    // Matches (full history of this team row, newest first)
    supabaseAdmin
      .from("matches")
      .select(
        `
        id,
        match_date,
        status,
        team_a_score,
        team_b_score,
        team_a:teams!matches_team_a_id_fkey (id, name, logo),
        team_b:teams!matches_team_b_id_fkey (id, name, logo),
        tournament:tournament_id (id, name)
      `,
      )
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .order("match_date", { ascending: false }),
  ]);

  if (teamError) return { ok: false, error: teamError.message };
  if (!team) return { ok: false, error: "Η ομάδα δεν βρέθηκε", notFound: true };

  const seen = new Set<number>();
  const tournaments = (tournamentMembership ?? [])
    .map((r: any) => r.tournament)
    .filter((t: any) => {
      if (!t || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

  const playerAssociations: PlayerAssociation[] = !playerAssociationsData
    ? []
    : normalizeTeamPlayers(playerAssociationsData as TeamPlayersRowRaw[]).filter(
        (a) => !(a.player as any).deleted_at,
      );

  // Aggregate player stats from match_player_stats for this team's finished matches
  const matchIds = (teamMatches ?? []).map((m) => m.id);
  const seasonLabel = (team.season_label as string | null) ?? null;
  const [{ data: matchPlayerStats }, standingRows, seasonRow] = await Promise.all([
    matchIds.length
      ? supabaseAdmin
          .from("match_player_stats")
          .select("player_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper")
          .in("match_id", matchIds)
          .eq("team_id", teamId)
      : Promise.resolve({ data: null }),
    seasonLabel
      ? getSeasonStandings(seasonLabel).catch((err) => {
          console.error("[loadTeamPageData] standings:", err);
          return [];
        })
      : Promise.resolve([]),
    seasonLabel ? getSeasonByLabel(seasonLabel).catch(() => null) : Promise.resolve(null),
  ]);

  // Γενική Κατάταξη position with the SAME rule as the table the page links
  // to (standingsShape.rankVisible): the live page hides soft-deleted teams
  // and closes the ranks up, the archive shows every team of the season.
  let standing: TeamPageData["standing"] = null;
  if (seasonLabel && standingRows.length > 0) {
    let visibleQuery = supabaseAdmin.from("teams").select("id").eq("season_label", seasonLabel);
    if (seasonRow?.status === "active") visibleQuery = visibleQuery.is("deleted_at", null);
    const { data: visibleTeams, error: visibleErr } = await visibleQuery;
    if (visibleErr) console.error("[loadTeamPageData] visible teams:", visibleErr.message);
    const ranked = rankVisible(
      standingRows,
      new Set((visibleTeams ?? []).map((t) => t.id as number)),
    );
    const mine = ranked.find((l) => l.teamId === teamId);
    standing = mine ? { rank: mine.rank, points: mine.points } : null;
  }

  const seasonStatsByPlayer: Record<number, SeasonStats> = {};
  for (const stat of matchPlayerStats ?? []) {
    if (!seasonStatsByPlayer[stat.player_id]) {
      seasonStatsByPlayer[stat.player_id] = {
        matches: 0,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
        mvp: 0,
        best_gk: 0,
      };
    }
    const ps = seasonStatsByPlayer[stat.player_id];
    ps.matches += 1;
    ps.goals += stat.goals || 0;
    ps.assists += stat.assists || 0;
    ps.yellow_cards += stat.yellow_cards || 0;
    ps.red_cards += stat.red_cards || 0;
    ps.blue_cards += stat.blue_cards || 0;
    ps.mvp += stat.mvp ? 1 : 0;
    ps.best_gk += stat.best_goalkeeper ? 1 : 0;
  }

  return {
    ok: true,
    data: {
      team: team as unknown as TeamPageTeam,
      tournaments,
      wins: winsList ?? [],
      playerAssociations,
      seasonStatsByPlayer,
      matches: (matchesData as unknown as Match[] | null) ?? null,
      standing,
    },
  };
}
