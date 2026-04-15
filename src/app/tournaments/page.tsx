// app/tournaments/page.tsx - Using Reusable Utility
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import TournamentsClients from "./TournamentsClient";
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { signTournamentLogos } from "./signTournamentLogos"; // ✅ Import utility

export default async function TournamentsPage() {
  try {
    // 1) Fetch all tournaments
    const { data: tournamentsData, error: tournamentsError } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, slug, format, season, logo, status, winner_team_id, winner_team:teams!winner_team_id(name)')
      .order('id', { ascending: true });

    if (tournamentsError || !tournamentsData) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsError?.message || 'No data'}`);
    }

    // 2) Map winner team name from join
    const mapped = tournamentsData.map((t: any) => ({
      ...t,
      winner_team_name: t.winner_team?.name ?? null,
      winner_team: undefined,
    })) as Tournament[];

    // 3) Sign tournament logos
    const tournaments = await signTournamentLogos(mapped);

    // 4) Pass to client component with signed URLs
    return <TournamentsClients initialTournaments={tournaments} />;
  } catch (error) {
    console.error("Error loading tournaments:", error);
    return <div>Error loading tournaments: {(error as Error).message}</div>;
  }
}