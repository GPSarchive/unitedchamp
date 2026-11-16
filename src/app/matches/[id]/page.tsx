// Match page, built around the player cards of the players page, in two
// versions: before the match is played (squads) and after (score, match
// sheet). See MatchPage.tsx.
//
// Staff (admins and editors) also get the admin surface under the public
// content — postpone / new date, the stats editor with «Save all», the match
// video — exactly as on the previous match page (MatchAdminSlot.tsx).
//
// Rendered on every request, as the previous page was (revalidate = 0): the
// viewer's session decides whether the admin surface is drawn.
export const revalidate = 0;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";
import { canEditContent } from "@/app/lib/supabase/apiAuth";
import { parseId } from "./utils";
import { loadMatchView } from "./data";
import MatchPage from "./MatchPage";
import MatchAdminSlot from "./MatchAdminSlot";

export const metadata: Metadata = {
  title: "Αγώνας · UltraChamp.gr",
};

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const supabase = await createSupabaseRSCClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Editors and admins both get the full match-editing surface.
  const isAdmin = canEditContent(user);

  const { id: rawId } = await params;
  const { saved } = await searchParams;
  const id = parseId(rawId) as number | null;
  if (!id) notFound();

  const view = await loadMatchView(id);
  if (!view) notFound();

  return (
    <MatchPage
      view={view}
      adminSlot={isAdmin ? <MatchAdminSlot matchId={view.id} saved={saved === "1"} /> : null}
    />
  );
}
