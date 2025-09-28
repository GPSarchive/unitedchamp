// src/app/dashboard/announcements/page.tsx
import AnnouncementsAdmin from "./AnnouncementsAdmin";

export const dynamic = "force-dynamic";

export default function AnnouncementsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-50">Ανακοινώσεις</h2>
      </header>

      <p className="text-zinc-200/90">
        Δημιούργησε, προγραμμάτισε και διαχειρίσου ανακοινώσεις.
        Υποστηρίζονται μορφές Markdown, HTML και απλό κείμενο, καθώς και καρφίτσωμα,
        προτεραιότητα και χρονικά παράθυρα εμφάνισης.
      </p>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-sm">
        <AnnouncementsAdmin />
      </div>

      <p className="text-xs text-zinc-400">
        Συμβουλή: Χρησιμοποίησε τα πεδία «Έναρξη» και «Λήξη» για δημοσίευση σε συγκεκριμένο χρονικό διάστημα.
      </p>
    </div>
  );
}
