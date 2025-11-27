// File: ./stages/KnockoutStage.tsx
"use client";

import React from "react";
import type { Stage } from "../useTournamentData";
import KOStageDisplay from "./koStage/KOStageDisplay";

const KnockoutStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  return (
    <section
      aria-labelledby={`ko-stage-${stage.id}`}
      className="rounded-2xl md:rounded-3xl border border-white/10 bg-black/40 backdrop-blur shadow-sm hover:border-[#FFD700]/20 transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4 md:p-6 bg-gradient-to-r from-[#FFD700]/5 to-transparent">
        <h2
          id={`ko-stage-${stage.id}`}
          className="text-lg sm:text-xl md:text-3xl font-bold text-white"
        >
          {stage.name} <span className="sr-only">stage</span>
        </h2>
        <span className="inline-flex h-6 md:h-7 items-center rounded-full border border-white/10 bg-white/5 px-2 md:px-3 text-xs md:text-sm font-medium text-white/80">
          Knockout
        </span>
      </div>

      {/* Bigger on desktop: more padding + taller viewer area */}
      <div className="p-4 sm:p-5 md:p-6">
        {/* If your KOStageViewer uses its own fixed height, ensure it has responsive heights like h-80 md:h-[36rem] */}
        <div className="relative h-[22rem] sm:h-[26rem] md:h-[36rem] lg:h-[44rem]">
          <KOStageDisplay />
        </div>
      </div>
    </section>
  );
};

export default KnockoutStage;
