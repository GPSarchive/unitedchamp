// app/components/DashboardPageComponents/TournamentCURD/stages/ModernKnockoutTree/types.ts
import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";

export type RoundLabelFnArgs = {
  round: number;
  index: number;
  total: number;
  matchesInRound: number;
  teamsInRound: number;
};

export type ModernKnockoutTreeProps = {
  title?: string;
  matches: Match[];
  teamsMap: TeamsMap;
  onMatchClick?: (m: Match) => void;
  roundLabelFn?: (a: RoundLabelFnArgs) => string;
  colWidth?: number;
  minCardHeight?: number;
  gapX?: number;
  maxAutoFit?: number;
  minRowGap?: number;
  lang?: "en" | "el";
  labels?: Partial<Labels>;

  editable?: boolean;
  eligibleTeamIds?: number[];
  onAssignSlot?: (matchId: number, slot: "A" | "B", teamId: number | null) => void;
  onSwapPair?: (matchId: number) => void;
  onBulkAssignFirstRound?: (
    rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>
  ) => void;
  onClearFirstRound?: () => void;
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
};

export type Edge = { fromId: number; toId: number };

export type Option = { id: number | null; label: string; disabled: boolean; reason?: string };
