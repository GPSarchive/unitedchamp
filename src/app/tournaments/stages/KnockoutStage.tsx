// File: ./stages/KnockoutStage.tsx
"use client";

import React from "react";
import type { Stage } from "../useTournamentData";
import KOStageDisplay from "./koStage/KOStageDisplay";

const KnockoutStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  return (
    <div className="relative h-[24rem] sm:h-[30rem] md:h-[40rem] lg:h-[48rem]">
      <KOStageDisplay stage={stage} />
    </div>
  );
};

export default KnockoutStage;
