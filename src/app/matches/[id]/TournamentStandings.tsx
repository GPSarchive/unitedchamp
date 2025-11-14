"use client";

import { motion } from "framer-motion";
import { Trophy, TrendingUp, Award, Medal, Crown } from "lucide-react";
import Link from "next/link";
import { TeamImage } from "@/app/lib/OptimizedImage";
import type { StandingRow } from "./queries";

/**
 * TournamentStandings - Neon Triumph Edition
 * Displays tournament standings with deep navy + neon magenta/cyan aesthetic
 * Features: Animated entrance, floating orbs, trophy icons, gradient highlights
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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 100 }}
      className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] p-6 md:p-8 shadow-[0_10px_50px_-10px_rgba(0,0,0,0.8)] backdrop-blur-sm"
    >
      {/* Animated floating orbs - magenta & cyan */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-32 h-64 w-64 rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(closest-side, rgba(240,46,170,0.4), transparent)" }}
        animate={{ x: [0, -20, 10, 0], y: [0, 15, -10, 0] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-32 h-72 w-72 rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(closest-side, rgba(0,212,255,0.35), transparent)" }}
        animate={{ x: [0, 15, -12, 0], y: [0, -20, 12, 0] }}
        transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
      />

      {/* Header with gradient text */}
      <div className="relative z-10 mb-8 flex items-center gap-3">
        <motion.div
          initial={{ rotate: -15, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-400/30 shadow-[0_0_24px_rgba(240,46,170,0.3)]"
        >
          <Trophy className="h-6 w-6 text-fuchsia-300" />
        </motion.div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-fuchsia-300 via-pink-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(240,46,170,0.5)]">
            Βαθμολογία
          </h2>
          {groupName && (
            <p className="text-sm text-zinc-400 mt-0.5">{groupName}</p>
          )}
        </div>
      </div>

      {standings.length === 0 ? (
        /* Empty State */
        <div className="relative z-10 flex flex-col items-center justify-center py-12 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 border border-white/10"
          >
            <Trophy className="h-10 w-10 text-white/40" />
          </motion.div>
          <p className="text-lg text-white/70 mb-2">Δεν υπάρχουν διαθέσιμα στοιχεία βαθμολογίας</p>
          <p className="text-sm text-white/50">
            Η βαθμολογία θα εμφανιστεί όταν υπάρξουν αποτελέσματα αγώνων
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="relative z-10 hidden overflow-x-auto md:block">
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-zinc-400">
                  <th className="pb-3 pl-4 font-medium">#</th>
                  <th className="pb-3 pl-2 font-medium">Ομάδα</th>
                  <th className="pb-3 px-3 text-center font-medium">Αγ</th>
                  <th className="pb-3 px-3 text-center font-medium">Ν</th>
                  <th className="pb-3 px-3 text-center font-medium">Ι</th>
                  <th className="pb-3 px-3 text-center font-medium">Η</th>
                  <th className="pb-3 px-3 text-center font-medium">ΓΥ</th>
                  <th className="pb-3 px-3 text-center font-medium">ΓΚ</th>
                  <th className="pb-3 px-3 text-center font-medium">ΔΓ</th>
                  <th className="pb-3 pr-4 text-right font-medium">Βαθ</th>
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
          <div className="relative z-10 space-y-3 md:hidden">
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

/**
 * Desktop table row with neon highlights for top positions
 */
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

  // Position badge styling
  const getBadgeStyle = () => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.6)]";
      case 2:
        return "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-[0_0_16px_rgba(203,213,225,0.5)]";
      case 3:
        return "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100 shadow-[0_0_16px_rgba(217,119,6,0.5)]";
      default:
        return "bg-white/5 text-zinc-400 border border-white/10";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, type: "spring", stiffness: 120 }}
      className={`group transition-all ${
        isTopThree
          ? "bg-gradient-to-r from-fuchsia-500/5 via-purple-500/5 to-cyan-500/5"
          : "hover:bg-white/5"
      }`}
    >
      <td className="py-4 pl-4 rounded-l-xl">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-transform group-hover:scale-110 ${getBadgeStyle()}`}
        >
          {PositionIcon ? (
            <PositionIcon className="h-5 w-5" />
          ) : (
            position
          )}
        </div>
      </td>
      <td className="py-4 pl-2">
        <Link href={`/omada/${standing.team_id}`} className="block">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/20 bg-black/50 ring-1 ring-white/10">
              {standing.team.logo ? (
                <TeamImage
                  src={standing.team.logo}
                  alt={standing.team.name}
                  fill
                  objectFit="contain"
                  sizes="40px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-fuchsia-300">
                  {standing.team.name.charAt(0)}
                </div>
              )}
              {/* Shimmer effect for first place */}
              {isFirst && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />
              )}
            </div>
            <span className={`font-semibold ${isFirst ? "text-amber-200" : "text-zinc-100"}`}>
              {standing.team.name}
            </span>
          </div>
        </Link>
      </td>
      <td className="px-3 py-4 text-center text-zinc-300 font-medium">{standing.played}</td>
      <td className="px-3 py-4 text-center text-emerald-400 font-semibold">{standing.won}</td>
      <td className="px-3 py-4 text-center text-cyan-400 font-semibold">{standing.drawn}</td>
      <td className="px-3 py-4 text-center text-rose-400 font-semibold">{standing.lost}</td>
      <td className="px-3 py-4 text-center text-zinc-300 font-medium">{standing.gf}</td>
      <td className="px-3 py-4 text-center text-zinc-300 font-medium">{standing.ga}</td>
      <td
        className={`px-3 py-4 text-center font-bold ${
          standing.gd > 0
            ? "text-emerald-400"
            : standing.gd < 0
            ? "text-rose-400"
            : "text-zinc-500"
        }`}
      >
        {standing.gd > 0 ? "+" : ""}
        {standing.gd}
      </td>
      <td className="pr-4 py-4 text-right rounded-r-xl">
        <div
          className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-lg font-bold ${
            isFirst
              ? "bg-gradient-to-r from-amber-400/20 to-yellow-500/20 text-amber-200 ring-1 ring-amber-400/40"
              : "text-zinc-100"
          }`}
        >
          {standing.points}
        </div>
      </td>
    </motion.tr>
  );
}

/**
 * Mobile card with compact stats and neon accents
 */
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
        return "bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.6)]";
      case 2:
        return "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-[0_0_16px_rgba(203,213,225,0.5)]";
      case 3:
        return "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100 shadow-[0_0_16px_rgba(217,119,6,0.5)]";
      default:
        return "bg-white/5 text-zinc-400 border border-white/10";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, type: "spring" }}
      className={`rounded-2xl border p-4 backdrop-blur-sm transition-all ${
        isTopThree
          ? "border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-cyan-500/10 shadow-[0_0_24px_rgba(240,46,170,0.2)]"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/omada/${standing.team_id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${getBadgeStyle()}`}
          >
            {PositionIcon ? (
              <PositionIcon className="h-5 w-5" />
            ) : (
              position
            )}
          </div>
          <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/20 bg-black/50">
            {standing.team.logo ? (
              <TeamImage
                src={standing.team.logo}
                alt={standing.team.name}
                fill
                objectFit="contain"
                sizes="48px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-fuchsia-300">
                {standing.team.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate font-semibold ${isFirst ? "text-amber-200" : "text-zinc-100"}`}>
              {standing.team.name}
            </div>
            <div className="text-xs text-zinc-500">{standing.played} αγώνες</div>
          </div>
        </Link>
        <div
          className={`text-2xl font-bold ${
            isFirst
              ? "bg-gradient-to-br from-amber-200 to-yellow-300 bg-clip-text text-transparent"
              : "text-zinc-100"
          }`}
        >
          {standing.points}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 py-2">
          <div className="text-xs text-zinc-400">Ν</div>
          <div className="font-bold text-emerald-400">{standing.won}</div>
        </div>
        <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-2">
          <div className="text-xs text-zinc-400">Ι</div>
          <div className="font-bold text-cyan-400">{standing.drawn}</div>
        </div>
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 py-2">
          <div className="text-xs text-zinc-400">Η</div>
          <div className="font-bold text-rose-400">{standing.lost}</div>
        </div>
        <div
          className={`rounded-lg border py-2 ${
            standing.gd > 0
              ? "bg-emerald-500/10 border-emerald-500/20"
              : standing.gd < 0
              ? "bg-rose-500/10 border-rose-500/20"
              : "bg-white/5 border-white/10"
          }`}
        >
          <div className="text-xs text-zinc-400">ΔΓ</div>
          <div
            className={`font-bold ${
              standing.gd > 0
                ? "text-emerald-400"
                : standing.gd < 0
                ? "text-rose-400"
                : "text-zinc-500"
            }`}
          >
            {standing.gd > 0 ? "+" : ""}
            {standing.gd}
          </div>
        </div>
      </div>
    </motion.div>
  );
}