"use client";

// "Κλείσιμο σεζόν": preflight → next-season form → confirm. The action runs
// the final snapshot, then flips the pointer (contract §4). Blockers stop the
// close unless the admin ticks the override.

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Ban, CheckCircle2, Loader2 } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { closeSeason, preflightCloseSeason, type ClosePreflight } from "./actions";
import { displayLabelForSeason } from "@/app/geniki-katataxi/rules";

export default function CloseSeasonSheet({
  label,
  display,
  onClose,
  onDone,
}: {
  label: string;
  display: string;
  onClose: () => void;
  onDone: (nextLabel: string) => void;
}) {
  const [pre, setPre] = useState<ClosePreflight | null>(null);
  const [preError, setPreError] = useState<string | null>(null);
  const [nextLabel, setNextLabel] = useState("");
  const [nextDisplay, setNextDisplay] = useState("");
  const [startedOn, setStartedOn] = useState("");
  const [force, setForce] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    preflightCloseSeason(label).then((res) => {
      if (cancelled) return;
      if (!res.success) {
        setPreError(res.error);
        return;
      }
      setPre(res.preflight);
      setNextLabel(res.preflight.suggestedNext.label);
      setNextDisplay(res.preflight.suggestedNext.display_label);
      setStartedOn(res.preflight.suggestedNext.started_on);
    });
    return () => {
      cancelled = true;
    };
  }, [label]);

  const blocked = (pre?.blockers.length ?? 0) > 0 && !force;
  const labelOk = /^\S+$/.test(nextLabel) && nextLabel !== label;
  const canSubmit = !!pre && !blocked && labelOk && confirmText.trim() === label && !pending;

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const res = await closeSeason({
        currentLabel: label,
        nextLabel: nextLabel.trim(),
        nextDisplayLabel: nextDisplay.trim() || displayLabelForSeason(nextLabel.trim()),
        nextStartedOn: startedOn || null,
        force,
      });
      if (!res.success) {
        setResult({ ok: false, message: res.error });
        return;
      }
      setResult({
        ok: true,
        message: `Η σεζόν ${display} αρχειοθετήθηκε (${res.snapshot.standingsRows} ομάδες, ${res.snapshot.statsRows} παίκτες, recap ${res.snapshot.recapStored ? "✓" : "—"}). Ενεργή σεζόν: ${res.next}.`,
      });
      onDone(res.next);
    });
  };

  return (
    <BottomSheet title="Κλείσιμο σεζόν" subtitle={`${display} · ${label}`} onClose={onClose} wide>
      <div className="space-y-4 px-4 py-4 text-sm text-white">
        {preError && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200">{preError}</p>
        )}
        {!pre && !preError && (
          <p className="flex items-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Έλεγχος σεζόν…
          </p>
        )}

        {pre && (
          <>
            <section className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {[
                ["Τουρνουά", pre.info.tournaments],
                ["Ομάδες", pre.info.teams],
                ["Αγώνες", `${pre.info.finishedMatches}/${pre.info.matches}`],
                ["Στατιστικά παικτών", pre.info.statsRows],
                ["Γραμμές κατάταξης", pre.info.standingsRows],
                ["Recap", pre.info.recapGeneratedAt ? "✓" : "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg border border-white/10 bg-zinc-900 p-2">
                  <div className="text-white/50">{k}</div>
                  <div className="font-mono text-base text-white">{v}</div>
                </div>
              ))}
            </section>

            {pre.blockers.length > 0 && (
              <section className="space-y-1 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                <div className="flex items-center gap-2 font-semibold text-red-200">
                  <Ban className="h-4 w-4" /> Εμπόδια
                </div>
                {pre.blockers.map((b) => (
                  <p key={b} className="text-red-100/90">
                    {b}
                  </p>
                ))}
                <label className="mt-2 flex items-start gap-2 text-red-100">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Παράβλεψη — κλείσε τη σεζόν παρόλα αυτά.</span>
                </label>
              </section>
            )}

            {pre.warnings.length > 0 && (
              <section className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 font-semibold text-amber-200">
                  <AlertTriangle className="h-4 w-4" /> Προσοχή
                </div>
                {pre.warnings.map((w) => (
                  <p key={w} className="text-amber-100/90">
                    {w}
                  </p>
                ))}
              </section>
            )}

            <section className="space-y-3 rounded-lg border border-white/10 bg-zinc-900 p-3">
              <div className="font-semibold">Νέα ενεργή σεζόν</div>
              <label className="block text-xs text-white/60">
                Κλειδί (π.χ. 2026-2027)
                <input
                  value={nextLabel}
                  onChange={(e) => {
                    setNextLabel(e.target.value);
                    setNextDisplay(displayLabelForSeason(e.target.value.trim()));
                  }}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/60">
                Εμφάνιση (π.χ. 2026/27)
                <input
                  value={nextDisplay}
                  onChange={(e) => setNextDisplay(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/60">
                Έναρξη
                <input
                  type="date"
                  value={startedOn}
                  onChange={(e) => setStartedOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </label>
            </section>

            <section className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white/70">
              <p>
                Τι θα γίνει: τελικό snapshot (στατιστικά παικτών, Γενική Κατάταξη, recap) της{" "}
                <b className="text-white">{display}</b>, μετά η {display} γίνεται «αρχείο» και η{" "}
                <b className="text-white">{nextDisplay || nextLabel || "…"}</b> ενεργή. Κανένας αγώνας,
                ομάδα ή στατιστικό δεν διαγράφεται. Οι ζωντανές σελίδες θα δείχνουν την νέα (άδεια) σεζόν
                μέχρι να δημιουργηθούν ομάδες και τουρνουά.
              </p>
              <label className="block text-white/60">
                Γράψε <span className="font-mono text-white">{label}</span> για επιβεβαίωση
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
                />
              </label>
            </section>
          </>
        )}

        {result && (
          <p
            className={`flex items-start gap-2 rounded-lg border p-3 ${
              result.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/40 bg-red-500/10 text-red-100"
            }`}
          >
            {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Ban className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{result.message}</span>
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-white/10 px-3 pb-3 pt-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-white/15 bg-zinc-900 py-2.5 text-sm text-white/80 transition-colors hover:bg-zinc-800"
        >
          {result?.ok ? "Κλείσιμο" : "Ακύρωση"}
        </button>
        {!result?.ok && (
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 rounded-lg border border-red-500/50 bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Κλείσιμο…" : "Κλείσιμο σεζόν"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
