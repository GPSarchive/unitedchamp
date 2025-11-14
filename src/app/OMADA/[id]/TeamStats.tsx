"use client";

import { motion } from "framer-motion";
import { TrendingUp, Target, Shield, Zap } from "lucide-react";

interface TeamStatsProps {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  totalMatches: number;
}

export default function TeamStats({
  wins,
  draws,
  losses,
  goalsFor,
  goalsAgainst,
  totalMatches,
}: TeamStatsProps) {
  const goalDifference = goalsFor - goalsAgainst;
  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : "0.0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] p-6 md:p-8 shadow-[0_10px_50px_-10px_rgba(0,0,0,0.8)] backdrop-blur-sm"
    >
      {/* Floating Orbs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-32 h-64 w-64 rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(closest-side, rgba(16,185,129,0.4), transparent)" }}
        animate={{ x: [0, -15, 8, 0], y: [0, 12, -8, 0] }}
        transition={{ repeat: Infinity, duration: 11, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-32 h-72 w-72 rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(closest-side, rgba(245,158,11,0.35), transparent)" }}
        animate={{ x: [0, 12, -10, 0], y: [0, -15, 10, 0] }}
        transition={{ repeat: Infinity, duration: 13, ease: "easeInOut" }}
      />

      {/* Header */}
      <div className="relative z-10 mb-8 flex items-center gap-3">
        <motion.div
          initial={{ rotate: -15, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-400/30 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
        >
          <TrendingUp className="h-6 w-6 text-emerald-300" />
        </motion.div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-300 via-green-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(16,185,129,0.5)]">
            Στατιστικά Ομάδας
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">{totalMatches} συνολικοί αγώνες</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Wins */}
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="Νίκες"
          value={wins}
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
          borderColor="border-emerald-500/20"
          delay={0.1}
        />

        {/* Draws */}
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          label="Ισοπαλίες"
          value={draws}
          color="text-cyan-400"
          bgColor="bg-cyan-500/10"
          borderColor="border-cyan-500/20"
          delay={0.15}
        />

        {/* Losses */}
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Ήττες"
          value={losses}
          color="text-rose-400"
          bgColor="bg-rose-500/10"
          borderColor="border-rose-500/20"
          delay={0.2}
        />

        {/* Win Rate */}
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Ποσοστό Νικών"
          value={`${winRate}%`}
          color="text-amber-400"
          bgColor="bg-amber-500/10"
          borderColor="border-amber-500/20"
          delay={0.25}
        />
      </div>

      {/* Goal Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="relative z-10 mt-6 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Goals For */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Γκολ Υπέρ</span>
            <span className="text-2xl font-black text-emerald-400">{goalsFor}</span>
          </div>
        </div>

        {/* Goals Against */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Γκολ Κατά</span>
            <span className="text-2xl font-black text-rose-400">{goalsAgainst}</span>
          </div>
        </div>

        {/* Goal Difference */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Διαφορά Γκολ</span>
            <span
              className={`text-2xl font-black ${
                goalDifference > 0
                  ? "text-emerald-400"
                  : goalDifference < 0
                  ? "text-rose-400"
                  : "text-zinc-500"
              }`}
            >
              {goalDifference > 0 ? "+" : ""}
              {goalDifference}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
  borderColor,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
  borderColor: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, type: "spring" }}
      className={`rounded-xl border ${borderColor} ${bgColor} p-4 hover:scale-105 transition-all`}
    >
      <div className="flex flex-col items-center text-center">
        <div className={`mb-2 ${color}`}>{icon}</div>
        <span className="text-xs text-zinc-400 mb-1">{label}</span>
        <span className={`text-3xl font-black ${color}`}>{value}</span>
      </div>
    </motion.div>
  );
}
