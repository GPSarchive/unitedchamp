import Link from "next/link";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import TeamHeader from "@/app/components/OMADAPageComponents/TeamHeader";
import PlayersSection from "@/app/components/OMADAPageComponents/PlayersSection";
import MatchesSection from "@/app/components/OMADAPageComponents/MatchesSection";
import { Team, PlayerAssociation, Match } from "@/app/lib/types";

interface TeamPageProps {
  params: { id: string };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const teamId = parseInt(params.id, 10);

  if (isNaN(teamId)) {
    return <div className="text-red-400">Invalid team ID</div>;
  }

  // Team details
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

  // Players
  const { data: playerAssociationsData, error: playersError } =
    await supabaseAdmin
      .from("player_teams")
      .select(
        `
      player:player_id (
        id,
        first_name,
        last_name,
        player_statistics (
          age,
          total_goals,
          total_assists
        )
      )
    `
      )
      .eq("team_id", teamId);

  const playerAssociations =
    (playerAssociationsData as PlayerAssociation[] | null) ?? null;

  // Matches
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
      team_a:team_a_id (id, name, logo),
      team_b:team_b_id (id, name, logo)
    `
    )
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("match_date", { ascending: false });

  const matches = (matchesData as Match[] | null) ?? null;

  return (
    <div
      className="min-h-screen bg-zinc-950
                 [background-image:radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)]
                 [background-size:18px_18px] overflow-x-hidden"
    >
      <div className="container mx-auto px-6 pt-6 pb-10">
        <Link
          href="/OMADES"
          className="text-blue-400 hover:underline mb-4 inline-block"
        >
          &larr; Back to Teams
        </Link>

        <TeamHeader team={team as Team} />

        <PlayersSection
          playerAssociations={playerAssociations}
          errorMessage={playersError?.message}
        />

        <MatchesSection
          matches={matches}
          teamId={teamId}
          errorMessage={matchesError?.message}
        />
      </div>
    </div>
  );
}
