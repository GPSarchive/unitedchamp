// app/tournaments/[id]/v2-dark/page.tsx
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
import { getSeasonStatusCached } from "@/app/lib/seasonScope";
import { loadTournamentIntoStore } from "@/app/tournaments/loadTournamentIntoStore";
import { signSingleTournamentLogo } from "@/app/tournaments/signTournamentLogos";
import TournamentClientV2Dark from "./TournamentClientV2Dark";
import { notFound, redirect } from "next/navigation";

export default async function TournamentV2DarkPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isFinite(tournamentId) || tournamentId <= 0) {
    notFound();
  }

  let data: Awaited<ReturnType<typeof loadTournamentIntoStore>>;
  try {
    data = await loadTournamentIntoStore(tournamentId, supabaseAdmin);
  } catch (error) {
    console.error("Error loading tournament data:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] p-8 font-mono text-sm">
        Σφάλμα φόρτωσης δεδομένων τουρνουά: {(error as Error).message}
      </div>
    );
  }

  // Same archive guard as /tournaments/[id]: an archived season's tournament
  // lives under /seasons. (redirect() throws, so it stays outside the try.)
  const season = data.tournament.season;
  if (season && (await getSeasonStatusCached(season)) === "archived") {
    redirect(`/seasons/${encodeURIComponent(season)}/tournaments/${tournamentId}`);
  }

  const signedLogo = await signSingleTournamentLogo(data.tournament.logo);
  const tournament = { ...data.tournament, logo: signedLogo };
  return <TournamentClientV2Dark initialData={{ ...data, tournament }} />;
}
