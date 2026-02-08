"use client";

import StageCard from "./StageCard";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft } from "../TournamentWizard";

// Store (stages/groups now persist via the store)
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

export default function StageList({
  stages,
  onChange,
  teams,
  onTeamGroupChange,
}: {
  stages: NewTournamentPayload["stages"];
  onChange: (stages: NewTournamentPayload["stages"]) => void;
  teams: TeamDraft[];
  onTeamGroupChange?: (teamId: number, stageIdx: number, groupIdx: number | null) => void;
}) {
  // --- Store actions we need for persistence
  const storeUpsertStage = useTournamentStore((s) => s.upsertStage);
  const storeRemoveStage = useTournamentStore((s) => s.removeStage);
  const storeListGroupsForStageIdx = useTournamentStore((s) => s.listGroupsForStageIdx);
  const storeRemoveGroup = useTournamentStore((s) => s.removeGroup);

  const add = () => {
    const nextStage = {
      name: `Stage ${stages.length + 1}`,
      kind: "league", // default to "league"
      ordering: stages.length + 1,
      is_ko: false,  // default to false (not KO)
      config: {
        interval_days: 7,
        rounds_per_opponent: 1,
        double_round: false,
        shuffle: false,
      },
      groups: [],  // keep groups empty by default
    } as any;
  
    // Automatically set is_ko based on kind
    nextStage.is_ko = nextStage.kind === "knockout";
  
    // Persist in store (source of truth)
    storeUpsertStage(stages.length, {
      name: nextStage.name,
      kind: nextStage.kind as any,

      config: nextStage.config,
    });
  
    // Mirror to local wizard payload for UI
    onChange([...stages, nextStage]);
  };
  

  const update = (idx: number, patch: Partial<(typeof stages)[number]>) => {
    // Persist in store first
    const { name, kind, is_ko, config } = patch as any;
  
    // Automatically set is_ko based on kind if not provided
    const updatedIsKo = kind === "knockout" ? true : is_ko ?? false;
  
    if (name != null || kind != null || updatedIsKo != null || config != null) {
      storeUpsertStage(idx, {
        ...(name != null ? { name } : {}),
        ...(kind != null ? { kind: kind as any } : {}),
        ...(updatedIsKo != null ? { is_ko: updatedIsKo } : {}),
        ...(config != null ? { config } : {}),
      });
    }
  
    // If switching away from "groups", remove groups in the STORE as well
    if ((patch as any).kind && (patch as any).kind !== "groups") {
      const existing = storeListGroupsForStageIdx(idx);
      // remove from last to first to keep indices stable
      for (let gi = existing.length - 1; gi >= 0; gi--) {
        storeRemoveGroup(idx, gi);
      }
    }
  
    // Mirror to local wizard payload for UI
    const next = stages.slice();
    next[idx] = { id: (stages as any)[idx]?.id, ...next[idx], ...patch } as any;
  
    // when switching away from groups, clear groups in local payload
    if ((patch as any).kind && (patch as any).kind !== "groups") {
      (next[idx] as any).groups = [];
    }
  
    onChange(next);
  };
  

  const remove = (idx: number) => {
    // Persist in store
    storeRemoveStage(idx);

    // Mirror to local wizard payload
    onChange(stages.filter((_, i) => i !== idx));
  };

  // NOTE: Reordering currently updates only the local payload. To persist order,
  // add a `moveStage(fromIdx, toIdx)` action in the store and call it here.
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;

    const next = stages.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((s: any, i) => (s.ordering = i + 1));
    onChange(next);
  };

  const kindIcons: Record<string, string> = { league: "L", groups: "G", knockout: "K" };

  return (
    <div className="space-y-4">
      {stages.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] p-10 text-center">
          <div className="text-white/20 text-lg mb-2">No stages yet</div>
          <div className="text-white/10 text-sm mb-4">Add your first stage to start building the tournament structure</div>
          <button
            onClick={add}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 transition"
          >
            + Add First Stage
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {stages.map((s, i) => {
                const kind = ((s as any)?.kind ?? "league") as string;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs"
                    title={(s as any)?.name ?? `Stage ${i + 1}`}
                  >
                    <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-300 flex items-center justify-center text-[10px] font-bold">
                      {kindIcons[kind] ?? "?"}
                    </span>
                    <span className="text-white/60 truncate max-w-[100px]">{(s as any)?.name ?? `Stage ${i + 1}`}</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={add}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 transition"
            >
              + Add Stage
            </button>
          </div>

          <div className="space-y-4">
            {stages.map((s, i) => (
              <StageCard
                key={s?.id ?? `tmp-${i}`}
                value={s as any}
                index={i}
                onChange={(patch) => update(i, patch as any)}
                onRemove={() => remove(i)}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, +1)}
                allStages={stages}
                teams={teams}
                onTeamGroupChange={onTeamGroupChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
