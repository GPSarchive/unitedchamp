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
        className="h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ duration: 0.2 }}
      >
        {/* Match Date Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {formatDate(match.match_date)}
            </span>
            {isFinished && (
              <span className="px-2 py-1 text-xs font-bold bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                ΤΕΛΙΚΟ
              </span>
            )}
            {!isFinished && (
              <span className="px-2 py-1 text-xs font-bold bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-full">
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
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <span className="text-2xl font-bold text-slate-400">?</span>
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-center line-clamp-2">
                {teamAName}
              </span>
            </div>

            {/* Score or VS */}
            <div className="flex flex-col items-center gap-2">
              {isFinished ? (
                <div className="flex items-center gap-3">
                  <span
                    className={`text-3xl font-black ${
                      match.winner_team_id === match.team_a_id
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {match.team_a_score ?? 0}
                  </span>
                  <span className="text-2xl font-bold text-slate-300 dark:text-slate-600">-</span>
                  <span
                    className={`text-3xl font-black ${
                      match.winner_team_id === match.team_b_id
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {match.team_b_score ?? 0}
                  </span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-slate-400 dark:text-slate-500">VS</span>
              )}
            </div>

            {/* Team B */}
            <div className="flex-1 flex flex-col items-center gap-3">
              <div className="relative">
                {teamBLogo ? (
                  <img
                    src={teamBLogo}
                    alt={teamBName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <span className="text-2xl font-bold text-slate-400">?</span>
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-center line-clamp-2">
                {teamBName}
              </span>
            </div>
          </div>

          {/* Additional Info */}
          {match.field && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                📍 {match.field}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
};

export default MatchCard;
