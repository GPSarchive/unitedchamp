// app/tournaments/[id]/v2/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { loadTournamentIntoStore } from "@/app/tournaments/loadTournamentIntoStore";
import { signSingleTournamentLogo } from "@/app/tournaments/signTournamentLogos";
import TournamentClientV2 from "./TournamentClientV2";
import { notFound } from "next/navigation";

export default async function TournamentV2Page(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isFinite(tournamentId) || tournamentId <= 0) {
    notFound();
  }

  try {
    const data = await loadTournamentIntoStore(tournamentId, supabaseAdmin);
    const signedLogo = await signSingleTournamentLogo(data.tournament.logo);
    const tournament = { ...data.tournament, logo: signedLogo };
    return <TournamentClientV2 initialData={{ ...data, tournament }} />;
  } catch (error) {
    console.error("Error loading tournament data:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3EFE6] text-[#0F0E0D] p-8 font-mono text-sm">
        Σφάλμα φόρτωσης δεδομένων τουρνουά: {(error as Error).message}
      </div>
    );
  }
}
