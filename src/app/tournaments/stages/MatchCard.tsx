"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";
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

  const teamAWon = match.winner_team_id === match.team_a_id;
  const teamBWon = match.winner_team_id === match.team_b_id;
  const isDraw = isFinished && !match.winner_team_id;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("el-GR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      }),
      time: date.toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }),
    };
  };

  const dateInfo = formatDate(match.match_date);

  return (
    <Link href={`/matches/${match.db_id ?? ""}`} className="block h-full group">
      <motion.div
        className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-300 group-hover:border-white/[0.12] group-hover:bg-white/[0.04] group-hover:shadow-[0_16px_48px_-12px_rgba(16,185,129,0.1)]"
        whileHover={{ y: -4 }}
        transition={{ duration: 0.25 }}
      >
        {/* Status Bar */}
        <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {dateInfo ? (
              <>
                <Calendar className="w-3 h-3 text-white/25" />
                <span className="text-[11px] font-medium text-white/35">{dateInfo.date}</span>
                <span className="text-white/10 text-[10px]">|</span>
                <Clock className="w-3 h-3 text-white/25" />
                <span className="text-[11px] font-medium text-white/35">{dateInfo.time}</span>
              </>
            ) : (
              <span className="text-[11px] font-medium text-white/25">Ημερομηνία TBD</span>
            )}
          </div>

          {isFinished ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
              <CheckCircle2 className="w-2.5 h-2.5" />
              ΤΕΛΙΚΟ
            </span>
          ) : match.status === "postponed" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15">
              <AlertCircle className="w-2.5 h-2.5" />
              ΑΝΑΒΛΗΘΗΚΕ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15">
              ΠΡΟΣΕΧΩΣ
            </span>
          )}
        </div>

        {/* Teams & Score */}
        <div className="px-4 py-5 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            {/* Team A */}
            <TeamSide
              name={teamAName}
              logo={teamALogo}
              isWinner={teamAWon}
              isDraw={isDraw}
              isFinished={isFinished}
              align="left"
            />

            {/* Score / VS */}
            <div className="flex-shrink-0 flex flex-col items-center">
              {isFinished ? (
                <div className="flex items-center gap-1.5">
                  <span className={`text-2xl sm:text-3xl font-black tabular-nums ${
                    teamAWon ? "text-emerald-400" : isDraw ? "text-white/60" : "text-white/25"
                  }`}>
                    {match.team_a_score ?? 0}
                  </span>
                  <span className="text-lg text-white/15 font-light mx-0.5">:</span>
                  <span className={`text-2xl sm:text-3xl font-black tabular-nums ${
                    teamBWon ? "text-emerald-400" : isDraw ? "text-white/60" : "text-white/25"
                  }`}>
                    {match.team_b_score ?? 0}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <span className="text-lg font-bold text-white/15 tracking-widest">VS</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 blur-xl" />
                </div>
              )}
            </div>

            {/* Team B */}
            <TeamSide
              name={teamBName}
              logo={teamBLogo}
              isWinner={teamBWon}
              isDraw={isDraw}
              isFinished={isFinished}
              align="right"
            />
          </div>
        </div>

        {/* Match day indicator */}
        {match.matchday && (
          <div className="px-4 py-2 border-t border-white/[0.03] text-center">
            <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider">
              Αγωνιστική {match.matchday}
            </span>
          </div>
        )}
      </motion.div>
    </Link>
  );
};

/* ─── Team Side ─── */
function TeamSide({
  name,
  logo,
  isWinner,
  isDraw,
  isFinished,
  align,
}: {
  name: string;
  logo: string | null;
  isWinner: boolean;
  isDraw: boolean;
  isFinished: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={`flex-1 flex flex-col items-center gap-2.5 min-w-0 ${
      align === "right" ? "order-last" : ""
    }`}>
      <div className="relative">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
          isWinner
            ? "border-emerald-500/40 shadow-[0_0_20px_-4px_rgba(16,185,129,0.25)]"
            : isFinished && !isDraw
            ? "border-white/[0.06] opacity-60"
            : "border-white/[0.08]"
        }`}>
          {logo ? (
            <img
              src={logo}
              alt={name}
              className="w-full h-full object-contain bg-white/[0.02] p-1.5"
            />
          ) : (
            <div className="w-full h-full bg-white/[0.03] flex items-center justify-center">
              <span className="text-base font-bold text-white/20">
                {name.charAt(0)}
              </span>
            </div>
          )}
        </div>
        {isWinner && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <span className={`text-xs font-semibold text-center leading-tight line-clamp-2 transition-colors ${
        isWinner ? "text-white" : isFinished && !isDraw ? "text-white/40" : "text-white/70"
      }`}>
        {name}
      </span>
    </div>
  );
}

export default MatchCard;
