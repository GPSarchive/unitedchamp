// app/tournaments/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import TournamentsClient from "./TournamentsClient";
import type { Tournament } from "@/app/tournaments/useTournamentData";

export default async function TournamentsPage() {
  try {
    // Fetch all tournaments
    const { data: tournamentsData, error: tournamentsError } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, slug, format, season, logo, status, winner_team_id')
      .order('id', { ascending: true });

    if (tournamentsError || !tournamentsData) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsError?.message || 'No data'}`);
    }

    const tournaments: Tournament[] = tournamentsData;

    return <TournamentsClient initialTournaments={tournaments} />;
  } catch (error) {
    console.error("Error loading tournaments:", error);
    return <div>Error loading tournaments: {(error as Error).message}</div>;
  }
}