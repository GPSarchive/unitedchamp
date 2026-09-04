export const revalidate = 60;

// Required for ISR on a dynamic segment: without generateStaticParams the App
// Router renders every request dynamically even when `revalidate` is set.
// Empty array = no build-time prerender; each id is generated on first
// request and then cached for the revalidate window.
export function generateStaticParams() {
  return [];
}

import { redirect } from "next/navigation";
import { getSeasonStatusCached } from "@/app/lib/seasonScope";
import { loadTeamPageData } from "./loadTeamPage";
import TeamClient from "./TeamClient";

type TeamPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { id } = await params;
  const teamId = Number.parseInt(id, 10);

  if (Number.isNaN(teamId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] font-mono text-sm">
        Μη έγκυρος κωδικός ομάδας
      </div>
    );
  }

  const res = await loadTeamPageData(teamId);

  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] text-[#F3EFE6] p-8 font-mono text-sm">
        Σφάλμα φόρτωσης ομάδας: {res.error}
      </div>
    );
  }

  // A team row belongs to one season. An ARCHIVED season's team lives under
  // /seasons — old links follow the redirect. Decided by the row's own season
  // status, so it holds even while no season is active.
  const seasonLabel = res.data.team.season_label;
  if (seasonLabel && (await getSeasonStatusCached(seasonLabel)) === "archived") {
    redirect(`/seasons/${encodeURIComponent(seasonLabel)}/teams/${teamId}`);
  }

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
    />
  );
}
