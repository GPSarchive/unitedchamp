// app/seasons/[season]/tournaments/[id]/page.tsx — an archived tournament,
// rendered by the same loader + renderer as the live route. Guards that the
// tournament really belongs to [season]; active-season tournaments live at
// /tournaments/[id] and redirect there.
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { loadTournamentIntoStore } from "@/app/tournaments/loadTournamentIntoStore";
import { signSingleTournamentLogo } from "@/app/tournaments/signTournamentLogos";
import TournamentClientV2Dark from "@/app/tournaments/[id]/v2-dark/TournamentClientV2Dark";

export default async function ArchivedTournamentPage({
  params,
}: {
  params: Promise<{ season: string; id: string }>;
}) {
  const { season: raw, id } = await params;
  const label = decodeURIComponent(raw);
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId) || tournamentId <= 0) notFound();

  const season = await getSeasonByLabel(label);
  if (!season) notFound();

  let data: Awaited<ReturnType<typeof loadTournamentIntoStore>>;
  try {
    data = await loadTournamentIntoStore(tournamentId, supabaseAdmin);
  } catch (error) {
    console.error("Error loading archived tournament:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] p-8 font-mono text-sm">
        Σφάλμα φόρτωσης δεδομένων τουρνουά: {(error as Error).message}
      </div>
    );
  }

  // Membership guard: the URL's season must be the tournament's season.
  if (data.tournament.season !== label) notFound();
  if (season.status === "active") redirect(`/tournaments/${tournamentId}`);

  const signedLogo = await signSingleTournamentLogo(data.tournament.logo);
  const tournament = { ...data.tournament, logo: signedLogo };
  const hub = `/seasons/${encodeURIComponent(label)}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#fb923c]/40 bg-[#0a0a14] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]">
        <span>Αρχείο · Σεζόν {season.display_label}</span>
        <Link href={hub} className="text-[#F3EFE6]/70 transition-colors hover:text-[#fb923c]">
          ← Επιστροφή στη σεζόν
        </Link>
      </div>
      <TournamentClientV2Dark initialData={{ ...data, tournament }} />
    </>
  );
}
