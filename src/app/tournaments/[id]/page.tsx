// app/tournaments/[id]/page.tsx
// ISR: must stay well under the 5-min signed-logo TTL (signTournamentLogos.ts)
export const revalidate = 60;

// Required for ISR on a dynamic segment: without generateStaticParams the App
// Router renders every request dynamically even when `revalidate` is set.
// Empty array = no build-time prerender; each id is generated on first
// request and then cached for the revalidate window.
export function generateStaticParams() {
  return [];
}

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { loadTournamentIntoStore } from "@/app/tournaments/loadTournamentIntoStore";
import { signSingleTournamentLogo } from "@/app/tournaments/signTournamentLogos";
import TournamentClientV2Dark from "./v2-dark/TournamentClientV2Dark";
import { notFound } from "next/navigation";

export default async function TournamentPage(
  { params }: { params: Promise<{ id: string }> } // Next 15: params is a Promise
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
    return <TournamentClientV2Dark initialData={{ ...data, tournament }} />;
  } catch (error) {
    console.error("Error loading tournament data:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] p-8 font-mono text-sm">
        Σφάλμα φόρτωσης δεδομένων τουρνουά: {(error as Error).message}
      </div>
    );
  }
}
