// app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/KnockoutBoard.tsx
"use client";

import { useMemo } from "react";
import BracketCanvasPro from "./BracketCanvas";
import type { DraftMatch } from "../../../TournamentWizard";

type TeamsMap = Record<number | string, { name: string; logo?: string | null; seed?: number | null }>;

export default function KnockoutBoard({
  stageIdx,
  teamsMap,
  eligibleTeamIds,
  draftMatches,
  onDraftChange,
}: {
  stageIdx: number;
  teamsMap: TeamsMap;
  eligibleTeamIds: number[];
  draftMatches: DraftMatch[];
  onDraftChange: (next: DraftMatch[]) => void;
}) {
  // Only this stage's matches (for debug & potential local helpers)
  const stageMatches = useMemo(
    () => draftMatches.filter((m) => m.stageIdx === stageIdx),
    [draftMatches, stageIdx]
  );

  // --- Debug: verify we can resolve names for the teams used in this stage
  const idsInStage = useMemo(() => {
    const s = new Set<number>();
    for (const m of stageMatches) {
      if (m.team_a_id != null) s.add(m.team_a_id as number);
      if (m.team_b_id != null) s.add(m.team_b_id as number);
    }
    return Array.from(s.values());
  }, [stageMatches]);

  if (process.env.NODE_ENV !== "production") {
    const sample = idsInStage.slice(0, 6).map((id) => ({
      id,
      name: teamsMap[id]?.name ?? teamsMap[String(id)]?.name ?? null,
    }));
    // Helpful trace to ensure names arrive from StageCard's catalog fetch
    console.log(
      `[KnockoutBoard] stage #${stageIdx} — matches: ${stageMatches.length}, teamIds: ${idsInStage.length}`,
      sample
    );
  }

  return (
    <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
      <BracketCanvasPro
        stageIdx={stageIdx}
        teamsMap={teamsMap}
        eligibleTeamIds={eligibleTeamIds}
        draftMatches={draftMatches}        // keep full list (Canvas filters by stageIdx internally)
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
