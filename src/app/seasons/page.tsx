// app/seasons/page.tsx — "Αρχείο Σεζόν": every season, newest first. Reads
// the seasons table and the stored recap totals only; nothing is computed.
import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { listSeasons } from "@/app/lib/seasons";
import { ArchiveShell, Crumbs, Kicker, StateBlock, ArchiveFooter, pad2 } from "./archiveUi";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Αρχείο Σεζόν",
  description: "Όλες οι σεζόν του UltraChamp: κατατάξεις, τουρνουά, ομάδες και ρεκόρ.",
};

type Totals = { matches: number; goals: number; teams: number; players: number; tournaments: number };

export default async function SeasonsArchivePage() {
  const [seasons, recapsRes] = await Promise.all([
    listSeasons(),
    supabaseAdmin.from("season_recaps").select("season_label, totals:payload->totals"),
  ]);
  const totalsBy = new Map<string, Totals>(
    (recapsRes.data ?? []).map((r: any) => [r.season_label as string, r.totals as Totals]),
  );

  return (
    <ArchiveShell>
      <header className="relative border-b-2 border-[#F3EFE6]/20">
        <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-6 md:pt-10 md:pb-8">
          <Crumbs items={[{ label: "Αρχείο Σεζόν" }]} />
          <Kicker>Αρχείο</Kicker>
          <h1
            className="mt-2 font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em]"
            style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
          >
            Οι Σεζόν
          </h1>
          <p className="mt-3 max-w-xl text-sm text-[#F3EFE6]/60">
            Κάθε σεζόν με την τελική Γενική Κατάταξη, τα τουρνουά, τις ομάδες και το βιβλίο ρεκόρ της.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-6 py-10 md:py-14">
        {seasons.length === 0 ? (
          <StateBlock kicker="Αρχείο" title="Καμία σεζόν ακόμη" body="Το αρχείο γεμίζει μόλις κλείσει η πρώτη σεζόν." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {seasons.map((s, i) => {
              const t = totalsBy.get(s.label);
              const active = s.status === "active";
              return (
                <li key={s.label}>
                  <Link
                    href={`/seasons/${encodeURIComponent(s.label)}`}
                    className="group block border-2 border-[#F3EFE6]/20 bg-[#13131d]/60 p-5 transition-colors hover:border-[#fb923c]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                          / {pad2(i + 1)} · {active ? "Τρέχουσα" : "Αρχείο"}
                        </div>
                        <div className="mt-2 font-[var(--f-display)] text-4xl font-black italic leading-none text-[#F3EFE6]">
                          {s.display_label}
                        </div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/45">
                          {s.label}
                          {s.started_on ? ` · ${s.started_on}` : ""}
                          {s.ended_on ? ` → ${s.ended_on}` : ""}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/50 transition-colors group-hover:text-[#fb923c]">
                        Άνοιγμα →
                      </span>
                    </div>
                    {t && (
                      <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#F3EFE6]/55">
                        <div>
                          <div className="text-lg text-[#F3EFE6]">{t.tournaments}</div>Τουρνουά
                        </div>
                        <div>
                          <div className="text-lg text-[#F3EFE6]">{t.teams}</div>Ομάδες
                        </div>
                        <div>
                          <div className="text-lg text-[#F3EFE6]">{t.matches}</div>Αγώνες
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ArchiveFooter label={`Αρχείο Σεζόν · ${pad2(seasons.length)} σεζόν`} />
    </ArchiveShell>
  );
}
