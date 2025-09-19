"use client";
import ModernKnockoutTree from "./ModernKnockoutTree";
import type { BracketMatch } from "@/app/lib/types";

export default function KnockoutBoard({
  title,
  matches,
  teamsMap,
  eligibleTeamIds,
  onAssignSlot,
  onSwapPair,
  onBulkAssignFirstRound,
  onClearFirstRound,
}: {
  title: string;
  matches: BracketMatch[];
  teamsMap: Record<number, { name: string; seed?: number | null; logo?: string | null }>;
  eligibleTeamIds: number[];
  onAssignSlot: (matchViewId: number, slot: "A" | "B", teamId: number | null) => void;
  onSwapPair: (matchViewId: number) => void;
  onBulkAssignFirstRound: (
    rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>
  ) => void;
  onClearFirstRound: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 overflow-x-auto">
      <ModernKnockoutTree
        title={title}
        matches={matches}
        teamsMap={teamsMap as any}
        editable
        eligibleTeamIds={eligibleTeamIds}
        onAssignSlot={onAssignSlot}
        onSwapPair={onSwapPair}
        onBulkAssignFirstRound={onBulkAssignFirstRound}
        onClearFirstRound={onClearFirstRound}
      />
    </div>
  );
}