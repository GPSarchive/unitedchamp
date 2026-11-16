// Team page, built around the player cards of the players page (/paiktes),
// with the public-safe match features of the player area (next match +
// countdown, form, league table, knockout-aware results).
//
// One route for every team row: a team of a past season is shown here too
// (the season archive also keeps those under /seasons/[season]/teams/[id]).
//
// ISR, and for that an empty generateStaticParams: without it a dynamic
// segment is rendered on every request even when `revalidate` is set.
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
};

export default async function OmadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) notFound();

  const view = await loadTeamView(id);
  if (!view) notFound();

  return <TeamPage view={view} />;
}
