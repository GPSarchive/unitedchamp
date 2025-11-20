"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Trophy, 
  Target,
  Award,
  Zap,
  Shield,
  Activity,
  TrendingUp,
  ChevronDown
} from "lucide-react";
import {
  FaUser,
  FaRulerVertical,
  FaBirthdayCake,
  FaFutbol,
  FaHandsHelping,
  FaMedal,
  FaFire,
  FaChartLine,
  FaCrown,
  FaAward
} from "react-icons/fa";
import { 
  GiSoccerBall, 
  GiWhistle, 
  GiTrophy,
  GiLaurels,
  GiShieldEchoes
} from "react-icons/gi";
import { 
  MdOutlineSportsScore, 
  MdSportsSoccer,
  MdEmojiEvents 
} from "react-icons/md";
import AvatarImage from "./AvatarImage";
import type { PlayerAssociation } from "@/app/lib/types";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

interface TeamRosterShowcaseProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
}

export default function TeamRosterShowcase({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
}: TeamRosterShowcaseProps) {
  if (errorMessage) {
    return (
      <section className="rounded-2xl bg-red-950/40 border border-red-500/40 p-4">
        <p className="text-red-200 text-sm">
          Σφάλμα φόρτωσης παικτών: {errorMessage}
        </p>
      </section>
    );
  }

  if (!playerAssociations || playerAssociations.length === 0) {
    return (
      <section className="rounded-2xl bg-black/40 border border-white/10 p-6">
        <h2
          className="text-xl font-bold text-white mb-2"
          style={{
            textShadow:
              "1px 1px 2px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000",
          }}
        >
          Ρόστερ Ομάδας
        </h2>
        <p className="text-sm text-zinc-300">
          Δεν υπάρχουν παίκτες στο ρόστερ για αυτή την ομάδα.
        </p>
      </section>
    );
  }

  return (
    <section className="py-6 px-2 sm:px-4 lg:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8 sm:mb-10 lg:mb-12 text-center"
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3">
          <GiTrophy className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-amber-400" />
          <h2
            id="team-roster-heading"
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white"
            style={{
              textShadow:
                "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            }}
          >
            Ρόστερ Ομάδας
          </h2>
          <GiLaurels className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-amber-400" />
        </div>
        <p
          className="text-base sm:text-lg lg:text-xl text-white/80 mb-2"
          style={{
            textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          }}
        >
          Επίσημο ρόστερ και βασικά στατιστικά παικτών
        </p>
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-amber-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-red-400/40">
          <Users className="h-4 w-4 text-red-400" />
          <span className="text-sm font-bold text-white">
            Σύνολο παικτών: {playerAssociations.length}
          </span>
        </div>
      </motion.div>

      {/* Grid of players - Enhanced responsive layout */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 max-w-[1800px] mx-auto">
        {playerAssociations.map((assoc, index) => {
          const p = assoc.player;
          const photoUrl = resolvePlayerPhotoUrl(p.photo);

          const stats =
            p.player_statistics?.[0] ?? {
              age: null,
              total_goals: 0,
              total_assists: 0,
              yellow_cards: 0,
              red_cards: 0,
              blue_cards: 0,
            };

          // Per-season rows for this team
          const perSeason = (seasonStatsByPlayer?.[p.id] ?? []) as Array<any>;

          const totals = perSeason.reduce(
            (acc, row) => {
              acc.matches += row.matches ?? 0;
              acc.goals += row.goals ?? 0;
              acc.assists += row.assists ?? 0;
              acc.mvp += row.mvp ?? 0;
              acc.best_gk += row.best_gk ?? 0;
              return acc;
            },
            {
              matches: 0,
              goals: 0,
              assists: 0,
              mvp: 0,
              best_gk: 0,
            }
          );

          const fullName =
            `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Άγνωστος";
          const firstName = p.first_name || fullName || "Άγνωστος";

          const age = stats.age as number | null;
          const heightCm = p.height_cm as number | null;

          return (
            <PlayerCard
              key={p.id}
              index={index}
              firstName={firstName}
              lastName={p.last_name}
              fullName={fullName}
              position={p.position}
              age={age}
              heightCm={heightCm}
              photoUrl={photoUrl}
              totals={totals}
            />
          );
        })}
      </div>
    </section>
  );
}

type PlayerCardProps = {
  index: number;
  firstName: string;
  lastName?: string | null;
  fullName: string;
  position?: string | null;
  age?: number | null;
  heightCm?: number | null;
  photoUrl: string;
  totals: {
    matches: number;
    goals: number;
    assists: number;
    mvp: number;
    best_gk: number;
  };
};

function PlayerCard({
  index,
  firstName,
  lastName,
  fullName,
  position,
  age,
  heightCm,
  photoUrl,
  totals,
}: PlayerCardProps) {
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  const handleClick = () => {
    // TODO: Add your modal/detail view component here
    console.log('Κλικ στον παίκτη:', fullName);
  };

  const toggleStats = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsStatsExpanded(!isStatsExpanded);
  };

  // Determine if player is a standout performer
  const isStandout = totals.mvp > 0 || totals.best_gk > 0 || totals.goals > 10;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.6,
        type: "spring",
        stiffness: 180,
        damping: 15,
      }}
      whileHover={{
        scale: 1.04,
        y: -14,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      onClick={handleClick}
      className="cursor-pointer group relative w-full max-w-[320px] mx-auto"
    >
      {/* Main Glassmorphic Card Container */}
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-2xl transition-all duration-500 group-hover:border-red-400/60 group-hover:shadow-[0_0_40px_rgba(239,68,68,0.4),0_0_80px_rgba(239,68,68,0.2),inset_0_0_60px_rgba(239,68,68,0.1)]">

        {/* Animated gradient glow overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-red-500/20 via-transparent to-amber-500/20 pointer-events-none" />

        {/* Top gloss effect */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />

        {/* Player Image Section - Responsive height */}
        <div className="relative h-[260px] sm:h-[280px] lg:h-[300px] overflow-hidden rounded-t-3xl">
          <AvatarImage
            src={photoUrl}
            alt={fullName}
            width={560}
            height={700}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
          />

          {/* Dynamic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-500" />

          {/* Spotlight effect on hover */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Top section: Position badge only */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            {/* Position badge with premium icon */}
            {position && (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.04 + 0.2 }}
                className="inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-400/50 shadow-lg"
              >
                <GiShieldEchoes className="text-xs text-red-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {position}
                </span>
              </motion.div>
            )}
          </div>

          {/* Player name overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
            <div className="text-center">
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.04 + 0.15 }}
                className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] group-hover:text-red-400 transition-colors duration-300"
              >
                {firstName}
              </motion.div>
              {lastName && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04 + 0.2 }}
                  className="text-sm sm:text-base font-semibold text-white/90 tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
                >
                  {lastName}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section - Retractable Panel */}
        <div className="relative bg-gradient-to-br from-black/60 via-black/40 to-black/60 backdrop-blur-md">
          {/* Divider line with glow */}
          <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-red-400/50 to-transparent group-hover:via-red-400 transition-all duration-500" />

          {/* Stats Toggle Button */}
          <button
            onClick={toggleStats}
            className="w-full p-4 sm:p-5 flex items-center justify-center gap-2 hover:bg-white/5 transition-all duration-300"
          >
            <TrendingUp className="w-4 h-4 text-red-400" />
            <span className="text-xs font-black text-red-300 uppercase tracking-widest">
              {isStatsExpanded ? 'Απόκρυψη Στατιστικών' : 'Προβολή Στατιστικών'}
            </span>
            <motion.div
              animate={{ rotate: isStatsExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="w-4 h-4 text-red-400" />
            </motion.div>
          </button>

          {/* Expandable Stats Content */}
          <AnimatePresence>
            {isStatsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2">
                  {/* Info badges row */}
                  <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
                    {age != null && (
                      <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 group-hover:border-amber-400/40 transition-all">
                        <FaBirthdayCake className="text-xs text-amber-400" />
                        <span className="text-xs font-semibold text-white">{age} ετών</span>
                      </div>
                    )}
                    {heightCm != null && (
                      <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 group-hover:border-amber-400/40 transition-all">
                        <Activity className="w-3 h-3 text-amber-400" />
                        <span className="text-xs font-semibold text-white">{heightCm}εκ</span>
                      </div>
                    )}
                  </div>

                  {/* Stats divider */}
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-red-400/30" />
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-amber-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-400/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      <span className="text-[10px] font-black text-red-300 uppercase tracking-widest">
                        Επιδόσεις
                      </span>
                    </div>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-red-400/30" />
                  </div>

                  {/* Stats grid - Responsive layout */}
                  <div className="space-y-2">
                    {/* Top row: Matches, Goals, Assists */}
                    <div className="grid grid-cols-3 gap-2">
                      <StatCard 
                        label="Αγώνες" 
                        value={totals.matches} 
                        icon={<MdSportsSoccer className="w-4 h-4" />} 
                      />
                      <StatCard 
                        label="Γκολ" 
                        value={totals.goals} 
                        icon={<GiSoccerBall className="w-4 h-4" />} 
                        highlight 
                      />
                      <StatCard 
                        label="Ασίστ" 
                        value={totals.assists} 
                        icon={<FaHandsHelping className="w-4 h-4" />} 
                      />
                    </div>

                    {/* Bottom row: MVP, Best GK */}
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        label="MVP"
                        value={totals.mvp}
                        icon={<Trophy className="w-3.5 h-3.5" />}
                        highlight={totals.mvp > 0}
                      />
                      <StatCard
                        label="Καλύτερος ΤΦ."
                        value={totals.best_gk}
                        icon={<Shield className="w-3.5 h-3.5" />}
                        highlight={totals.best_gk > 0}
                      />
                    </div>
                  </div>

                  {/* Footer tag */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-center gap-2 text-[9px] text-white/40 uppercase tracking-wider">
                    <MdOutlineSportsScore className="text-xs" />
                    <span>Συνολική Απόδοση</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom glass shine */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Outer glow ring on hover */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-red-500/0 via-red-500/10 to-amber-500/0 blur-xl -z-10" />
    </motion.div>
  );
}

// Enhanced StatCard component with premium design
type StatCardProps = {
  label: string;
  value: number;
  icon?: React.ReactNode;
  highlight?: boolean;
};

function StatCard({ label, value, icon, highlight = false }: StatCardProps) {
  return (
    <div className={[
      "relative overflow-hidden rounded-xl px-2 sm:px-2.5 py-2 sm:py-2.5 transition-all duration-300",
      "bg-gradient-to-br backdrop-blur-sm border",
      highlight
        ? "from-amber-500/20 to-red-500/20 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:shadow-[0_0_20px_rgba(251,191,36,0.5)]"
        : "from-white/5 to-white/10 border-white/10 hover:border-white/20 hover:from-white/10 hover:to-white/15"
    ].join(" ")}>
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Animated pulse for highlighted stats */}
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-red-500/10 animate-pulse" />
      )}

      <div className="relative flex flex-col items-center justify-center gap-1">
        {icon && (
          <div className={[
            "transition-all duration-300",
            highlight ? "text-amber-400" : "text-white/60 group-hover:text-white/80"
          ].join(" ")}>
            {icon}
          </div>
        )}
        <div className={[
          "text-lg sm:text-xl font-black tabular-nums leading-none transition-all duration-300",
          highlight ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-white"
        ].join(" ")}>
          {value}
        </div>
        <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-white/50 text-center leading-tight">
          {label}
        </div>
      </div>
    </div>
  );
}