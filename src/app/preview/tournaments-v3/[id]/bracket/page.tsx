// The tournament's «Νοκ άουτ» tab: the knockout tree.
import { notFound } from "next/navigation";
import BracketView from "../BracketView";
import { loadBase } from "../data";
import { parseId } from "../ui";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  return <BracketView base={base} />;
}
