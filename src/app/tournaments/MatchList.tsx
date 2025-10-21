// app/components/MatchList.tsx

"use client";

import React from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData";

const MatchList: React.FC<{ stageId: number }> = ({ stageId }) => {
  const { matches } = useTournamentData.getState();

  const stageMatches = matches?.filter((match) => match.stage_id === stageId);

  return (
    <div className="match-list space-y-4">
      <h3 className="text-xl font-semibold">Matches</h3>
      <div className="space-y-4">
        {stageMatches?.map((match) => (
          <div key={match.id} className="match-card p-6 bg-gray-800 rounded-lg hover:bg-orange-600 transition-all duration-300">
            <p>{`Match: ${match.team_a_id} vs ${match.team_b_id}`}</p>
            <p>{`Score: ${match.team_a_score} - ${match.team_b_score}`}</p>
            <p>{`Date: ${new Date(match.match_date).toLocaleDateString()}`}</p>
            <p>{`Status: ${match.status}`}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchList;
