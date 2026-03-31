// ===============================
// File: app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner/HeaderBar.tsx
// ===============================
"use client";

import { kindLabel } from "./utils";

export default function HeaderBar({
  showStagePicker,
  stageIdx,
  setStageIdx,
  isGroups,
  groupIdx,
  setGroupIdx,
  groups,
  isKOFromPrevious,
  hasKOStageDbId,
  hasSrcStageDbId,
  busy,
  onRegenerateHere,
  onReseedKO,
  onAutoAssignRR,
  onAddRow,
  payload,
}: {
  showStagePicker: boolean;
  stageIdx: number;
  setStageIdx: (i: number) => void;
  isGroups: boolean;
  groupIdx: number | null;
  setGroupIdx: (i: number | null) => void;
  groups: any[];
  isKOFromPrevious: boolean;
  hasKOStageDbId: boolean;
  hasSrcStageDbId: boolean;
  busy: boolean;
  onRegenerateHere: () => void;
  onReseedKO: () => void;
  onAutoAssignRR: () => void;
  onAddRow: () => void;
  payload: any;
}) {
  return (
    <header className={["flex gap-3", "flex-col md:flex-row md:items-center md:justify-between"].join(" ")}> 
      <div className="flex items-center gap-2">
        {showStagePicker && (
          <select
            value={stageIdx}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStageIdx(v);
              setGroupIdx(null);
            }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-colors"
          >
            {(payload.stages as any).map((s: any, i: number) => (
              <option key={i} value={i}>
                {s.name} ({kindLabel(s.kind)})
              </option>
            ))}
          </select>
        )}

        {isGroups && (
          <select
            value={groupIdx ?? 0}
            onChange={(e) => setGroupIdx(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-colors"
          >
            {groups.map((g: any, i: number) => (
              <option key={g.name + i} value={i}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isKOFromPrevious && (
          <button
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50 focus:outline-none"
            onClick={onRegenerateHere}
            disabled={busy}
            title="Επαναδημιουργία αυτού του σταδίου (ή ομίλου) κρατώντας τους κλειδωμένους αγώνες"
          >
            Επαναδημιουργία τρέχοντος
          </button>
        )}

        {isKOFromPrevious && (
          <button
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50 focus:outline-none"
            onClick={onReseedKO}
            disabled={busy || !hasKOStageDbId || !hasSrcStageDbId}
            title={
              !hasKOStageDbId
                ? "Αποθηκεύστε πρώτα: το KO στάδιο δεν έχει id στη ΒΔ."
                : !hasSrcStageDbId
                ? "Αποθηκεύστε πρώτα: το στάδιο-πηγή (League/Groups) δεν έχει id στη ΒΔ."
                : "Ανανέωση του KO από τα πραγματικά αποτελέσματα/βαθμολογίες"
            }
          >
            🔄 Επανασπορά από Αποτελέσματα
          </button>
        )}

        {isGroups && (
          <button
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors focus:outline-none"
            onClick={onAutoAssignRR}
            title="Αυτόματη ανάθεση ομάδων στους αγώνες του ομίλου (round-robin) – τοποθετεί αλλαγές ως εκκρεμείς"
          >
            Auto-assign (RR)
          </button>
        )}

        <button className="px-3 py-1.5 rounded-lg text-sm font-medium border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-colors focus:outline-none" onClick={onAddRow} disabled={busy}>
          + Προσθήκη Αγώνα
        </button>
      </div>
    </header>
  );
}