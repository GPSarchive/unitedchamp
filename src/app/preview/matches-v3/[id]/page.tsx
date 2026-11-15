// Preview route — match page v3: the match page rebuilt around the player
// cards of the players page (/preview/paiktes-v3), in two versions: before
// the match is played and after. Public content only; the admin tools of the
// live page (/matches/[id]) are not part of this preview.
//
// A played match can also be opened as it looked before kick-off with
// ?view=before — a preview aid, to compare the two versions on one match.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseId } from "@/app/matches/[id]/utils";
import { loadMatchView } from "./data";
import MatchPage from "./MatchPage";

export const metadata: Metadata = {
  title: "Αγώνας · UltraChamp.gr",
  robots: { index: false, follow: false },
};

export default async function MatchesV3Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id: rawId } = await params;
  const { view: wanted } = await searchParams;
  const id = parseId(rawId) as number | null;
  if (!id) notFound();

  const view = await loadMatchView(id, wanted === "before");
  if (!view) notFound();

  return (
    <MatchPage
      view={view}
      basePath={`/preview/matches-v3/${view.id}`}
      canSwitch={view.status === "finished"}
    />
  );
}
