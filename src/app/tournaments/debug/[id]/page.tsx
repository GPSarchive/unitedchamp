// app/tournaments/debug/[id]/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { notFound } from "next/navigation";
import TournamentDebugClient from "./TournamentDebugClient";

export default async function TournamentDebugPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isFinite(tournamentId) || tournamentId <= 0) {
    notFound();
  }

  try {
    // Fetch all tournament data for debugging
    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    // Fetch stages
    const { data: stages, error: stagesError } = await supabaseAdmin
      .from("tournament_stages")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("ordering");

    if (stagesError) {
      throw new Error(`Failed to fetch stages: ${stagesError.message}`);
    }

    const stageIds = (stages || []).map((s: any) => s.id);

    // Fetch groups
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from("tournament_groups")
      .select("*")
      .in("stage_id", stageIds.length > 0 ? stageIds : [-1])
      .order("stage_id")
      .order("ordering");

    if (groupsError) {
      throw new Error(`Failed to fetch groups: ${groupsError.message}`);
    }

    // Fetch tournament teams
    const { data: tournamentTeams, error: teamsError } = await supabaseAdmin
      .from("tournament_teams")
      .select("*, team:teams(*)")
      .eq("tournament_id", tournamentId);

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }

    // Fetch all teams for reference
    const { data: allTeams } = await supabaseAdmin
      .from("teams")
      .select("id, name, logo")
      .order("name");

    // Fetch matches
    const { data: matches, error: matchesError } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("stage_id")
      .order("group_id", { nullsFirst: true })
      .order("match_date", { nullsFirst: true });

    if (matchesError) {
      throw new Error(`Failed to fetch matches: ${matchesError.message}`);
    }

    // Fetch standings
    const { data: standings, error: standingsError } = await supabaseAdmin
      .from("stage_standings")
      .select("*")
      .in("stage_id", stageIds.length > 0 ? stageIds : [-1])
      .order("stage_id")
      .order("group_id", { nullsFirst: true })
      .order("rank", { nullsFirst: true });

    if (standingsError) {
      throw new Error(`Failed to fetch standings: ${standingsError.message}`);
    }

    // Fetch stage slots
    const { data: stageSlots, error: stageSlotsError } = await supabaseAdmin
      .from("stage_slots")
      .select("*")
      .in("stage_id", stageIds.length > 0 ? stageIds : [-1])
      .order("stage_id")
      .order("group_id")
      .order("slot_id");

    if (stageSlotsError) {
      throw new Error(`Failed to fetch stage slots: ${stageSlotsError.message}`);
    }

    const debugData = {
      tournament,
      stages: stages || [],
      groups: groups || [],
      tournamentTeams: tournamentTeams || [],
      allTeams: allTeams || [],
      matches: matches || [],
      standings: standings || [],
      stageSlots: stageSlots || [],
    };

    return <TournamentDebugClient data={debugData} />;
  } catch (error) {
    console.error("Error loading tournament debug data:", error);
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-400 mb-2">Error Loading Debug Data</h1>
            <p className="text-red-300">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }
}
