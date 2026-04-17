// app/matches/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import MatchesExplorer, {
  type TournamentOption,
} from "./MatchesExplorer";

export const revalidate = 60;

export const metadata = {
  title: "Αγώνες | Ultra Champ",
  description: "Φιλτράρισμα αγώνων ανά τουρνουά, προσεχείς και τελειωμένοι.",
};

export default async function MatchesPage() {
  // Fetch a compact list of tournaments for the filter dropdown
  const { data } = await supabaseAdmin
    .from("tournaments")
    .select("id, name")
    .order("id", { ascending: false });

  const tournaments: TournamentOption[] = (data ?? [])
    .filter((t): t is { id: number; name: string } => !!t && !!t.name)
    .map((t) => ({ id: t.id, name: t.name }));

  return <MatchesExplorer tournaments={tournaments} />;
}
