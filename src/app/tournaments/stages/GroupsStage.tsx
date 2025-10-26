"use client";

import React from "react";
import { useStages } from "../useStages"; // Adjust path (centralized hook)
import type { Stage } from "../useTournamentData"; // Adjust path
import StageStandingsMiniPublic from "../StageStandingsMiniPublic"; // Adjust path
import StageMatchesTabs from "../StageMatchesTabs"; // Adjust path

const GroupsStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  const { getGroupsForStage } = useStages(); // Use centralized hook for sorted groups
  const sortedGroups = getGroupsForStage(stage.id);
  const stageIdx = stage.ordering; // Aligns with store's computed index

  return (
    <div className="stage-section space-y-6">
      <h2 className="text-2xl font-bold text-white">{stage.name} (Groups)</h2>
      <div className="grid gap-8 md:grid-cols-2">
        {sortedGroups.map((group) => {
          // Note: If you need groupIdx, use the hook's utilities or compute from ordering
          const groupIdx = group.ordering - 1; // Assuming 1-based ordering; adjust if needed

          return (
            <div key={group.id} className="group-section space-y-4 p-4 rounded-lg border border-white/10 bg-slate-950/50">
              <h3 className="text-xl font-semibold text-white">{group.name}</h3>
              
              {/* Per-group Standings */}
              <StageStandingsMiniPublic
                stageIdx={stageIdx}
                kind="groups"
                showLogos={true}
                groupIdxOverride={groupIdx}
              />
              
              {/* Per-group Matches Tabs */}
              <StageMatchesTabs
                stageIdx={stageIdx}
                groupIdx={groupIdx}
                pageSize={5}
                variant="glass"
              />
            </div>
          );
        })}
      </div>
      {sortedGroups.length === 0 && <p className="text-white/70">No groups available for this stage.</p>}
    </div>
  );
};

export default GroupsStage;