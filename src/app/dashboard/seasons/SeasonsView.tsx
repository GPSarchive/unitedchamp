"use client";

// /dashboard/seasons — mobile-first: the active season as a hero card, the
// archive as a list; tapping a card opens an action sheet.

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronRight,
  Lock,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import BottomSheet from "./BottomSheet";
import CloseSeasonSheet from "./CloseSeasonSheet";
import { refreshActiveSeason, resnapshotSeason, setActiveSeason } from "./actions";
import { formatInstant } from "@/app/lib/datetime";

export type SeasonCardData = {
  label: string;
  display_label: string;
  status: "active" | "archived";
  started_on: string | null;
  ended_on: string | null;
  archived_at: string | null;
  counts: {
    tournaments: number;
    teams: number;
    standingsRows: number;
    statsRows: number;
  };
  recapGeneratedAt: string | null;
};

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/70 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-white/45">{k}</div>
      <div className="font-mono text-sm text-white">{v}</div>
    </div>
  );
}

function SeasonCard({ s, onTap }: { s: SeasonCardData; onTap: () => void }) {
  const active = s.status === "active";
  return (
    <button
      onClick={onTap}
      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
        active
          ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
          : "border-white/10 bg-zinc-950 hover:bg-zinc-900"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{s.display_label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"
              }`}
            >
              {active ? "ενεργή" : "αρχείο"}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-white/50">
            {s.label}
            {s.started_on ? ` · από ${s.started_on}` : ""}
            {s.ended_on ? ` έως ${s.ended_on}` : ""}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/40" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat k="Τουρνουά" v={s.counts.tournaments} />
        <Stat k="Ομάδες" v={s.counts.teams} />
        <Stat k="Κατάταξη" v={s.counts.standingsRows} />
        <Stat k="Παίκτες" v={s.counts.statsRows} />
      </div>
      <div className="mt-2 text-[11px] text-white/45">
        Recap: {s.recapGeneratedAt ? formatInstant(s.recapGeneratedAt) : "δεν έχει δημιουργηθεί"}
      </div>
    </button>
  );
}

export default function SeasonsView({ seasons }: { seasons: SeasonCardData[] }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SeasonCardData | null>(null);
  const [closing, setClosing] = useState<SeasonCardData | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const active = seasons.find((s) => s.status === "active") ?? null;
  const archived = seasons.filter((s) => s.status !== "active");

  const closeSheet = useCallback(() => setSheet(null), []);
  const closeClosing = useCallback(() => setClosing(null), []);

  const run = (fn: () => Promise<{ success: boolean; error?: string } & Record<string, unknown>>, okText: (r: any) => string) => {
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.success) setNotice({ ok: false, text: res.error ?? "Σφάλμα" });
      else setNotice({ ok: true, text: okText(res) });
      setSheet(null);
      router.refresh();
    });
  };

  const snapshotText = (r: any) =>
    `Snapshot ${r.snapshot.seasonLabel}: ${r.snapshot.standingsRows} ομάδες, ${r.snapshot.statsRows} παίκτες, recap ${r.snapshot.recapStored ? "✓" : "—"}.`;

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-4 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Σεζόν</h1>
          <p className="text-xs text-white/50">
            Η ενεργή σεζόν τροφοδοτεί όλες τις δημόσιες σελίδες· τα αρχεία αλλάζουν μόνο με επανασύγχρονισμό.
          </p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-zinc-900 text-white/80 hover:bg-zinc-800"
          aria-label="Ανανέωση"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {notice && (
        <p
          className={`mb-4 rounded-lg border p-3 text-sm ${
            notice.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/40 bg-red-500/10 text-red-100"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-white/50">Ενεργή σεζόν</h2>
        {active ? (
          <SeasonCard s={active} onTap={() => setSheet(active)} />
        ) : (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            Δεν υπάρχει ενεργή σεζόν. Διάλεξε μία από το αρχείο και όρισέ την ως ενεργή.
          </div>
        )}
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-white/50">Αρχείο</h2>
        {archived.length === 0 ? (
          <p className="text-sm text-white/45">Καμία αρχειοθετημένη σεζόν ακόμη.</p>
        ) : (
          archived.map((s) => <SeasonCard key={s.label} s={s} onTap={() => setSheet(s)} />)
        )}
      </section>

      {sheet && (
        <BottomSheet title={sheet.display_label} subtitle={sheet.label} onClose={closeSheet}>
          <div className="px-2 py-2">
            <Link
              href={`/dashboard/seasons/${encodeURIComponent(sheet.label)}`}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/5"
            >
              <ChevronRight className="h-4 w-4 text-white/60" />
              <span className="text-sm">Άνοιγμα σεζόν (κατάταξη, τουρνουά, ομάδες, προσαρμογές)</span>
            </Link>

            {sheet.status === "active" ? (
              <>
                <button
                  disabled={pending}
                  onClick={() => run(refreshActiveSeason, snapshotText)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/5 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-white/60" />
                  <span className="text-sm">Ανανέωση αποθηκευμένων πινάκων (στατιστικά, κατάταξη, recap)</span>
                </button>
                <button
                  disabled={pending}
                  onClick={() => {
                    setClosing(sheet);
                    setSheet(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-red-500/5 disabled:opacity-50"
                >
                  <Lock className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-300">Κλείσιμο σεζόν…</span>
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={pending}
                  onClick={() => run(() => resnapshotSeason(sheet.label), snapshotText)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/5 disabled:opacity-50"
                >
                  <Archive className="h-4 w-4 text-white/60" />
                  <span className="text-sm">Επανασύγχρονισμός αρχείου (ξαναγράφει τους αποθηκευμένους πίνακες)</span>
                </button>
                <button
                  disabled={pending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Να γίνει η ${sheet.display_label} η ενεργή σεζόν; Η τωρινή ενεργή θα αρχειοθετηθεί χωρίς snapshot.`,
                      )
                    )
                      return;
                    run(
                      () => setActiveSeason(sheet.label),
                      (r) => `Ενεργή σεζόν: ${sheet.label}${r.previous ? ` (πριν: ${r.previous})` : ""}.`,
                    );
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-emerald-500/5 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">Ορισμός ως ενεργή</span>
                </button>
              </>
            )}
          </div>
          <div className="border-t border-white/10 px-3 pb-3 pt-2">
            <button
              onClick={closeSheet}
              className="w-full rounded-lg border border-white/15 bg-zinc-900 py-2.5 text-sm text-white/80 hover:bg-zinc-800"
            >
              Ακύρωση
            </button>
          </div>
        </BottomSheet>
      )}

      {closing && (
        <CloseSeasonSheet
          label={closing.label}
          display={closing.display_label}
          onClose={closeClosing}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}
