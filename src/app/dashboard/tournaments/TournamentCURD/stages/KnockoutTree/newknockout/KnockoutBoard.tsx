"use client";

// Bracket builder 2.0 (generate-first + leg-aware canvas). The legacy
// BracketCanvas is kept in the repo as a fallback but no longer mounted here.
import BracketBuilder2 from "./BracketBuilder2";

type TeamsMap = Record<number | string, { name: string; logo?: string | null; seed?: number | null }>;

export default function KnockoutBoard({
  stageIdx,
  teamsMap,
}: {
  stageIdx: number;
  teamsMap: TeamsMap;
}) {
  return (
    <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
      <BracketBuilder2 stageIdx={stageIdx} teamsMap={teamsMap} />
    </div>
  );
}