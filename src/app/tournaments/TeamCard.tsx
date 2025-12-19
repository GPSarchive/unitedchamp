// app/components/TeamCard.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { MediumTeamLogo } from "@/app/components/TeamLogo";

type TeamCardProps = {
  team: {
    id: number;
    name: string;
    logo: string;
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    topScorer: { id: number; name: string; goals: number } | null;
    yellowCards: number;
    redCards: number;
    blueCards: number;
    stageStandings: { stageId: number; rank: number | null; points: number }[];
  };
  stageId?: number; // Optional for stage-specific rank
};

const TeamCard: React.FC<TeamCardProps> = ({ team, stageId }) => {
  const rank = stageId
    ? team.stageStandings.find(s => s.stageId === stageId)?.rank || 'N/A'
    : team.points; // Fallback to points for overall

  return (
    <motion.div
      className="team-card bg-black text-white p-6 rounded-lg shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out transform hover:scale-105"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="flex items-center gap-4 mb-6">
        <MediumTeamLogo
          src={team.logo}
          alt={`${team.name} logo`}
          borderStyle="strong"
        />
        <div>
          <h3 className="text-2xl font-semibold">{team.name}</h3>
          <p className="text-sm text-orange-400">{team.points} Points</p>
        </div>
      </div>
      <div className="stats-grid grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold">{team.matchesPlayed}</div>
          <div className="text-xs text-gray-400">Matches</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.wins}</div>
          <div className="text-xs text-gray-400">Wins</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.draws}</div>
          <div className="text-xs text-gray-400">Draws</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.losses}</div>
          <div className="text-xs text-gray-400">Losses</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.goalsFor}</div>
          <div className="text-xs text-gray-400">Goals For</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.goalsAgainst}</div>
          <div className="text-xs text-gray-400">Goals Against</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.goalDifference}</div>
          <div className="text-xs text-gray-400">Goal Difference</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.yellowCards}</div>
          <div className="text-xs text-gray-400">Yellow Cards</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.redCards}</div>
          <div className="text-xs text-gray-400">Red Cards</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.blueCards}</div>
          <div className="text-xs text-gray-400">Blue Cards</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{team.topScorer?.name || 'None'} ({team.topScorer?.goals || 0})</div>
          <div className="text-xs text-gray-400">Top Scorer</div>
        </div>
      </div>
      <div className="rank-info text-center">
        <div className="text-lg font-semibold text-gray-300">Rank</div>
        <div className="text-3xl font-bold">{rank}</div>
      </div>
    </motion.div>
  );
};

export default TeamCard;