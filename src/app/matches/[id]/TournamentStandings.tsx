"use client";

import { motion } from "framer-motion";
import { Trophy, Award, Medal, Crown } from "lucide-react";
import Link from "next/link";
import { TeamImage } from "@/app/lib/OptimizedImage";
import type { StandingRow } from "./queries";

/**
 * TournamentStandings - Elegant sporty standings table
 * Features emerald accents, clean dark design, position badges
 */
export default function TournamentStandings({
  standings,
  groupName,
}: {
  standings: StandingRow[];
  groupName?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Trophy className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Βαθμολογία</h2>
          {groupName && <p className="text-sm text-white/50">{groupName}</p>}
        </div>
      </div>

      {standings.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Trophy className="h-8 w-8 text-white/20" />
          </div>
          <p className="text-base text-white/50 mb-1">Δεν υπάρχουν διαθέσιμα στοιχεία βαθμολογίας</p>
          <p className="text-sm text-white/30">
            Η βαθμολογία θα εμφανιστεί όταν υπάρξουν αποτελέσματα αγώνων
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04] text-left text-xs text-white/40 uppercase tracking-wider">
                  <th className="py-3 pl-5 font-medium">#</th>
                  <th className="py-3 pl-3 font-medium">Ομάδα</th>
                  <th className="py-3 px-3 text-center font-medium">Αγ</th>
                  <th className="py-3 px-3 text-center font-medium">Ν</th>
                  <th className="py-3 px-3 text-center font-medium">Ι</th>
                  <th className="py-3 px-3 text-center font-medium">Η</th>
                  <th className="py-3 px-3 text-center font-medium">ΓΥ</th>
                  <th className="py-3 px-3 text-center font-medium">ΓΚ</th>
                  <th className="py-3 px-3 text-center font-medium">ΔΓ</th>
                  <th className="py-3 pr-5 text-right font-medium">Βαθ</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, index) => (
                  <StandingRowDesktop
                    key={standing.team_id}
                    standing={standing}
                    index={index}
                    position={standing.rank ?? index + 1}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 p-4 md:hidden">
            {standings.map((standing, index) => (
              <StandingCardMobile
                key={standing.team_id}
                standing={standing}
                index={index}
                position={standing.rank ?? index + 1}
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
}: {
  standing: StandingRow;
  index: number;
  position: number;
}) {
  const isTopThree = position <= 3;
  const isFirst = position === 1;

  const getBadgeStyle = () => {
    switch (position) {
      case 1:
        return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30";
      case 2:
        return "bg-white/10 text-white/80 ring-1 ring-white/20";
      case 3:
        return "bg-amber-500/15 text-amber-300/80 ring-1 ring-amber-500/20";
      default:
        return "bg-white/[0.03] text-white/40";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`group border-b border-white/[0.03] transition-colors ${
        isTopThree ? "bg-emerald-500/[0.02]" : "hover:bg-white/[0.02]"
      }`}
    >
      <td className="py-3.5 pl-5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${getBadgeStyle()}`}
        >
          {PositionIcon ? <PositionIcon className="h-4 w-4" /> : position}
        </div>
      </td>
      <td className="py-3.5 pl-3">
        <Link href={`/omada/${standing.team_id}`} className="block">
          <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative h-9 w-9 overflow-hidden rounded-lg ring-1 ring-white/10 bg-zinc-800/50">
              {standing.team.logo ? (
                <TeamImage
                  src={standing.team.logo}
                  alt={standing.team.name}
                  fill
                  objectFit="contain"
                  sizes="36px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/30">
                  {standing.team.name.charAt(0)}
                </div>
              )}
            </div>
            <span className={`font-semibold ${isFirst ? "text-emerald-300" : "text-white/80"}`}>
              {standing.team.name}
            </span>
          </div>
        </Link>
      </td>
      <td className="px-3 py-3.5 text-center text-sm text-white/50">{standing.played}</td>
      <td className="px-3 py-3.5 text-center text-sm font-medium text-emerald-400">{standing.won}</td>
      <td className="px-3 py-3.5 text-center text-sm font-medium text-white/50">{standing.drawn}</td>
      <td className="px-3 py-3.5 text-center text-sm font-medium text-rose-400/70">{standing.lost}</td>
      <td className="px-3 py-3.5 text-center text-sm text-white/50">{standing.gf}</td>
      <td className="px-3 py-3.5 text-center text-sm text-white/50">{standing.ga}</td>
      <td
        className={`px-3 py-3.5 text-center text-sm font-semibold ${
          standing.gd > 0 ? "text-emerald-400" : standing.gd < 0 ? "text-rose-400/70" : "text-white/30"
        }`}
      >
        {standing.gd > 0 ? "+" : ""}{standing.gd}
      </td>
      <td className="pr-5 py-3.5 text-right">
        <span
          className={`inline-flex min-w-[2rem] items-center justify-center rounded-lg px-2 py-1 text-base font-bold ${
            isFirst ? "bg-emerald-500/15 text-emerald-300" : "text-white/80"
          }`}
        >
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
}: {
  standing: StandingRow;
  index: number;
  position: number;
}) {
  const isTopThree = position <= 3;
  const isFirst = position === 1;

  const getBadgeStyle = () => {
    switch (position) {
      case 1:
        return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30";
      case 2:
        return "bg-white/10 text-white/80 ring-1 ring-white/20";
      case 3:
        return "bg-amber-500/15 text-amber-300/80 ring-1 ring-amber-500/20";
      default:
        return "bg-white/[0.03] text-white/40";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`rounded-xl border p-3.5 ${
        isTopThree
          ? "border-emerald-500/10 bg-emerald-500/[0.03]"
          : "border-white/[0.05] bg-white/[0.02]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/omada/${standing.team_id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${getBadgeStyle()}`}>
            {PositionIcon ? <PositionIcon className="h-4 w-4" /> : position}
          </div>
          <div className="relative h-10 w-10 overflow-hidden rounded-lg ring-1 ring-white/10 bg-zinc-800/50">
            {standing.team.logo ? (
              <TeamImage
                src={standing.team.logo}
                alt={standing.team.name}
                fill
                objectFit="contain"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/30">
                {standing.team.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate font-semibold ${isFirst ? "text-emerald-300" : "text-white/80"}`}>
              {standing.team.name}
            </div>
            <div className="text-xs text-white/40">{standing.played} αγώνες</div>
          </div>
        </Link>
        <div className={`text-xl font-bold ${isFirst ? "text-emerald-300" : "text-white/80"}`}>
          {standing.points}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/10 py-1.5">
          <div className="text-[10px] text-white/40">Ν</div>
          <div className="text-sm font-bold text-emerald-400">{standing.won}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] py-1.5">
          <div className="text-[10px] text-white/40">Ι</div>
          <div className="text-sm font-bold text-white/60">{standing.drawn}</div>
        </div>
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/10 py-1.5">
          <div className="text-[10px] text-white/40">Η</div>
          <div className="text-sm font-bold text-rose-400/80">{standing.lost}</div>
        </div>
        <div
          className={`rounded-lg border py-1.5 ${
            standing.gd > 0
              ? "bg-emerald-500/10 border-emerald-500/10"
              : standing.gd < 0
              ? "bg-rose-500/10 border-rose-500/10"
              : "bg-white/[0.03] border-white/[0.05]"
          }`}
        >
          <div className="text-[10px] text-white/40">ΔΓ</div>
          <div
            className={`text-sm font-bold ${
              standing.gd > 0 ? "text-emerald-400" : standing.gd < 0 ? "text-rose-400/80" : "text-white/40"
            }`}
          >
            {standing.gd > 0 ? "+" : ""}{standing.gd}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
