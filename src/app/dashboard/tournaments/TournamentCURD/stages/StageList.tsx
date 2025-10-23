"use client";

import StageCard, { type StageDraft } from "./StageCard";
import type { TeamDraft } from "../TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import type { TournamentState } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

export default function StageList({
  stages,
  onChange,
  teams,
}: {
  stages: StageDraft[];
  onChange: (stages: StageDraft[]) => void;
  teams: TeamDraft[];
}) {
  const storeUpsertStage = useTournamentStore((s: TournamentState) => s.upsertStage);
  const storeRemoveStage = useTournamentStore((s: TournamentState) => s.removeStage);
  const storeListGroupsForStageIdx = useTournamentStore((s: TournamentState) => s.listGroupsForStageIdx);
  const storeRemoveGroup = useTournamentStore((s: TournamentState) => s.removeGroup);

  const add = () => {
    const nextStage: StageDraft = {
      name: `Stage ${stages.length + 1}`,
      kind: "league",
      ordering: stages.length + 1,
      
      groups: [],
    };
    storeUpsertStage(stages.length, { name: nextStage.name, kind: nextStage.kind, config: nextStage.config });
    onChange([...stages, nextStage]);
  };

  const update = (idx: number, patch: Partial<StageDraft>) => {
    const { name, kind, config } = patch;
    if (name != null || kind != null || config != null) {
      storeUpsertStage(idx, {
        ...(name != null ? { name } : {}),
        ...(kind != null ? { kind } : {}),
        ...(config != null ? { config } : {}),
      });
    }
    if (kind && kind !== "groups") {
      const existing = storeListGroupsForStageIdx(idx);
      for (let gi = existing.length - 1; gi >= 0; gi--) storeRemoveGroup(idx, gi);
    }

    const next = stages.slice();
    next[idx] = { id: stages[idx]?.id, ...next[idx], ...patch };
    if (kind && kind !== "groups") next[idx].groups = [];
    onChange(next);
  };

  const remove = (idx: number) => {
    storeRemoveStage(idx);
    onChange(stages.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;
    const next = stages.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((s: StageDraft, i) => (s.ordering = i + 1));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* …header… */}
      <div className="space-y-3">
        {stages.map((s, i) => (
          <StageCard
            key={s?.id ?? `tmp-${i}`}
            value={s}
            index={i}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, +1)}
            allStages={stages}
            teams={teams}
          />
        ))}
      </div>
    </div>
  );
}
