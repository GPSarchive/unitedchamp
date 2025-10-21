// app/tournaments/[id]/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { loadTournamentIntoStore } from "@/app/tournaments/loadTournamentIntoStore";
import TournamentClient from "../TournamentClient";
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
    return <TournamentClient initialData={data} />;
  } catch (error) {
    console.error("Error loading tournament data:", error);
    return <div>Error loading tournament data: {(error as Error).message}</div>;
  }
}
