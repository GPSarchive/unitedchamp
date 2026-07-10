"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import ConfirmDialog from "@/app/dashboard/tournaments/TournamentCURD/stages/ConfirmDialog";

import Button from "../../ui/Button";
import MatchCard from "./MatchCard";
import { rowSignature } from "./helpers";
import type { useStageFixtures } from "./useStageFixtures";

type Fixtures = ReturnType<typeof useStageFixtures>;

/** Greek round label relative to the deepest round ("Τελικός" is the last). */
export function makeRoundLabel(maxRound: number) {
  return (round: number) => {
    const fromEnd = maxRound - round;
    if (maxRound >= 1 && fromEnd === 0) return "Τελικός";
    if (fromEnd === 1) return "Ημιτελικοί";
    if (fromEnd === 2) return "Προημιτελικοί";
    return `Γύρος ${round}`;
  };
}

export function koSourceLabel(
  m: DraftMatch,
  side: "home" | "away",
  roundLabel: (r: number) => string
): string | null {
  const r = side === "home" ? m.home_source_round : m.away_source_round;
  const p = side === "home" ? m.home_source_bracket_pos : m.away_source_bracket_pos;
  if (r == null || p == null) return null;
  const outcome = (side === "home" ? m.home_source_outcome : m.away_source_outcome) ?? "W";
  return `${outcome === "W" ? "Νικητής" : "Ηττημένος"} · ${roundLabel(r)} #${p}`;
}

/** Vertical round-by-round KO list; tapping a match opens KoMatchSheet. */
export default function KnockoutRounds({
  fx,
  onOpenMatch,
}: {
  fx: Fixtures;
  onOpenMatch: (m: DraftMatch) => void;
}) {
  const [confirmRegen, setConfirmRegen] = useState(false);
  // Round the admin is adding a match into; opens the single/two-legs chooser.
  const [pendingKoRound, setPendingKoRound] = useState<number | null>(null);
  const { koRounds, nameOf, addKoRowInRound, regenerateStage } = fx;

  const maxRound = koRounds.length ? Math.max(...koRounds.map((r) => r.round)) : 0;
  const roundLabel = makeRoundLabel(Math.max(maxRound, 1));

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setConfirmRegen(true)}>
          <RefreshCw size={15} />
          <span className="hidden sm:inline">Αναδημιουργία</span>
        </Button>
        <Button variant="primary" className="ml-auto" onClick={() => setPendingKoRound(1)}>
          <Plus size={15} />
          Αγώνας (Γύρος 1)
        </Button>
      </div>

      {koRounds.length === 0 ? (
        <p className="rounded-xl border border-white/8 bg-[#0d0f14] p-6 text-center text-sm text-zinc-500">
          Δεν υπάρχουν αγώνες knockout — δοκίμασε «Αναδημιουργία» ή πρόσθεσε αγώνα.
        </p>
      ) : (
        koRounds.map(({ round, rows }) => (
          <section key={round}>
            <div className="sticky top-14 z-10 -mx-1 mb-2 flex items-center justify-between bg-black/90 px-1 py-1.5 backdrop-blur">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                {roundLabel(round)}
                <span className="ml-2 font-normal normal-case text-zinc-600">
                  {rows.length} αγώνες
                </span>
              </h3>
              <button
                onClick={() => setPendingKoRound(round)}
                className="rounded-md px-2 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/10"
              >
                + Προσθήκη
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((m, i) => (
                <MatchCard
                  key={`${rowSignature(m)}|${i}`}
                  match={m}
                  nameOf={nameOf}
                  onOpen={() => onOpenMatch(m)}
                  homeSourceLabel={koSourceLabel(m, "home", roundLabel)}
                  awaySourceLabel={koSourceLabel(m, "away", roundLabel)}
                  subtitle={`Θέση ${m.bracket_pos ?? "—"}${
                    (m as any).leg != null ? ` · ${(m as any).leg}ος αγώνας` : ""
                  }`}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Next-round affordance: the per-round buttons above only cover rounds
          that already have matches, so without this there is no way to start
          e.g. the semifinals when the generator only produced round 1 — the
          gap that used to make admins add "later rounds" as extra round-1
          matches no progression could ever reach. */}
      {koRounds.length > 0 && (
        <button
          onClick={() => setPendingKoRound(maxRound + 1)}
          className="w-full rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm font-medium text-indigo-300 hover:border-indigo-500/50 hover:bg-indigo-500/5"
        >
          + Νέος γύρος (Γύρος {maxRound + 1})
        </button>
      )}

      {/* Single/two-legs chooser — bottom sheet on mobile, centered on desktop */}
      {pendingKoRound != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Νέος αγώνας knockout"
        >
          <button
            type="button"
            aria-label="Άκυρο"
            className="absolute inset-0 bg-black/60"
            onClick={() => setPendingKoRound(null)}
          />
          <div className="relative w-full rounded-t-2xl border border-white/8 bg-[#0d0f14] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:mb-0 sm:w-80 sm:rounded-2xl sm:p-5">
            <div className="mb-3 text-sm font-semibold text-white">
              Νέος αγώνας — Γύρος {pendingKoRound}
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="min-h-11 w-full rounded-lg border border-zinc-700 px-4 text-left text-sm text-white hover:bg-zinc-800 active:bg-zinc-700"
                onClick={() => {
                  const r = pendingKoRound;
                  setPendingKoRound(null);
                  addKoRowInRound(r, 1);
                }}
              >
                Μονός αγώνας
              </button>
              <button
                className="min-h-11 w-full rounded-lg border border-zinc-700 px-4 text-left text-sm text-white hover:bg-zinc-800 active:bg-zinc-700"
                onClick={() => {
                  const r = pendingKoRound;
                  setPendingKoRound(null);
                  addKoRowInRound(r, 2);
                }}
              >
                Διπλός (2 αγώνες, εντός-εκτός)
              </button>
              <button
                className="mt-1 min-h-11 w-full rounded-lg px-4 text-sm text-zinc-500 hover:bg-white/5"
                onClick={() => setPendingKoRound(null)}
              >
                Άκυρο
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRegen && (
        <ConfirmDialog
          open={confirmRegen}
          title="Αναδημιουργία bracket;"
          message="Οι αγώνες knockout του σταδίου θα ξαναδημιουργηθούν. Σκορ και IDs διατηρούνται όπου οι θέσεις ταιριάζουν."
          confirmLabel="Αναδημιουργία"
          cancelLabel="Άκυρο"
          onConfirm={() => {
            setConfirmRegen(false);
            regenerateStage();
          }}
          onCancel={() => setConfirmRegen(false)}
        />
      )}
    </div>
  );
}
