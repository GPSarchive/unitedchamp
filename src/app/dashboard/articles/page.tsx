// src/app/dashboard/articles/page.tsx
import ArticlesAdmin from "./ArticlesAdmin";

export const dynamic = "force-dynamic";

export default function ArticlesPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-50">Άρθρα</h2>
      </header>

      <p className="text-zinc-200/90">
        Δημιούργησε, προγραμμάτισε και διαχειρίσου άρθρα.
        Υποστηρίζονται μορφές Markdown, HTML και απλό κείμενο, καθώς και καρφίτσωμα,
        κατηγορίες, ετικέτες και χρονικά παράθυρα εμφάνισης.
      </p>

      <div className="rounded-2xl border border-white/20 bg-black/50 p-4 shadow-lg backdrop-blur-sm">
        <ArticlesAdmin />
      </div>

      <p className="text-xs text-zinc-400">
        Συμβουλή: Χρησιμοποίησε τα πεδία «Έναρξη» και «Λήξη» για δημοσίευση σε συγκεκριμένο χρονικό διάστημα.
        Τα άρθρα με υψηλότερη προτεραιότητα εμφανίζονται πρώτα.
      </p>
    </div>
  );
}
