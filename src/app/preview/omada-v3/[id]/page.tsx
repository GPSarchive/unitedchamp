// Preview route — team page v3: the team page rebuilt around the player cards
// of the players page (/preview/paiktes-v3), with the public-safe match
// features of the player area (next match + countdown, form, league table,
// knockout-aware results). The live page (/OMADA/[id]) is untouched.
//
// One route for every team row: a team of a past season is shown here too
// (the live site keeps those under /seasons/[season]/teams/[id]).
//
// Cached like the live team page, and for the same reason an empty
// generateStaticParams: without it a dynamic segment is rendered on every
// request even when `revalidate` is set.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadTeamView } from "./data";
import TeamPage from "./TeamPage";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export const metadata: Metadata = {
  title: "Ομάδα · UltraChamp.gr",
  robots: { index: false, follow: false },
};

export default async function OmadaV3Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) notFound();

  const view = await loadTeamView(id);
  if (!view) notFound();

  return <TeamPage view={view} />;
}
