// app/seasons/[season]/teams/[id]/page.tsx — an archived season's team page,
// the same renderer as /OMADA/[id] with an archive badge. Guards that the
// team row belongs to [season]; active-season teams redirect to /OMADA/[id].
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

import { notFound, redirect } from "next/navigation";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { loadTeamPageData } from "@/app/OMADA/[id]/loadTeamPage";
import TeamClient from "@/app/OMADA/[id]/TeamClient";

export default async function ArchivedTeamPage({
  params,
}: {
  params: Promise<{ season: string; id: string }>;
}) {
  const { season: raw, id } = await params;
  const label = decodeURIComponent(raw);
  const teamId = Number.parseInt(id, 10);
  if (Number.isNaN(teamId)) notFound();

  const [season, res] = await Promise.all([getSeasonByLabel(label), loadTeamPageData(teamId)]);
  if (!season) notFound();
  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] p-8 font-mono text-sm">
        Σφάλμα φόρτωσης ομάδας: {res.error}
      </div>
    );
  }
  if (res.data.team.season_label !== label) notFound();
  if (season.status === "active") redirect(`/OMADA/${teamId}`);

  const { team, tournaments, wins, playerAssociations, seasonStatsByPlayer, matches, standing } =
    res.data;

  return (
    <TeamClient
      team={team}
      teamId={teamId}
      tournaments={tournaments}
      wins={wins}
      playerAssociations={playerAssociations}
      seasonStatsByPlayer={seasonStatsByPlayer}
      matches={matches}
      standing={standing}
      archiveSeason={season.display_label}
    />
  );
}
