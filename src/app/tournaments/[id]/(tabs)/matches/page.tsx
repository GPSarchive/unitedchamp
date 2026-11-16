// The tournament's «Αγώνες» tab: the teams' crests as a filter, the match days
// in a strip, the chosen day's matches, the knockout trees (MatchesTab).
import { notFound } from "next/navigation";
import { loadBase } from "@/app/preview/tournaments-v3/[id]/data";
import MatchesTab from "./MatchesTab";
import { parseId } from "../ui";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  return <MatchesTab base={base} />;
}
