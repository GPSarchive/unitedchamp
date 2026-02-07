//app/dashboard/tournaments/TournamentCURD/stages/groups/GroupsBoard.tsx
"use client";

import { useState } from "react";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

type AvailableTeam = { id: number; name: string; logo?: string | null };

export default function GroupsBoard({
  groupsArr,
  groupsOccupancy,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onSetGroupCount,
  intakeMode = false,
  availableTeams = [],
  onAssignTeam,
  onUnassignTeam,
}: {
  groupsArr: Array<{ name: string }>;
  groupsOccupancy: Record<number, TeamDraft[]>;
  onAddGroup: () => void;
  onRemoveGroup: (gi: number) => void;
  onRenameGroup: (gi: number, name: string) => void;
  onSetGroupCount: (n: number) => void;
  intakeMode?: boolean;
  availableTeams?: AvailableTeam[];
  onAssignTeam?: (teamId: number, groupIdx: number) => void;
  onUnassignTeam?: (teamId: number) => void;
}) {
  // Track which group's "add team" dropdown is open
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filteredAvailable = availableTeams.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

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
                  <li key={t.id} className="flex items-center justify-between gap-1">
                    <span className="text-white/90 truncate">
                      {(t as any)?.name ?? `Team #${t.id}`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.seed != null ? (
                        <span className="text-white/50 text-xs">S{t.seed}</span>
                      ) : null}
                      {onUnassignTeam && (
                        <button
                          type="button"
                          onClick={() => onUnassignTeam(t.id)}
                          className="px-1 py-0.5 text-xs rounded border border-rose-400/30 text-rose-300/80 hover:text-rose-200 hover:bg-rose-500/10"
                          title="Αφαίρεση από όμιλο"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-white/50 italic">— καμία ομάδα —</li>
              )}
            </ul>

            {/* Add team to this group */}
            {!intakeMode && onAssignTeam && (
              <div className="mt-2 relative">
                {openDropdown === gi ? (
                  <div className="space-y-1">
                    <input
                      autoFocus
                      className="w-full bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                      placeholder="Αναζήτηση ομάδας…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onBlur={() => {
                        // Delay close so click on option can register
                        setTimeout(() => {
                          setOpenDropdown(null);
                          setSearch("");
                        }, 200);
                      }}
                    />
                    {filteredAvailable.length > 0 ? (
                      <ul className="max-h-36 overflow-auto rounded-md border border-white/10 bg-slate-950 divide-y divide-white/5">
                        {filteredAvailable.map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-xs text-white/80 hover:bg-cyan-500/10 hover:text-white"
                              onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                onAssignTeam(t.id, gi);
                                setOpenDropdown(null);
                                setSearch("");
                              }}
                            >
                              {t.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-white/40 px-2 py-1">
                        Δεν υπάρχουν διαθέσιμες ομάδες
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenDropdown(gi);
                      setSearch("");
                    }}
                    className="w-full text-left px-2 py-1 text-xs rounded-md border border-dashed border-white/15 text-white/50 hover:text-white/80 hover:border-white/30"
                  >
                    + Προσθήκη ομάδας
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
