// src/app/dashboard/page.tsx
import Link from "next/link";

const CARDS = [
  { href: "/dashboard/users", title: "Χρήστες", desc: "Διαχείριση λογαριασμών & ρόλων." },
  { href: "/dashboard/teams", title: "Ομάδες", desc: "Λογότυπα, αρχειοθέτηση και παίκτες." },
  { href: "/dashboard/players", title: "Παίκτες", desc: "Βιογραφικά, στατιστικά & φωτογραφίες." },
  { href: "/dashboard/matches", title: "Αγώνες", desc: "Πρόγραμμα, σκορ και κατάσταση." },
  { href: "/dashboard/tournaments", title: "Διοργανώσεις", desc: "Ροές, όμιλοι & νοκ-άουτ." },
  { href: "/dashboard/announcements", title: "Ανακοινώσεις", desc: "Δημοσιεύσεις & προγραμματισμός." },
];

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-950 to-black p-5 md:p-6">
        <h2 className="text-xl md:text-2xl font-semibold">Καλώς ήρθες στην Διαχείριση</h2>
        <p className="text-white/70 mt-1">
          Επίλεξε ενότητα από τις παρακάτω κάρτες ή από το μενού.
        </p>
      </section>

      <section
        aria-label="Συντομεύσεις"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-white/10 bg-zinc-950 p-4 hover:bg-zinc-900 transition shadow-sm hover:shadow-md"
          >
            <div className="text-lg font-semibold text-white group-hover:text-emerald-200">
              {c.title}
            </div>
            <p className="text-sm text-white/60 mt-1">{c.desc}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-emerald-300 text-sm">
              Μετάβαση <span aria-hidden>→</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
