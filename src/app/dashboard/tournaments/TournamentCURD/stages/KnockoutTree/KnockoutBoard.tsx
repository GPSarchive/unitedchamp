// app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/KnockoutBoard.tsx
"use client";

import BracketCanvas from "./newknockout/BracketCanvas";
import type { DraftMatch } from "../../TournamentWizard";

type TeamsMap = Record<number | string, { name: string }>;

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
  return (
    <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
      <BracketCanvas
        stageIdx={stageIdx}
        teamsMap={teamsMap}
        eligibleTeamIds={eligibleTeamIds}
        draftMatches={draftMatches}
        onDraftChange={onDraftChange}
      />
    </div>
  );
}