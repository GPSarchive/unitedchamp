// app/dashboard/tournaments/TournamentCURD/stages/StageList.tsx
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
}: {
  stages: NewTournamentPayload["stages"];
  onChange: (stages: NewTournamentPayload["stages"]) => void;
  teams: TeamDraft[];
}) {
  // --- Store actions we need for persistence
  const storeUpsertStage = useTournamentStore((s) => s.upsertStage);
  const storeRemoveStage = useTournamentStore((s) => s.removeStage);
  const storeListGroupsForStageIdx = useTournamentStore((s) => s.listGroupsForStageIdx);
  const storeRemoveGroup = useTournamentStore((s) => s.removeGroup);

  const add = () => {
    const nextStage = {
      name: `Stage ${stages.length + 1}`,
      kind: "league",
      ordering: stages.length + 1,
      // sensible league defaults so multi-round RR works out of the box
      config: {
        interval_days: 7,
        rounds_per_opponent: 1,
        double_round: false,
        shuffle: false,
      },
      // keep groups empty by default; StageCard handles creating groups when switching to "groups"
      groups: [],
    } as any;

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
    const { name, kind, config } = patch as any;
    if (name != null || kind != null || config != null) {
      storeUpsertStage(idx, {
        ...(name != null ? { name } : {}),
        ...(kind != null ? { kind: kind as any } : {}),
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
    // preserve existing id
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
          />
        ))}
      </div>
    </div>
  );
}
