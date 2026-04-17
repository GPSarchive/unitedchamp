import type { Metadata } from "next";
import Image from "next/image";
import VantaBg from "@/app/lib/VantaBg";
import OpenConsentSettingsButton from "./OpenConsentSettingsButton";

export const metadata: Metadata = {
  title: "Cookies | UltraChamp.gr",
  description:
    "Πληροφορίες σχετικά με τα cookies που χρησιμοποιούμε στην πλατφόρμα UltraChamp.gr και πώς μπορείτε να τα διαχειριστείτε.",
};

type CookieRow = {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  category: "Απαραίτητο" | "Αναλυτικό";
};

const COOKIES: CookieRow[] = [
  {
    name: "sb-<project>-auth-token",
    provider: "Supabase",
    purpose: "Διατηρεί τη συνεδρία σύνδεσης του χρήστη.",
    duration: "1 έτος",
    category: "Απαραίτητο",
  },
  {
    name: "sb-<project>-auth-token-code-verifier",
    provider: "Supabase",
    purpose: "Χρησιμοποιείται κατά τη ροή πιστοποίησης PKCE.",
    duration: "Συνεδρία",
    category: "Απαραίτητο",
  },
  {
    name: "pending-email",
    provider: "UltraChamp",
    purpose: "Ροή επιβεβαίωσης email κατά την εγγραφή.",
    duration: "Συνεδρία",
    category: "Απαραίτητο",
  },
  {
    name: "uc_consent",
    provider: "UltraChamp",
    purpose: "Αποθήκευση της επιλογής σας σχετικά με τα cookies.",
    duration: "180 ημέρες",
    category: "Απαραίτητο",
  },
  {
    name: "_vercel_* / Vercel Analytics",
    provider: "Vercel",
    purpose: "Ανώνυμα αναλυτικά δεδομένα επισκεψιμότητας.",
    duration: "Συνεδρία",
    category: "Αναλυτικό",
  },
  {
    name: "VISITOR_INFO1_LIVE, YSC, PREF, CONSENT",
    provider: "YouTube / Google",
    purpose:
      "Ορίζονται κατά την αναπαραγωγή ενσωματωμένων βίντεο YouTube (μόνο μετά από τη συγκατάθεσή σας).",
    duration: "Έως 2 έτη",
    category: "Αναλυτικό",
  },
];

export default function CookiesPage() {
  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      <div className="relative z-10">
        {/* ── Hero header ── */}
        <div className="flex flex-col items-center pt-8 pb-12 px-4">
          <div className="relative w-24 h-24 mb-4">
            <Image
              src="/UltraChampLogo.png"
              alt="UltraChamp Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-white tracking-tight">
            Πολιτική Cookies
          </h1>
          <p className="mt-3 text-white/60 text-center max-w-lg text-sm sm:text-base">
            Ποια cookies χρησιμοποιούμε, για ποιο λόγο και πώς τα διαχειρίζεστε.
          </p>
          <p className="mt-2 text-white/40 text-center text-xs">
            Τελευταία ενημέρωση: Απρίλιος 2026
          </p>
        </div>

        {/* ── Content ── */}
        <div className="container mx-auto px-4 pb-16 max-w-4xl">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-10 shadow-2xl">
            <div className="space-y-10">

              {/* 1. Τι είναι τα cookies */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  1. Τι είναι τα cookies
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Τα cookies είναι μικρά αρχεία κειμένου που αποθηκεύονται στη
                  συσκευή σας όταν επισκέπτεστε έναν ιστότοπο. Χρησιμοποιούνται
                  για τη λειτουργία των υπηρεσιών, την ασφάλεια της συνεδρίας
                  σας και, με τη συγκατάθεσή σας, για αναλυτικά δεδομένα και
                  ενσωματώσεις τρίτων.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 2. Κατηγορίες */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  2. Κατηγορίες που Χρησιμοποιούμε
                </h2>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li>
                    <strong className="text-white">Απαραίτητα:</strong>{" "}
                    Απαιτούνται για τη σύνδεση, την ασφάλεια και την αποθήκευση
                    των επιλογών σας. Δεν μπορούν να απενεργοποιηθούν.
                  </li>
                  <li>
                    <strong className="text-white">Αναλυτικά &amp; ενσωματώσεις:</strong>{" "}
                    Ανώνυμα δεδομένα χρήσης (Vercel Analytics, Speed Insights)
                    και ενσωματώσεις YouTube. Ενεργοποιούνται μόνο μετά από τη
                    ρητή συγκατάθεσή σας.
                  </li>
                </ul>
              </div>

              <hr className="border-white/10" />

              {/* 3. Πίνακας cookies */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  3. Αναλυτικός Πίνακας Cookies
                </h2>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-white/80 uppercase tracking-wider text-xs">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Όνομα</th>
                        <th className="px-3 py-2 font-semibold">Πάροχος</th>
                        <th className="px-3 py-2 font-semibold">Σκοπός</th>
                        <th className="px-3 py-2 font-semibold">Διάρκεια</th>
                        <th className="px-3 py-2 font-semibold">Κατηγορία</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/85">
                      {COOKIES.map((c) => (
                        <tr key={c.name}>
                          <td className="px-3 py-2 font-mono text-xs">
                            {c.name}
                          </td>
                          <td className="px-3 py-2">{c.provider}</td>
                          <td className="px-3 py-2">{c.purpose}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {c.duration}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={
                                c.category === "Απαραίτητο"
                                  ? "inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70"
                                  : "inline-flex rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5 text-[11px]"
                              }
                            >
                              {c.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <hr className="border-white/10" />

              {/* 4. Διαχείριση */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  4. Διαχείριση Συγκατάθεσης
                </h2>
                <p className="text-white/90 leading-relaxed mb-3">
                  Μπορείτε να αλλάξετε τις επιλογές σας οποτεδήποτε ανοίγοντας
                  ξανά τον πίνακα ρυθμίσεων cookies:
                </p>
                <OpenConsentSettingsButton />
              </div>

              <hr className="border-white/10" />

              {/* 5. Ρυθμίσεις browser */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  5. Ρυθμίσεις Προγράμματος Περιήγησης
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Μπορείτε επιπλέον να αποκλείσετε ή να διαγράψετε cookies
                  απευθείας από τις ρυθμίσεις του browser σας (Chrome, Firefox,
                  Safari, Edge κ.λπ.). Σημειώστε ότι αν απενεργοποιήσετε τα
                  απαραίτητα cookies, ορισμένες λειτουργίες (π.χ. σύνδεση στον
                  λογαριασμό σας) ενδέχεται να μην λειτουργούν σωστά.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 6. Επικοινωνία */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  6. Επικοινωνία
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Για απορίες σχετικά με τη χρήση cookies επικοινωνήστε μαζί μας
                  στο{" "}
                  <a
                    href="mailto:info@ultrachamp.gr"
                    className="text-orange-400 hover:underline"
                  >
                    info@ultrachamp.gr
                  </a>
                  .
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
