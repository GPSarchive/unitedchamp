"use client";

import { useMemo } from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData";
import KnockoutBracket from "./KnockoutBracket";

const KOStageDisplay = () => {
  const stages = useTournamentData((state) => state.stages);
  const matches = useTournamentData((state) => state.matches);

  const knockoutStageIdx = useMemo(
    () => stages?.findIndex((stage) => stage.kind === "knockout") ?? -1,
    [stages]
  );

  const knockoutMatches = useMemo(() => {
    if (knockoutStageIdx === -1) return [];
    return (matches ?? []).filter((match) => match.stageIdx === knockoutStageIdx);
  }, [knockoutStageIdx, matches]);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-sm overflow-hidden">
      <KnockoutBracket matches={knockoutMatches} />
    </div>
  );
};

export default KOStageDisplay;
