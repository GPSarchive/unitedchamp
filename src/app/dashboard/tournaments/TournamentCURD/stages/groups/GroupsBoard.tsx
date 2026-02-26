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
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAddGroup}
          className="px-3 py-1.5 rounded-lg border border-violet-400/25 bg-violet-500/10 text-violet-200 text-sm hover:bg-violet-500/20 transition"
        >
          + Add Group
        </button>
        <label className="flex items-center gap-2 text-sm text-white/50">
          Total:
          <input
            type="number"
            min={1}
            className="w-16 bg-white/[0.05] border border-white/[0.1] rounded-lg px-2 py-1.5 text-white text-center focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition"
            value={groupsArr.length || 1}
            onChange={(e) => onSetGroupCount(Number(e.target.value) || 1)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {groupsArr.map((g, gi) => (
          <div
            key={`${g.name}-${gi}`}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
          >
            {/* Group header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <input
                className="bg-transparent border-none outline-none text-white/90 font-medium text-sm focus:ring-0 min-w-0 flex-1"
                value={g.name}
                onChange={(e) => onRenameGroup(gi, e.target.value)}
              />
              <div className="flex items-center gap-2 ml-2">
                <span className="text-[11px] text-white/30">{groupsOccupancy[gi]?.length ?? 0} teams</span>
                <button
                  type="button"
                  onClick={() => onRemoveGroup(gi)}
                  className="px-1.5 py-0.5 text-[11px] rounded-md border border-rose-400/20 text-rose-300/70 hover:text-rose-200 hover:bg-rose-500/10 transition"
                  title="Delete group"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Team list */}
            <div className="p-3">
              <ul className="text-sm space-y-1.5">
                {intakeMode ? (
                  <li className="text-white/30 italic text-xs py-2 text-center">
                    Dynamically filled from Knockout
                  </li>
                ) : groupsOccupancy[gi]?.length ? (
                  groupsOccupancy[gi].map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-1.5 py-1 px-2 rounded-lg hover:bg-white/[0.03]">
                      <span className="text-white/80 truncate text-sm">
                        {(t as any)?.name ?? `Team #${t.id}`}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.seed != null ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/15 text-violet-300 font-medium">S{t.seed}</span>
                        ) : null}
                        {onUnassignTeam && (
                          <button
                            type="button"
                            onClick={() => onUnassignTeam(t.id)}
                            className="w-5 h-5 flex items-center justify-center rounded text-[11px] border border-rose-400/20 text-rose-300/60 hover:text-rose-200 hover:bg-rose-500/10 transition"
                            title="Remove from group"
                          >
                            x
                          </button>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="text-white/20 italic text-xs py-3 text-center">No teams assigned</li>
                )}
              </ul>

              {/* Add team dropdown */}
              {!intakeMode && onAssignTeam && (
                <div className="mt-2 relative">
                  {openDropdown === gi ? (
                    <div className="space-y-1">
                      <input
                        autoFocus
                        className="w-full bg-white/[0.05] border border-violet-400/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition"
                        placeholder="Search team..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onBlur={() => {
                          setTimeout(() => {
                            setOpenDropdown(null);
                            setSearch("");
                          }, 200);
                        }}
                      />
                      {filteredAvailable.length > 0 ? (
                        <ul className="max-h-36 overflow-auto rounded-lg border border-white/[0.08] bg-slate-950 divide-y divide-white/[0.04]">
                          {filteredAvailable.map((t) => (
                            <li key={t.id}>
                              <button
                                type="button"
                                className="w-full text-left px-2.5 py-1.5 text-xs text-white/70 hover:bg-violet-500/10 hover:text-white transition"
                                onMouseDown={(e) => {
                                  e.preventDefault();
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
                        <div className="text-xs text-white/30 px-2 py-1">
                          No available teams
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
                      className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg border-2 border-dashed border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15] transition"
                    >
                      + Add team
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
