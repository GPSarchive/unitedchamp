// app/matches/page.tsx - REVAMPED

import MatchesClient from "./MatchesClient";

export const revalidate = 60;

export const metadata = {
  title: "Αγώνες | Ultra Champ",
  description: "Φίλτραρε αγώνες ανά ομάδα, διοργάνωση και ημερομηνία.",
};

export default async function MatchesPage() {
  return <MatchesClient />;
}
