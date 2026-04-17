import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  type Team,
  type PlayerAssociation,
  type Match,
  normalizeTeamPlayers,
  type TeamPlayersRowRaw,
} from "@/app/lib/types";
import TeamClient from "./TeamClient";

type TeamPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { id } = await params;
  const teamId = Number.parseInt(id, 10);

  if (Number.isNaN(teamId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] font-mono text-sm">
        Μη έγκυρος κωδικός ομάδας
      </div>
    );
  }

  // Team details
  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (teamError || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] p-8 font-mono text-sm">
        Σφάλμα φόρτωσης ομάδας: {teamError?.message || "Η ομάδα δεν βρέθηκε"}
      </div>
    );
  }

  // Tournament memberships (dedup per tournament — a team can be linked via multiple groups)
  const { data: tournamentMembership } = await supabaseAdmin
    .from("tournament_teams")
    .select(
      `id, tournament:tournament_id (id, name, season, status, winner_team_id)`
    )
    .eq("team_id", teamId)
    .order("tournament_id", { ascending: false });

  const seen = new Set<number>();
  const tournaments = (tournamentMembership ?? [])
    .map((r: any) => r.tournament)
    .filter((t: any) => {
      if (!t || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

  // Championships
  const { data: winsList } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, season")
    .eq("winner_team_id", teamId);

  const wins = winsList ?? [];

  // Players + latest stats snapshot
  const { data: playerAssociationsData } = await supabaseAdmin
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
            age,
            total_goals,
            total_assists,
            yellow_cards,
            red_cards,
            blue_cards,
            created_at,
            updated_at
          )
        )
      `
    )
    .eq("team_id", teamId)
    .order("player_id", { ascending: true })
    .order("id", {
      foreignTable: "player.player_statistics",
      ascending: false,
    })
    .limit(1, { foreignTable: "player.player_statistics" });

  const playerAssociations: PlayerAssociation[] = !playerAssociationsData
    ? []
    : normalizeTeamPlayers(playerAssociationsData as TeamPlayersRowRaw[]).filter(
        (a) => !(a.player as any).deleted_at
      );

  // Aggregate player stats from match_player_stats for this team's finished matches
  const { data: teamMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .eq("status", "finished");

  const matchIds = (teamMatches ?? []).map((m) => m.id);

  const { data: matchPlayerStats } = await supabaseAdmin
    .from("match_player_stats")
    .select(
      `
        player_id,
        goals,
        assists,
        yellow_cards,
        red_cards,
        blue_cards,
        mvp,
        best_goalkeeper
      `
    )
    .in("match_id", matchIds.length > 0 ? matchIds : [0])
    .eq("team_id", teamId);

  const seasonStatsByPlayer: Record<
    number,
    {
      matches: number;
      goals: number;
      assists: number;
      yellow_cards: number;
      red_cards: number;
      blue_cards: number;
      mvp: number;
      best_gk: number;
    }
  > = {};

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

  // Matches
  const { data: matchesData } = await supabaseAdmin
    .from("matches")
    .select(
      `
        id,
        match_date,
        status,
        team_a_score,
        team_b_score,
        winner_team_id,
        stage_id,
        group_id,
        matchday,
        round,
        team_a:teams!matches_team_a_id_fkey (id, name, logo),
        team_b:teams!matches_team_b_id_fkey (id, name, logo),
        tournament:tournament_id (id, name, season, slug, logo)
      `
    )
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("match_date", { ascending: false });

  const matches = (matchesData as unknown as Match[] | null) ?? null;

  return (
    <TeamClient
      team={team as Team}
      teamId={teamId}
      tournaments={tournaments}
      wins={wins}
      playerAssociations={playerAssociations}
      seasonStatsByPlayer={seasonStatsByPlayer}
      matches={matches}
    />
  );
}
