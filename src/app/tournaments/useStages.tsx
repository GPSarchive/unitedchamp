// File: useStages.tsx
"use client";

import React, { useMemo, useCallback } from "react";
import type { Stage } from "./useTournamentData";
import { useTournamentData } from "./useTournamentData";

// Renderer components - UPDATE THESE PATHS based on your project structure
import LeagueStage from "./stages/LeagueStage";
import GroupsStage from "./stages/GroupsStage";
import KnockoutStage from "./stages/KnockoutStage";

// Fallback component for unsupported stage types
const UnsupportedStage: React.FC<{ stage: Stage }> = ({ stage }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
        Unsupported stage type
      </h4>
      <span className="inline-flex h-7 items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 text-xs text-slate-600 dark:text-slate-300">
        {stage.kind}
      </span>
    </div>
    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
      No renderer available for this stage type. Please add a component for "{stage.kind}" stages.
    </p>
  </section>
);

// Mapping: stage kind → renderer component
const rendererMap: Partial<Record<Stage["kind"], React.ComponentType<{ stage: Stage }>>> = {
  league: LeagueStage,
  groups: GroupsStage,
  knockout: KnockoutStage,
  // mixed: MixedStage, // Add when available
};

const getStageRenderer = (stage: Stage): React.ComponentType<{ stage: Stage }> => {
  return rendererMap[stage.kind] ?? UnsupportedStage;
};

/**
 * Centralized hook for stage management
 * Provides sorted stages, lookups, and renderer delegation
 */
export const useStages = () => {
  const { stages, groups, ids } = useTournamentData();

  /** Sorted stages by ordering (ascending) */
  const sortedStages = useMemo(() => {
    return (stages ?? []).slice().sort((a, b) => a.ordering - b.ordering);
  }, [stages]);

  /** Get stage by database ID */
  const getStageById = useCallback(
    (id: number): Stage | undefined => {
      return (stages ?? []).find((s) => s.id === id);
    },
    [stages]
  );

  /** Get stage by UI index (via computed ID map) */
  const getStageByIndex = useCallback(
    (index: number): Stage | undefined => {
      const stageId = ids?.stageIdByIndex?.[index];
      return typeof stageId === "number" ? getStageById(stageId) : undefined;
    },
    [ids?.stageIdByIndex, getStageById]
  );

  /** Get groups for a stage, sorted by ordering */
  const getGroupsForStage = useCallback(
    (stageId: number) => {
      return (groups ?? [])
        .filter((g) => g.stage_id === stageId)
        .sort((a, b) => a.ordering - b.ordering);
    },
    [groups]
  );

  /** Get appropriate renderer component for a stage */
  const getRendererForStage = useCallback(
    (stage: Stage) => getStageRenderer(stage),
    []
  );

  return {
    stages: sortedStages,
    getStageById,
    getStageByIndex,
    getGroupsForStage,
    getRendererForStage,
  } as const;
};