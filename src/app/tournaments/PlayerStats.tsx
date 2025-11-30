// app/components/PlayerStats.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

type PlayerStatsProps = {
  player: {
    id: number;
    name: string;
    position: string | null;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    blueCards: number;
    mvp: number;
    bestGoalkeeper: number;
    matchesPlayed: number;
    photo: string;
    teamId: number;
    isCaptain: boolean;
  };
};

const PlayerStats: React.FC<PlayerStatsProps> = ({ player }) => {
  const { name, position, goals, assists, yellowCards, redCards, blueCards, mvp, bestGoalkeeper, matchesPlayed, photo, teamId, isCaptain } = player;

  return (
    <motion.div
      className="player-card bg-black text-white p-6 rounded-lg shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out transform hover:scale-105"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="flex items-center gap-6 mb-6">
        <img
          src={resolvePlayerPhotoUrl(photo)}
          alt={name}
          className="h-20 w-20 object-cover rounded-full border-4 border-orange-500"
        />
        <div>
          <h3 className="text-2xl font-semibold">{name} {isCaptain && <span className="badge text-sm text-orange-400">Captain</span>}</h3>
          <p className="text-sm text-gray-400">{position || 'N/A'}</p>
        </div>
      </div>
      <div className="stats-grid grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold">{goals}</div>
          <div className="text-xs text-gray-400">Goals</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{assists}</div>
          <div className="text-xs text-gray-400">Assists</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{yellowCards}</div>
          <div className="text-xs text-gray-400">Yellow Cards</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{redCards}</div>
          <div className="text-xs text-gray-400">Red Cards</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{blueCards}</div>
          <div className="text-xs text-gray-400">Blue Cards</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{mvp > 0 ? "🏆" : "No"}</div>
          <div className="text-xs text-gray-400">MVP</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{bestGoalkeeper > 0 ? "🏆" : "No"}</div>
          <div className="text-xs text-gray-400">Best GK</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{matchesPlayed}</div>
          <div className="text-xs text-gray-400">Matches</div>
        </div>
      </div>
      <div className="text-center mt-4">
        <div className="text-xl font-semibold text-gray-300">Team</div>
        <div className="text-2xl font-bold">Team {teamId}</div>
      </div>
    </motion.div>
  );
};

export default PlayerStats;