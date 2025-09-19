"use client";

import type { TeamDraft } from "@/app/dashboard/components/TournamentCURD/TournamentWizard.tsx";

export default function GroupsBoard({
  groupsArr,
  groupsOccupancy,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onSetGroupCount,
  intakeMode = false, // NEW
}: {
  groupsArr: Array<{ name: string }>;
  groupsOccupancy: Record<number, TeamDraft[]>;
  onAddGroup: () => void;
  onRemoveGroup: (gi: number) => void;
  onRenameGroup: (gi: number, name: string) => void;
  onSetGroupCount: (n: number) => void;
  intakeMode?: boolean; // NEW
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddGroup}
          className="px-2 py-1 rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
        >
          + Προσθήκη Ομίλου
        </button>
        <label className="text-sm text-white/70">
          Σύνολο ομίλων:
          <input
            type="number"
            min={1}
            className="ml-2 w-20 bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
            value={groupsArr.length || 1}
            onChange={(e) => onSetGroupCount(Number(e.target.value) || 1)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {groupsArr.map((g, gi) => (
          <div
            key={`${g.name}-${gi}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <input
                className="bg-transparent border-b border-white/15 focus:border-white/40 outline-none text-white/90 font-medium"
                value={g.name}
                onChange={(e) => onRenameGroup(gi, e.target.value)}
              />
              <button
                type="button"
                onClick={() => onRemoveGroup(gi)}
                className="px-2 py-1 text-xs rounded-md border border-white/15 text-white/70 hover:text-white hover:border-white/30"
                title="Διαγραφή ομίλου"
              >
                Διαγραφή
              </button>
            </div>

            <ul className="text-sm space-y-1">
              {intakeMode ? (
                <li className="text-white/50 italic">
                  — δυναμική εισαγωγή από Knockout —
                </li>
              ) : groupsOccupancy[gi]?.length ? (
                groupsOccupancy[gi].map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span className="text-white/90">
                      {(t as any)?.name ?? `Team #${t.id}`}
                    </span>
                    {t.seed != null ? (
                      <span className="text-white/50">S{t.seed}</span>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="text-white/50 italic">— καμία ομάδα —</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
