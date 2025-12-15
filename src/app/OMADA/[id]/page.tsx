import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin"; // Server-side Supabase client
import TeamSidebar from "./TeamSidebar";
import TeamMatchesTimeline from "./TeamMatchesTimeline"; // Use the new client-side component
import VantaBg from "../../lib/VantaBg";
import {
  type Team,
  type PlayerAssociation,
  type Match,
  normalizeTeamPlayers,
  type TeamPlayersRowRaw,
} from "@/app/lib/types";
import TeamRosterShowcase from "./TeamRosterShowcase";

type TeamPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { id } = await params;
  const teamId = Number.parseInt(id, 10);

  if (Number.isNaN(teamId)) {
    return <div className="text-red-400">Invalid team ID</div>;
  }

  // ── Team details ────────────────────────────────────────────────────────────────
  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (teamError || !team) {
    return (
      <div className="text-red-400">
        Error loading team: {teamError?.message || "Team not found"}
      </div>
    );
  }

  // ── Tournament membership (this team in tournaments) ───────────────────────────
  const { data: tournamentMembership, error: membershipErr } =
    await supabaseAdmin
      .from("tournament_teams")
      .select(
        `id, tournament:tournament_id (id, name, season, status, winner_team_id)`
      )
      .eq("team_id", teamId)
      .order("tournament_id", { ascending: false });

  const tournaments =
    (tournamentMembership ?? [])
      .map((r: any) => r.tournament)
      .filter(Boolean) ?? [];

  // ── Tournament wins (championships) ────────────────────────────────────────────
  const { data: winsList, error: winsErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, season")
    .eq("winner_team_id", teamId);

  const wins = winsList ?? [];

  // ── Players: include master data + 1 latest statistics row ─────────────────────
  const { data: playerAssociationsData, error: playersError } =
    await supabaseAdmin
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

  const playerAssociations: PlayerAssociation[] =
    playersError || !playerAssociationsData
      ? []
      : normalizeTeamPlayers(playerAssociationsData as TeamPlayersRowRaw[]);

  // ── Aggregate player stats from match_player_stats ────────────────────────────
  // Get all matches for this team
  const { data: teamMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .eq("status", "finished");

  const matchIds = (teamMatches ?? []).map((m) => m.id);

  // Get all player stats for those matches, filtered by team_id
  const { data: matchPlayerStats, error: pssErr } = await supabaseAdmin
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

  // Aggregate stats by player
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

    const playerStats = seasonStatsByPlayer[stat.player_id];
    playerStats.matches += 1;
    playerStats.goals += stat.goals || 0;
    playerStats.assists += stat.assists || 0;
    playerStats.yellow_cards += stat.yellow_cards || 0;
    playerStats.red_cards += stat.red_cards || 0;
    playerStats.blue_cards += stat.blue_cards || 0;
    playerStats.mvp += stat.mvp ? 1 : 0;
    playerStats.best_gk += stat.best_goalkeeper ? 1 : 0;
  }

  // ── Matches ─────────────────────────
  const { data: matchesData, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select(
      `
        id,
        match_date,
        status,
        team_a_score,
        team_b_score,
        winner_team_id,
        team_a:teams!matches_team_a_id_fkey (id, name, logo),
        team_b:teams!matches_team_b_id_fkey (id, name, logo),
        tournament:tournament_id (id, name, season, slug)
      `
    )
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("match_date", { ascending: false });

  const matches = (matchesData as unknown as Match[] | null) ?? null;

  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background that stays in place while content scrolls */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      {/* Page content scrolling over the fixed background */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
          {/* Top: team hero */}
          <TeamSidebar
            team={team as Team}
            tournaments={tournaments}
            wins={wins}
            errors={{
              membership: membershipErr?.message,
              wins: winsErr?.message,
            }}
          />

          {/* Middle: roster */}
          <TeamRosterShowcase
            playerAssociations={playerAssociations}
            seasonStatsByPlayer={seasonStatsByPlayer}
            errorMessage={playersError?.message || pssErr?.message}
          />

          {/* Bottom: matches timeline */}
          <TeamMatchesTimeline
            matches={matches}
            teamId={teamId}
            errorMessage={matchesError?.message}
          />
        </div>
      </div>
    </section>
  );
}