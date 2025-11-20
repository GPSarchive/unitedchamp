import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin"; // Server-side Supabase client
import TeamSidebar from "./TeamSidebar";
import TeamMatchesTimeline from "./TeamMatchesTimeline"; // Use the new client-side component
// import VantaBg from "../../lib/VantaBg";
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
      .order("player_id", { ascending: true });

  const playerAssociations: PlayerAssociation[] =
    playersError || !playerAssociationsData
      ? []
      : normalizeTeamPlayers(playerAssociationsData as TeamPlayersRowRaw[]);

  // ── Per-player per-season stats (scoped to this team) ──────────────────────────
  const { data: seasonStats, error: pssErr } = await supabaseAdmin
    .from("player_season_stats")
    .select(
      `
        player_id,
        season,
        matches,
        goals,
        assists,
        yellow_cards,
        red_cards,
        blue_cards,
        mvp,
        best_gk,
        updated_at
      `
    )
    .eq("team_id", teamId)
    .order("season", { ascending: false });

  const seasonStatsByPlayer: Record<number, any[]> = (seasonStats ?? []).reduce(
    (acc: Record<number, any[]>, row: any) => {
      if (!acc[row.player_id]) acc[row.player_id] = [];
      acc[row.player_id].push(row);
      return acc;
    },
    {}
  );

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
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden bg-black">
      {/* Vanta background: fixed to viewport only */}
      {/* <div className="fixed inset-0 -z-20 h-screen w-screen">
        <VantaBg className="h-full w-full" />
      </div> */}

      {/* Subtle overlay for contrast */}
      {/* <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-to-b from-black/50 via-black/30 to-black/60" /> */}

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