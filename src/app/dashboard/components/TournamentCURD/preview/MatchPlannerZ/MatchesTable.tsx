
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
    return <p className="text-white/70">Δεν υπάρχουν αγώνες σε αυτή την επιλογή.</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border border-white/10">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-900/70 text-white">
          <tr>
            <th className="px-2 py-1 text-left">Στάδιο / Όμιλος</th>
            {isKO ? (
              <>
                <th className="px-2 py-1 text-left">Γύρος</th>
                <th className="px-2 py-1 text-left">Θέση Δέντρου</th>
              </>
            ) : (
              <th className="px-2 py-1 text-left">Αγωνιστική</th>
            )}
            <th className="px-2 py-1 text-left">Ομάδα Α</th>
            <th className="px-2 py-1 text-left">Ομάδα Β</th>
            <th className="px-2 py-1 text-left">Σκορ</th>
            <th className="px-2 py-1 text-left">Κατάσταση</th>
            <th className="px-2 py-1 text-left">Ημ/νία & Ώρα (UTC)</th>
            <th className="px-2 py-1 text-right">Ενέργειες</th>
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
