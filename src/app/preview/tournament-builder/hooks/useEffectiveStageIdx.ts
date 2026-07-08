"use client";

// Copy of the effectiveStageIdx memo in stages/StageCard.tsx (lines ~97-118):
// in edit mode the payload stage order can diverge from the store index maps,
// so resolve via payload stage id → stageIndexById when that index has matches.

import { useMemo } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

export function useEffectiveStageIdx(
  allStages: NewTournamentPayload["stages"],
  index: number
) {
  const draftMatches = useTournamentStore((s) => s.draftMatches);
  const stageIndexById = useTournamentStore((s) => s.ids.stageIndexById);

  const payloadStageId = (allStages as any)?.[index]?.id as number | undefined;

  const matchesPerIdx = useMemo(() => {
    const map = new Map<number, number>();
    draftMatches.forEach((m) => {
      const si = (m.stageIdx ?? -1) as number;
      if (si >= 0) map.set(si, (map.get(si) ?? 0) + 1);
    });
    return map;
  }, [draftMatches]);

  return useMemo(() => {
    const preferred = payloadStageId != null ? stageIndexById[payloadStageId] : undefined;
    const preferIdx =
      typeof preferred === "number" && (matchesPerIdx.get(preferred) ?? 0) > 0
        ? preferred
        : undefined;
    if (preferIdx != null) return preferIdx;
    if ((matchesPerIdx.get(index) ?? 0) > 0) return index;
    // for new stages with no matches, use the actual index
    return typeof preferred === "number" ? preferred : index;
  }, [payloadStageId, stageIndexById, index, matchesPerIdx]);
}
