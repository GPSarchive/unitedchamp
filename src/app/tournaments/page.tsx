// app/tournaments/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import TournamentsClient from "./TournamentsClient";
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { signTournamentLogos } from "./signTournamentLogos";

export default async function TournamentsPage() {
  try {
    // 1) Fetch all tournaments with team and match counts
    const { data: tournamentsData, error: tournamentsError } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, slug, format, season, logo, status, winner_team_id')
      .order('id', { ascending: true });

    if (tournamentsError || !tournamentsData) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsError?.message || 'No data'}`);
    }

    // 2) Fetch teams count per tournament
    const { data: teamCounts } = await supabaseAdmin
      .from('tournament_teams')
      .select('tournament_id');

    const teamsCountMap: Record<number, number> = {};
    if (teamCounts) {
      for (const row of teamCounts) {
        teamsCountMap[row.tournament_id] = (teamsCountMap[row.tournament_id] || 0) + 1;
      }
    }

    // 3) Fetch matches count per tournament (via stages)
    const { data: stagesData } = await supabaseAdmin
      .from('tournament_stages')
      .select('id, tournament_id');

    const stageToTournament: Record<number, number> = {};
    if (stagesData) {
      for (const s of stagesData) {
        stageToTournament[s.id] = s.tournament_id;
      }
    }

    const { data: matchesData } = await supabaseAdmin
      .from('matches')
      .select('stage_id');

    const matchesCountMap: Record<number, number> = {};
    if (matchesData) {
      for (const m of matchesData) {
        const tid = stageToTournament[m.stage_id];
        if (tid !== undefined) {
          matchesCountMap[tid] = (matchesCountMap[tid] || 0) + 1;
        }
      }
    }

    // 4) Merge counts into tournament data
    const tournamentsWithCounts = tournamentsData.map((t: any) => ({
      ...t,
      teams_count: String(teamsCountMap[t.id] || 0),
      matches_count: String(matchesCountMap[t.id] || 0),
    }));

    // 5) Sign tournament logos
    const tournaments = await signTournamentLogos(tournamentsWithCounts as Tournament[]);

    // 6) Pass to client component with signed URLs
    return <TournamentsClient initialTournaments={tournaments} />;
  } catch (error) {
    console.error("Error loading tournaments:", error);
    return <div>Error loading tournaments: {(error as Error).message}</div>;
  }
}
