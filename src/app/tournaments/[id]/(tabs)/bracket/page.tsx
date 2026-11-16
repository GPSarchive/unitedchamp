// The knockout tree used to have a tab of its own. It is now drawn on the
// tournament's first tab, in its place among the stages (groups first, then
// the knockout), so this address only leads there.
import { notFound, redirect } from "next/navigation";
import { TOURNAMENT_PATH } from "../paths";
import { parseId } from "../ui";

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  redirect(`${TOURNAMENT_PATH}/${id}`);
}
