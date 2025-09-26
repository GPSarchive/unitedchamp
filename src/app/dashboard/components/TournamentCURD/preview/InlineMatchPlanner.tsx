"use client";
import MatchPlanner from "./MatchPlannerBackup";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  TeamDraft,
  DraftMatch,
} from "../TournamentWizard";

export default function InlineMatchPlanner({
  miniPayload,
  teams,
  draftMatches,
  onDraftChange,
  forceStageIdx,
}: {
  miniPayload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onDraftChange: (next: DraftMatch[]) => void;
  forceStageIdx: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-sm font-medium text-white/90 mb-2">Matches</div>
      <MatchPlanner
        payload={miniPayload}
        teams={teams}
        draftMatches={draftMatches}
        onChange={onDraftChange}
        forceStageIdx={forceStageIdx}
        compact
      />
    </div>
  );
}
