// src/app/dashboard/players/page.tsx
import AdminPlayersCRUD from "./AdminPlayersCRUD";

export const dynamic = "force-dynamic";

export default function PlayersPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Παίκτες</h2>
      </header>

      <p className="text-white/70">
        Διαχείριση παικτών: δημιουργία, επεξεργασία, στατιστικά και φωτογραφίες.
      </p>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
        <AdminPlayersCRUD />
      </div>

      <p className="text-xs text-white/50">
        Συμβουλή: Χρησιμοποίησε την αναζήτηση για γρήγορο φιλτράρισμα και το συρτάρι επεξεργασίας για άμεσες αλλαγές.
      </p>
    </div>
  );
}
