// app/preview/geniki-katataxi/page.tsx
// PREVIEW: the Γενική Κατάταξη recomputed with the date-derived season model —
// seasons run Sept 30 → Sept 29 and each tournament is bucketed by its start_date
// (seasonFromDate → "YYYY/YY"). Nothing is written to the DB; this is a read-only
// preview of what the standings WOULD look like before we solidify the switch.
// The live route (/geniki-katataxi) is untouched and still uses the typed season field.
import type { Metadata } from "next";
import Link from "next/link";
import StandingsView from "@/app/geniki-katataxi/StandingsView";
import { SEASON_START_DAY, SEASON_START_MONTH } from "@/app/geniki-katataxi/rules";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Γενική Κατάταξη · Προεπισκόπηση (σεζόν από ημερομηνία)",
  robots: { index: false, follow: false },
};

const MONTHS_EL = [
  "Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιουν",
  "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ",
];

function PreviewBanner() {
  const cutoff = `${SEASON_START_DAY} ${MONTHS_EL[SEASON_START_MONTH - 1]}`;
  return (
    <div className="mb-8 border-2 border-[#fb923c]/50 bg-[#fb923c]/10 px-5 py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            Προεπισκόπηση · Δεν αποθηκεύεται
          </span>
          <p className="mt-1 text-sm text-[#F3EFE6]/85">
            Οι σεζόν εδώ υπολογίζονται <b>από την ημερομηνία</b>: κάθε σεζόν ξεκινά{" "}
            <b>{cutoff}</b> και τα τουρνουά κατατάσσονται με βάση την ημερομηνία έναρξής
            τους (μορφή «2024/25»). Σύγκρινε με την ενεργή κατάταξη πριν την οριστικοποίηση.
          </p>
        </div>
        <Link
          href="/geniki-katataxi"
          className="shrink-0 self-start border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] hover:bg-[#F3EFE6] hover:text-[#0a0a14] transition-colors"
        >
          Ενεργή κατάταξη →
        </Link>
      </div>
    </div>
  );
}

export default async function PreviewGenikiKataxiPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const requested = Array.isArray(sp.season) ? sp.season[0] : sp.season;

  return (
    <StandingsView
      seasonMode="date"
      basePath="/preview/geniki-katataxi"
      requestedSeason={requested}
      banner={<PreviewBanner />}
    />
  );
}
