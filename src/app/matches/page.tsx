// app/matches/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveScope, NO_SEASON } from "@/app/lib/seasonScope";
import MatchesExplorer, {
  type TournamentOption,
} from "./MatchesExplorer";

export const revalidate = 60;

export const metadata = {
  title: "Αγώνες | Ultra Champ",
  description: "Φιλτράρισμα αγώνων ανά τουρνουά, προσεχείς και τελειωμένοι.",
};

export default async function MatchesPage() {
  // The explorer is scoped to the ACTIVE season: its dropdown lists that
  // season's tournaments and the "all" view is their union. Older seasons'
  // matches are reachable through the archived tournament pages (/seasons).
  const { season, tournamentIds } = await getActiveScope();

  const { data } = await supabaseAdmin
    .from("tournaments")
    .select("id, name")
    .eq("season", season?.label ?? NO_SEASON)
    .order("id", { ascending: false });

  const tournaments: TournamentOption[] = (data ?? [])
    .filter((t): t is { id: number; name: string } => !!t && !!t.name)
    .map((t) => ({ id: t.id, name: t.name }));

  return <MatchesExplorer tournaments={tournaments} tournamentIds={tournamentIds} />;
}
