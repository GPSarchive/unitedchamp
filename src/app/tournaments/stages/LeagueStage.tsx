"use client";

import React from "react";
import type { Stage } from "../useTournamentData"; // Adjust path
import StageStandingsMiniPublic from "../StageStandingsMiniPublic"; // Adjust path
import StageMatchesTabs from "../StageMatchesTabs"; // Adjust path

const LeagueStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  const stageIdx = stage.ordering; // Aligns with store's computed index

  return (
    <div className="stage-section space-y-6">
      <h2 className="text-2xl font-bold text-white">{stage.name} (League)</h2>
      
      {/* Standings Table */}
      <StageStandingsMiniPublic
        stageIdx={stageIdx}
        kind="league"
        showLogos={true} // Set to false if logos aren't available in the store
      />
      
      {/* Matches Tabs (upcoming/finished) */}
      <StageMatchesTabs
        stageIdx={stageIdx}
        pageSize={5} // Customize as needed
        variant="glass" // Or 'transparent'
      />
    </div>
  );
};

export default LeagueStage;