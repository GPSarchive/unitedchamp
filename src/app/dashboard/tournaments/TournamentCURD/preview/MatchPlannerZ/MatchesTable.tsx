
// ===============================
// File: app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner/MatchesTable.tsx
// ===============================
"use client";

import MatchRow from "./MatchRow";
import type { EditableDraftMatch, TeamOption } from "./types";

export default function MatchesTable({
  rows,
  isKO,
  isGroups,
  groups,
  stageBadge,
  teamOptions,
  getEff,
  hasPending,
  setPendingFor,
  saveRow,
  swapTeams,
  removeRow,
  teamLabel,
  busy,
}: {
  rows: EditableDraftMatch[];
  isKO: boolean;
  isGroups: boolean;
  groups: Array<{ name: string } & any>;
  stageBadge: (m: any) => string;
  teamOptions: TeamOption[];
  getEff: <K extends keyof EditableDraftMatch>(row: EditableDraftMatch, key: K) => EditableDraftMatch[K];
  hasPending: (localId: number) => boolean;
  setPendingFor: (localId: number, patch: Partial<EditableDraftMatch>) => void;
  saveRow: (localId: number) => void;
  swapTeams: (localId: number) => void;
  removeRow: (localId: number) => void;
  teamLabel: (id?: number | null) => string;
  busy: boolean;
}) {
  if (!rows.length) {
    return <p className="text-zinc-400">Δεν υπάρχουν αγώνες σε αυτή την επιλογή.</p>;
  }

  return (
    <div className="overflow-auto rounded-xl border border-white/8 shadow-inner">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Στάδιο / Όμιλος</th>
            {isKO ? (
              <>
                <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Γύρος</th>
                <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Θέση Δέντρου</th>
              </>
            ) : (
              <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Αγωνιστική</th>
            )}
            <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Ομάδα Α</th>
            <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Ομάδα Β</th>
            <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Σκορ</th>
            <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Κατάσταση</th>
            <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider">Ημ/νία & Ώρα (UTC)</th>
            <th className="px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider">Ενέργειες</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <MatchRow
              key={m._localId}
              m={m}
              isKO={isKO}
              isGroups={isGroups}
              groups={groups}
              stageBadge={stageBadge}
              teamOptions={teamOptions}
              getEff={getEff}
              hasPending={hasPending}
              setPendingFor={setPendingFor}
              saveRow={saveRow}
              swapTeams={swapTeams}
              removeRow={removeRow}
              teamLabel={teamLabel}
              busy={busy}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
