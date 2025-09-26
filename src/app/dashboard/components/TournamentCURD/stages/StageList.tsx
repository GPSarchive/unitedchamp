"use client";

import StageCard from "./StageCard";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";

export default function StageList({
  stages,
  onChange,
  teams,
  draftMatches,
  onDraftChange,
}: {
  stages: NewTournamentPayload["stages"];
  onChange: (stages: NewTournamentPayload["stages"]) => void;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onDraftChange: (next: DraftMatch[]) => void;
}) {
  const add = () => {
    onChange([
      ...stages,
      {
        name: `Stage ${stages.length + 1}`,
        kind: "league",
        ordering: stages.length + 1,
        // 👇 sensible league defaults so multi-round RR works out of the box
        config: {
          interval_days: 7,
          rounds_per_opponent: 1,
          double_round: false,
          shuffle: false,
        },
      } as any,
    ]);
  };

  const update = (idx: number, patch: Partial<(typeof stages)[number]>) => {
    const next = stages.slice();
    // preserve existing id
    next[idx] = { id: (stages as any)[idx]?.id, ...next[idx], ...patch } as any;

    // when switching away from groups, clear groups (OK);
    // when switching TO groups, keep existing group ids if any
    if ((patch as any).kind && (patch as any).kind !== "groups") {
      (next[idx] as any).groups = [];
    }
    onChange(next);
  };

  const remove = (idx: number) => onChange(stages.filter((_, i) => i !== idx));

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
            key={s?.id ?? `tmp-${i}`} // 👈 stable if id exists
            value={s as any}
            index={i}
            onChange={(patch) => update(i, patch as any)}
            onRemove={() => remove(i)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, +1)}
            // ✅ pass context for visuals + inline planner
            allStages={stages}
            teams={teams}
            draftMatches={draftMatches}
            onDraftChange={onDraftChange}
          />
        ))}
      </div>
    </div>
  );
}
