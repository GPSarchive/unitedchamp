"use client";

import { useState } from "react";
import { Minus, Plus, Trash2, UserPlus, X } from "lucide-react";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

import Sheet from "../../ui/Sheet";
import Button from "../../ui/Button";

type UiGroup = { id?: number; name: string };
type AvailableTeam = { id: number; name: string; logo?: string | null };

/**
 * Tap-first groups editor replacing GroupsBoard's hover/blur dropdown:
 * group cards with inline rename + explicit assign sheet per group.
 * Same callback contract as GroupsBoard receives from StageCard.
 */
export default function GroupListEditor({
  groupsArr,
  groupsOccupancy,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onSetGroupCount,
  intakeMode,
  availableTeams,
  teamName,
  teamLogo,
  onAssignTeam,
  onUnassignTeam,
}: {
  groupsArr: UiGroup[];
  groupsOccupancy: Record<number, TeamDraft[]>;
  onAddGroup: () => void;
  onRemoveGroup: (gi: number) => void;
  onRenameGroup: (gi: number, name: string) => void;
  onSetGroupCount: (n: number) => void;
  intakeMode: boolean;
  availableTeams: AvailableTeam[];
  teamName: (t: TeamDraft) => string;
  teamLogo: (t: TeamDraft) => string | null;
  onAssignTeam?: (teamId: number, groupIdx: number) => void;
  onUnassignTeam?: (teamId: number) => void;
}) {
  const [assignForGroup, setAssignForGroup] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Όμιλοι ({groupsArr.length})</h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSetGroupCount(Math.max(1, groupsArr.length - 1))}
            disabled={groupsArr.length <= 1}
            aria-label="Λιγότεροι όμιλοι"
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={onAddGroup}
            aria-label="Περισσότεροι όμιλοι"
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {groupsArr.length === 0 ? (
        <p className="rounded-lg border border-white/8 bg-zinc-900/40 p-4 text-center text-sm text-zinc-500">
          Κανένας όμιλος — πρόσθεσε τον πρώτο.
        </p>
      ) : (
        <ul className="space-y-2">
          {groupsArr.map((g, gi) => {
            const occupants = groupsOccupancy[gi] ?? [];
            return (
              <li key={g.id ?? `g-${gi}`} className="rounded-xl border border-white/8 bg-zinc-900/50 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-white hover:border-zinc-700 focus:border-indigo-500/60 focus:bg-zinc-900 focus:outline-none transition-colors"
                    value={g.name}
                    onChange={(e) => onRenameGroup(gi, e.target.value)}
                    aria-label={`Όνομα ομίλου ${gi + 1}`}
                  />
                  <span className="shrink-0 text-xs text-zinc-500">{occupants.length} ομάδες</span>
                  <button
                    onClick={() => onRemoveGroup(gi)}
                    aria-label="Διαγραφή ομίλου"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-500/70 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {!intakeMode && (
                  <>
                    {occupants.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {occupants.map((t) => {
                          const logo = teamLogo(t);
                          return (
                            <li
                              key={t.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-800/80 py-1 pl-1.5 pr-1 text-xs text-zinc-200"
                            >
                              {logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logo} alt="" className="h-5 w-5 rounded-full object-cover" />
                              ) : null}
                              <span className="max-w-32 truncate">{teamName(t)}</span>
                              {onUnassignTeam && (
                                <button
                                  onClick={() => onUnassignTeam(t.id)}
                                  aria-label={`Αφαίρεση ${teamName(t)}`}
                                  className="grid h-5 w-5 place-items-center rounded-full text-zinc-500 hover:bg-zinc-700 hover:text-white transition-colors"
                                >
                                  <X size={11} />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {onAssignTeam && (
                      <button
                        onClick={() => setAssignForGroup(gi)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-3 text-xs font-medium text-zinc-400 hover:border-indigo-500/40 hover:text-indigo-300 transition-colors"
                      >
                        <UserPlus size={13} />
                        Προσθήκη ομάδας
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Assign sheet */}
      <Sheet
        open={assignForGroup != null}
        onClose={() => setAssignForGroup(null)}
        title={
          assignForGroup != null
            ? `Προσθήκη στον όμιλο «${groupsArr[assignForGroup]?.name ?? ""}»`
            : ""
        }
      >
        {availableTeams.length === 0 ? (
          <p className="p-4 text-center text-sm text-zinc-500">
            Δεν υπάρχουν αδιάθετες ομάδες — αφαίρεσε μία από άλλον όμιλο πρώτα.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {availableTeams.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => {
                    if (assignForGroup != null && onAssignTeam) onAssignTeam(t.id, assignForGroup);
                  }}
                  className="flex min-h-13 w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-white/4 transition-colors"
                >
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo} alt="" className="h-8 w-8 rounded-full bg-zinc-800 object-contain ring-1 ring-white/10" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-500">
                      {t.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-white/90">{t.name}</span>
                  <Plus size={15} className="shrink-0 text-indigo-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => setAssignForGroup(null)}>
            Κλείσιμο
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
