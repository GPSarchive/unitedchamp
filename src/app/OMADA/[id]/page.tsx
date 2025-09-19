// app/OMADA/[id]/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import TeamHeader from "@/app/OMADA/[id]/TeamHeader";
import PlayersSection from "@/app/OMADA/[id]/PlayersSection";
import MatchesSection from "@/app/OMADA/[id]/MatchesSection";
import {
  type Team,
  type PlayerAssociation,
  type Match,
  normalizeTeamPlayers,
  type TeamPlayersRowRaw,
} from "@/app/lib/types";

type TeamPageProps = {
  // Next.js 15: params/searchParams are Promises
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

  // ── Players (normalize stats → array with at most 1 row) ───────────────────────
  const { data: playerAssociationsData, error: playersError } = await supabaseAdmin
    .from("player_teams")
    .select(`
      id,
      player:player_id (
        id,
        first_name,
        last_name,
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
    `)
    .eq("team_id", teamId)
    .order("player_id", { ascending: true })
    .order("id", { foreignTable: "player.player_statistics", ascending: false })
    .limit(1, { foreignTable: "player.player_statistics" });

  const playerAssociations: PlayerAssociation[] =
    playersError || !playerAssociationsData
      ? []
      : normalizeTeamPlayers(playerAssociationsData as TeamPlayersRowRaw[]);

  // ── Matches ────────────────────────────────────────────────────────────────────
  const { data: matchesData, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select(`
      id,
      match_date,
      status,
      team_a_score,
      team_b_score,
      winner_team_id,
      team_a:teams!matches_team_a_id_fkey (id, name, logo),
      team_b:teams!matches_team_b_id_fkey (id, name, logo)
    `)
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("match_date", { ascending: false });

  const matches = (matchesData as Match[] | null) ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 [background-image:radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:18px_18px] overflow-x-hidden">
      <div className="container mx-auto px-6 pt-6 pb-10">
        <Link href="/OMADES" className="text-blue-400 hover:underline mb-4 inline-block">
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
