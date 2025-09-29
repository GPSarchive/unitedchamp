// app/.../stages/KnockoutTree/newknockout/useKnockoutDesigner.ts
"use client";

import { create } from "zustand";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
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
  addMatch: (stageIdx: number, init?: Partial<DraftMatch>) => void;
  removeMatch: (stageIdx: number, idx: number) => void;

  // Core bracket ops (examples)
  setTeam: (stageIdx: number, idx: number, side: "A" | "B", teamId: number | null) => void;
  swapSides: (stageIdx: number, idx: number) => void;

  // Read
  getStage: (stageIdx: number) => DraftMatch[];
  markSaved: (stageIdx: number) => void;
};

type Store = KOStageState & Actions;

/* ------------------------------------------------------------------ */
/* Local id helper (NO access to non-existent m.id)                    */
/* ------------------------------------------------------------------ */
/** Build a numeric, stable-ish local id from known fields.
 *  Priority:
 *   1) existing _localId (number)
 *   2) KO identity (round + bracket_pos) → e.g. 2|5 → 2005
 *   3) row order + random salt
 */
function makeLocalId(m: DraftMatch, i: number): number {
  const maybe = (m as any)._localId;
  if (typeof maybe === "number" && Number.isFinite(maybe)) return maybe;

  if (m.round != null && m.bracket_pos != null) {
    const r = Number(m.round) || 0;
    const b = Number(m.bracket_pos) || 0;
    // pack as r * 1000 + b (works up to 999 bracket positions per round)
    return r * 1000 + b;
  }

  // last resort: stable within session-ish
  return i + Math.floor(Math.random() * 1_000_000);
}

const ensureLocalIds = (arr: DraftMatch[]) =>
  arr.map((m, i) => ({ ...m, _localId: makeLocalId(m, i) } as DraftMatch & { _localId: number }));

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */
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
    const next = curr.map((m, i) => (i === idx ? ({ ...m, ...patch } as DraftMatch) : m));
    set((s) => ({
      byStage: { ...s.byStage, [stageIdx]: ensureLocalIds(next) },
      dirty: { ...s.dirty, [stageIdx]: true },
    }));
  },

  addMatch: (stageIdx, init) => {
    const curr = get().byStage[stageIdx] ?? [];
    const nextRow: DraftMatch = {
      stageIdx,
      groupIdx: null,
      round: (init?.round ?? 1) as any,
      bracket_pos:
        (init as any)?.bracket_pos ??
        // if KO context, try to place after last item in round
        (curr.length
          ? Math.max(
              0,
              ...curr
                .filter((m) => (m.round ?? 1) === (init?.round ?? 1))
                .map((m) => m.bracket_pos ?? 0)
            ) + 1
          : 1),
      team_a_id: null,
      team_b_id: null,
      matchday: null,
      match_date: null,
      ...init,
    };
    set((s) => ({
      byStage: { ...s.byStage, [stageIdx]: ensureLocalIds([...(s.byStage[stageIdx] ?? []), nextRow]) },
      dirty: { ...s.dirty, [stageIdx]: true },
    }));
  },

  removeMatch: (stageIdx, idx) => {
    const curr = get().byStage[stageIdx] ?? [];
    const next = curr.filter((_, i) => i !== idx);
    set((s) => ({
      byStage: { ...s.byStage, [stageIdx]: ensureLocalIds(next) },
      dirty: { ...s.dirty, [stageIdx]: true },
    }));
  },

  setTeam: (stageIdx, idx, side, teamId) => {
    const key = side === "A" ? "team_a_id" : "team_b_id";
    get().updateMatch(stageIdx, idx, { [key]: teamId } as Partial<DraftMatch>);
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
    set((s) => ({
      ...s,
      dirty: { ...s.dirty, [stageIdx]: false },
    })),
}));
