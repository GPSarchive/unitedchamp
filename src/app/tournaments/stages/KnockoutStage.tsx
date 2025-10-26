// File: ./stages/KnockoutStage.tsx
"use client";

import React from "react";
import type { Stage } from "../useTournamentData";
import KOStageDisplay from "../koStage/KOStageDisplay";

const KnockoutStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  return (
    <section
      aria-labelledby={`ko-stage-${stage.id}`}
      className="rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 p-4 md:p-6">
        <h2
          id={`ko-stage-${stage.id}`}
          className="text-lg sm:text-xl md:text-3xl font-bold text-slate-900 dark:text-slate-100"
        >
          {stage.name} <span className="sr-only">stage</span>
        </h2>
        <span className="inline-flex h-6 md:h-7 items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 md:px-3 text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300">
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
