// File: ./stages/KnockoutStage.tsx
"use client";

import React from "react";
import type { Stage } from "../useTournamentData";
import { useTournamentData } from "../useTournamentData";
import KOStageDisplay from "./koStage/KOStageDisplay";
import MatchCarousel from "./MatchCarousel";

const KnockoutStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  const stageIdx = useTournamentData((s) => s.ids.stageIndexById[stage.id]);
  const matches = useTournamentData((s) => s.matches);
  const getTeamName = useTournamentData((s) => s.getTeamName);
  const getTeamLogo = useTournamentData((s) => s.getTeamLogo);

  return (
    <div className="space-y-8">
      {/* Knockout Bracket */}
      <div className="relative h-[24rem] sm:h-[30rem] md:h-[40rem] lg:h-[48rem]">
        <KOStageDisplay stage={stage} />
      </div>

      {/* Team Select & Matches Carousel */}
      {stageIdx !== undefined && (
        <MatchCarousel
          stageIdx={stageIdx}
          matches={matches ?? []}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
        />
      )}
    </div>
  );
};

export default KnockoutStage;
