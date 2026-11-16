// The tournament's «Αγώνες» tab: the programme and the results, by round.
import { notFound } from "next/navigation";
import { loadBase } from "../data";
import MatchesView from "../MatchesView";
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
  return <MatchesView base={base} />;
}
