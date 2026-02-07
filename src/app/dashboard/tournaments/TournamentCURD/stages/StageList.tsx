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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-cyan-200">Stages</h2>
        <button
          onClick={add}
          className="text-sm px-3 py-1 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          + Add Stage
        </button>
      </div>

      <div className="space-y-3">
        {stages.map((s, i) => (
          <StageCard
            key={s?.id ?? `tmp-${i}`}
            value={s as any}
            index={i}
            onChange={(patch) => update(i, patch as any)}
            onRemove={() => remove(i)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, +1)}
            // Context for visuals + inline planner
            allStages={stages}
            teams={teams}
            onTeamGroupChange={onTeamGroupChange}
          />
        ))}
      </div>
    </div>
  );
}
