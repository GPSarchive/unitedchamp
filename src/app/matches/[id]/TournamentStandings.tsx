"use client";

import { motion } from "framer-motion";
import { Trophy, Crown, Medal, Award } from "lucide-react";
import Link from "next/link";
import { TeamImage } from "@/app/lib/OptimizedImage";
import type { StandingRow } from "./queries";

/**
 * TournamentStandings - Sports-premium standings table
 * Amber/gold accent with cinematic design
 */
export default function TournamentStandings({
  standings,
  groupName,
  highlightTeamIds = [],
}: {
  standings: StandingRow[];
  groupName?: string;
  highlightTeamIds?: number[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden"
      data-testid="tournament-standings"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-center gap-3">
          <Trophy className="h-6 w-6 text-amber-400" />
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">Βαθμολογία</h2>
            {groupName && (
              <p className="text-sm text-white/50 mt-0.5">{groupName}</p>
            )}
          </div>
        </div>
      </div>

      {standings.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <div className="mb-4 h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
            <Trophy className="h-8 w-8 text-white/30" />
          </div>
          <p className="text-white/60 mb-1">Δεν υπάρχουν διαθέσιμα στοιχεία βαθμολογίας</p>
          <p className="text-sm text-white/40">
            Η βαθμολογία θα εμφανιστεί όταν υπάρξουν αποτελέσματα
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-black/30">
                  <th className="py-4 pl-6 pr-3 text-left text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">#</th>
                  <th className="py-4 px-3 text-left text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">Ομάδα</th>
                  <th className="py-4 px-3 text-center text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">ΑΓ</th>
                  <th className="py-4 px-3 text-center text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">Ν</th>
                  <th className="py-4 px-3 text-center text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">Ι</th>
                  <th className="py-4 px-3 text-center text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">Η</th>
                  <th className="py-4 px-3 text-center text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">ΓΥ</th>
                  <th className="py-4 px-3 text-center text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">ΓΚ</th>
                  <th className="py-4 px-3 text-center text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">ΔΓ</th>
                  <th className="py-4 pl-3 pr-6 text-right text-[10px] font-mono font-medium uppercase tracking-wider text-white/40">Β</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.map((standing, index) => (
                  <StandingRowDesktop
                    key={standing.team_id}
                    standing={standing}
                    index={index}
                    position={standing.rank ?? index + 1}
                    isHighlighted={highlightTeamIds.includes(standing.team_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/5">
            {standings.map((standing, index) => (
              <StandingCardMobile
                key={standing.team_id}
                standing={standing}
                index={index}
                position={standing.rank ?? index + 1}
                isHighlighted={highlightTeamIds.includes(standing.team_id)}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function StandingRowDesktop({
  standing,
  index,
  position,
  isHighlighted,
}: {
  standing: StandingRow;
  index: number;
  position: number;
  isHighlighted: boolean;
}) {
  const isTopThree = position <= 3;
  const isFirst = position === 1;

  const getBadgeStyle = () => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 shadow-[0_0_15px_rgba(251,191,36,0.5)]";
      case 2:
        return "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-[0_0_12px_rgba(203,213,225,0.4)]";
      case 3:
        return "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100 shadow-[0_0_12px_rgba(217,119,6,0.4)]";
      default:
        return "bg-white/5 text-white/60 border border-white/10";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`group transition-colors ${
        isHighlighted
          ? "bg-amber-500/10"
          : isTopThree
          ? "bg-amber-500/[0.03]"
          : "hover:bg-white/[0.02]"
      }`}
    >
      <td className="py-4 pl-6 pr-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${getBadgeStyle()}`}>
          {PositionIcon ? <PositionIcon className="h-4 w-4" /> : position}
        </div>
      </td>
      <td className="py-4 px-3">
        <Link href={`/OMADA/${standing.team_id}`} className="flex items-center gap-3 group/link">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/50">
            {standing.team.logo ? (
              <TeamImage
                src={standing.team.logo}
                alt={standing.team.name}
                fill
                objectFit="contain"
                sizes="32px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-amber-400">
                {standing.team.name.charAt(0)}
              </div>
            )}
          </div>
          <span className={`font-medium group-hover/link:text-amber-400 transition-colors ${isFirst ? "text-amber-200" : "text-white"}`}>
            {standing.team.name}
          </span>
        </Link>
      </td>
      <td className="py-4 px-3 text-center text-sm text-white/70 font-mono">{standing.played}</td>
      <td className="py-4 px-3 text-center text-sm text-green-400 font-mono font-medium">{standing.won}</td>
      <td className="py-4 px-3 text-center text-sm text-white/50 font-mono">{standing.drawn}</td>
      <td className="py-4 px-3 text-center text-sm text-red-400 font-mono">{standing.lost}</td>
      <td className="py-4 px-3 text-center text-sm text-white/70 font-mono">{standing.gf}</td>
      <td className="py-4 px-3 text-center text-sm text-white/70 font-mono">{standing.ga}</td>
      <td className={`py-4 px-3 text-center text-sm font-mono font-medium ${
        standing.gd > 0 ? "text-green-400" : standing.gd < 0 ? "text-red-400" : "text-white/40"
      }`}>
        {standing.gd > 0 ? "+" : ""}{standing.gd}
      </td>
      <td className="py-4 pl-3 pr-6 text-right">
        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-lg font-bold ${
          isFirst
            ? "bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/30"
            : "text-white"
        }`}>
          {standing.points}
        </span>
      </td>
    </motion.tr>
  );
}

function StandingCardMobile({
  standing,
  index,
  position,
  isHighlighted,
}: {
  standing: StandingRow;
  index: number;
  position: number;
  isHighlighted: boolean;
}) {
  const isTopThree = position <= 3;
  const isFirst = position === 1;

  const getBadgeStyle = () => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950";
      case 2:
        return "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900";
      case 3:
        return "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100";
      default:
        return "bg-white/5 text-white/60 border border-white/10";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`p-4 ${isHighlighted ? "bg-amber-500/10" : isTopThree ? "bg-amber-500/[0.03]" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <Link href={`/OMADA/${standing.team_id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0 ${getBadgeStyle()}`}>
            {PositionIcon ? <PositionIcon className="h-4 w-4" /> : position}
          </div>
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/50">
            {standing.team.logo ? (
              <TeamImage
                src={standing.team.logo}
                alt={standing.team.name}
                fill
                objectFit="contain"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-amber-400">
                {standing.team.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className={`font-medium truncate ${isFirst ? "text-amber-200" : "text-white"}`}>
              {standing.team.name}
            </p>
            <p className="text-xs text-white/40 font-mono">{standing.played} αγώνες</p>
          </div>
        </Link>
        <div className={`text-2xl font-bold ${isFirst ? "text-amber-400" : "text-white"}`}>
          {standing.points}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 py-2 text-center">
          <p className="text-[10px] text-white/40 uppercase">Ν</p>
          <p className="text-sm font-bold text-green-400">{standing.won}</p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 py-2 text-center">
          <p className="text-[10px] text-white/40 uppercase">Ι</p>
          <p className="text-sm font-bold text-white/50">{standing.drawn}</p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 py-2 text-center">
          <p className="text-[10px] text-white/40 uppercase">Η</p>
          <p className="text-sm font-bold text-red-400">{standing.lost}</p>
        </div>
        <div className={`rounded-lg border py-2 text-center ${
          standing.gd > 0 ? "bg-green-500/10 border-green-500/20" :
          standing.gd < 0 ? "bg-red-500/10 border-red-500/20" :
          "bg-white/5 border-white/10"
        }`}>
          <p className="text-[10px] text-white/40 uppercase">ΔΓ</p>
          <p className={`text-sm font-bold ${
            standing.gd > 0 ? "text-green-400" : standing.gd < 0 ? "text-red-400" : "text-white/40"
          }`}>
            {standing.gd > 0 ? "+" : ""}{standing.gd}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
