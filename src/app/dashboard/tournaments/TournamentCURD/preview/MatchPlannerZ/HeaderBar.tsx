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
            className="bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-white"
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
            className="bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-white"
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
            className="px-3 py-1.5 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
            onClick={onRegenerateHere}
            disabled={busy}
            title="Επαναδημιουργία αυτού του σταδίου (ή ομίλου) κρατώντας τους κλειδωμένους αγώνες"
          >
            Επαναδημιουργία τρέχοντος
          </button>
        )}

        {isKOFromPrevious && (
          <button
            className="px-3 py-1.5 rounded-md border border-amber-400/40 text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
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
            className="px-3 py-1.5 rounded-md border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10"
            onClick={onAutoAssignRR}
            title="Αυτόματη ανάθεση ομάδων στους αγώνες του ομίλου (round-robin) – τοποθετεί αλλαγές ως εκκρεμείς"
          >
            Auto-assign (RR)
          </button>
        )}

        <button className="px-3 py-1.5 rounded-md border border-white/15 text-white hover:bg-white/10" onClick={onAddRow} disabled={busy}>
          + Προσθήκη Αγώνα
        </button>
      </div>
    </header>
  );
}