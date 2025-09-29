// app/.../stages/KnockoutTree/newknockout/useKnockoutDesigner.ts
"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { DraftMatch } from "../../TournamentWizard";

type KOStageState = {
  // stageIdx -> DraftMatch[]
  byStage: Record<number, DraftMatch[]>;
  // stageIdx -> dirty flag (unsaved changes)
  dirty: Record<number, boolean>;
};

type Actions = {
  initStage: (stageIdx: number, matches: DraftMatch[]) => void;
  replaceAll: (stageIdx: number, matches: DraftMatch[]) => void;
  updateMatch: (stageIdx: number, idx: number, patch: Partial<DraftMatch>) => void;
  addMatch: (
    stageIdx: number,
    init?: Partial<DraftMatch>
  ) => void;
  removeMatch: (stageIdx: number, idx: number) => void;

  // Core bracket ops (examples)
  setTeam: (stageIdx: number, idx: number, side: "A" | "B", teamId: number | null) => void;
  swapSides: (stageIdx: number, idx: number) => void;

  // Read
  getStage: (stageIdx: number) => DraftMatch[];
  markSaved: (stageIdx: number) => void;
};

type Store = KOStageState & Actions;

const ensureLocalIds = (arr: DraftMatch[]) =>
  arr.map((m) => ({ _localId: (m as any)._localId ?? Number(m.id ?? nanoid()), ...m }));

export const useKnockoutDesigner = create<Store>((set, get) => ({
  byStage: {},
  dirty: {},

  initStage: (stageIdx, matches) => {
    set((s) => ({
      byStage: { ...s.byStage, [stageIdx]: ensureLocalIds(matches ?? []) },
      dirty: { ...s.dirty, [stageIdx]: false },
    }));
  },

  replaceAll: (stageIdx, matches) => {
    set((s) => ({
      byStage: { ...s.byStage, [stageIdx]: ensureLocalIds(matches ?? []) },
      dirty: { ...s.dirty, [stageIdx]: true },
    }));
  },

  updateMatch: (stageIdx, idx, patch) => {
    const curr = get().byStage[stageIdx] ?? [];
    const next = curr.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    set((s) => ({
      byStage: { ...s.byStage, [stageIdx]: next },
      dirty: { ...s.dirty, [stageIdx]: true },
    }));
  },

  addMatch: (stageIdx, init) => {
    const curr = get().byStage[stageIdx] ?? [];
    set((s) => ({
      byStage: {
        ...s.byStage,
        [stageIdx]: ensureLocalIds([
          ...curr,
          {
            stageIdx,
            groupIdx: null,
            round: (init?.round ?? 1) as any,
            team_a_id: null,
            team_b_id: null,
            bracket_pos: (init as any)?.bracket_pos ?? curr.length + 1,
            ...init,
          } as DraftMatch,
        ]),
      },
      dirty: { ...s.dirty, [stageIdx]: true },
    }));
  },

  removeMatch: (stageIdx, idx) => {
    const curr = get().byStage[stageIdx] ?? [];
    const next = curr.filter((_, i) => i !== idx);
    set((s) => ({
      byStage: { ...s.byStage, [stageIdx]: next },
      dirty: { ...s.dirty, [stageIdx]: true },
    }));
  },

  setTeam: (stageIdx, idx, side, teamId) => {
    const key = side === "A" ? "team_a_id" : "team_b_id";
    get().updateMatch(stageIdx, idx, { [key]: teamId } as any);
  },

  swapSides: (stageIdx, idx) => {
    const curr = get().byStage[stageIdx] ?? [];
    const m = curr[idx];
    if (!m) return;
    get().updateMatch(stageIdx, idx, {
      team_a_id: m.team_b_id ?? null,
      team_b_id: m.team_a_id ?? null,
    });
  },

  getStage: (stageIdx) => get().byStage[stageIdx] ?? [],
  markSaved: (stageIdx) =>
    set((s) => ({ ...s, dirty: { ...s.dirty, [stageIdx]: false } })),
}));
