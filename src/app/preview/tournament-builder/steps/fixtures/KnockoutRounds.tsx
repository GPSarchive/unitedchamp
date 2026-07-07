"use client";

import { useState } from "react";
import { Plus, RefreshCw, GitBranch } from "lucide-react";
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
  onToggleCanvas,
  showCanvasToggle,
}: {
  fx: Fixtures;
  onOpenMatch: (m: DraftMatch) => void;
  onToggleCanvas?: () => void;
  showCanvasToggle?: boolean;
}) {
  const [confirmRegen, setConfirmRegen] = useState(false);
  const { koRounds, nameOf, addKoRowInRound, regenerateStage } = fx;

  const maxRound = koRounds.length ? Math.max(...koRounds.map((r) => r.round)) : 1;
  const roundLabel = makeRoundLabel(maxRound);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setConfirmRegen(true)}>
          <RefreshCw size={15} />
          <span className="hidden sm:inline">Αναδημιουργία</span>
        </Button>
        {showCanvasToggle && (
          <Button variant="ghost" className="hidden lg:inline-flex" onClick={onToggleCanvas}>
            <GitBranch size={15} />
            Προηγμένη προβολή
          </Button>
        )}
        <Button variant="primary" className="ml-auto" onClick={() => addKoRowInRound(1)}>
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
                onClick={() => addKoRowInRound(round)}
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
                  subtitle={`Θέση ${m.bracket_pos ?? "—"}`}
                />
              ))}
            </div>
          </section>
        ))
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
