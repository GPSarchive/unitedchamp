"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { DraftMatch } from "../useTournamentData";

interface MatchCardProps {
  match: DraftMatch;
  getTeamName: (id: number) => string;
  getTeamLogo: (id: number) => string | null;
  isFinished: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, getTeamName, getTeamLogo, isFinished }) => {
  const teamAName = getTeamName(match.team_a_id ?? 0);
  const teamBName = getTeamName(match.team_b_id ?? 0);
  const teamALogo = getTeamLogo(match.team_a_id ?? 0);
  const teamBLogo = getTeamLogo(match.team_b_id ?? 0);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString);
    return date.toLocaleString("el-GR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  return (
    <Link href={`/matches/${match.db_id ?? ""}`} className="block h-full">
      <motion.div
        className="h-full bg-black text-white rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-800 hover:border-orange-500/50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* Match Date Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-b border-orange-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">
              {formatDate(match.match_date)}
            </span>
            {isFinished && (
              <span className="px-2 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full">
                ΟΛΟΚΛΗΡΩΘΗΚΕ
              </span>
            )}
            {!isFinished && (
              <span className="px-2 py-1 text-xs font-bold bg-orange-500/20 text-orange-400 rounded-full">
                ΠΡΟΣΕΧΩΣ
              </span>
            )}
          </div>
        </div>

        {/* Teams Display */}
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            {/* Team A */}
            <div className="flex-1 flex flex-col items-center gap-3">
              <div className="relative">
                {teamALogo ? (
                  <img
                    src={teamALogo}
                    alt={teamAName}
                    className="w-20 h-20 rounded-full object-cover border-4 border-orange-500"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center border-4 border-orange-500">
                    <span className="text-2xl font-bold text-gray-400">?</span>
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-white text-center line-clamp-2">
                {teamAName}
              </span>
            </div>

            {/* Score or VS */}
            <div className="flex flex-col items-center gap-2">
              {isFinished ? (
                <div className="flex items-center gap-3">
                  <span
                    className={`text-4xl font-black ${
                      match.winner_team_id === match.team_a_id
                        ? "text-green-400"
                        : "text-gray-600"
                    }`}
                  >
                    {match.team_a_score ?? 0}
                  </span>
                  <span className="text-2xl font-bold text-gray-600">-</span>
                  <span
                    className={`text-4xl font-black ${
                      match.winner_team_id === match.team_b_id
                        ? "text-green-400"
                        : "text-gray-600"
                    }`}
                  >
                    {match.team_b_score ?? 0}
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-orange-400">VS</span>
              )}
            </div>

            {/* Team B */}
            <div className="flex-1 flex flex-col items-center gap-3">
              <div className="relative">
                {teamBLogo ? (
                  <img
                    src={teamBLogo}
                    alt={teamBName}
                    className="w-20 h-20 rounded-full object-cover border-4 border-orange-500"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center border-4 border-orange-500">
                    <span className="text-2xl font-bold text-gray-400">?</span>
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-white text-center line-clamp-2">
                {teamBName}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default MatchCard;
