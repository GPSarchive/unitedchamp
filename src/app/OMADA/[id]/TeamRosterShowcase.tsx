"use client";

import { motion } from "framer-motion";
import { Users, Star } from "lucide-react";
import {
  FaUser,
  FaRulerVertical,
  FaBirthdayCake,
  FaFutbol,
  FaHandsHelping,
} from "react-icons/fa";
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
          Error loading players: {errorMessage}
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
    <section className="py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8 text-center"
      >
        <div className="mb-3 flex items-center justify-center gap-3">
          <Users className="h-8 w-8 text-red-500" />
          <h2
            id="team-roster-heading"
            className="text-3xl font-bold md:text-4xl text-white"
            style={{
              textShadow:
                "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            }}
          >
            Ρόστερ Ομάδας
          </h2>
        </div>
        <p
          className="text-lg text-white/80"
          style={{
            textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          }}
        >
          Επίσημο ρόστερ και βασικά στατιστικά παικτών
        </p>
        <p className="mt-1 text-sm text-red-300/90">
          Σύνολο παικτών: {playerAssociations.length}
        </p>
      </motion.div>

      {/* Grid of players */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 justify-items-center">
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
  const handleClick = () => {
    // TODO: Add your modal/detail view component here
    console.log('Player clicked:', fullName);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.6,
        type: "spring",
        stiffness: 180,
        damping: 15,
      }}
      whileHover={{
        scale: 1.03,
        y: -12,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      onClick={handleClick}
      className="cursor-pointer group relative"
      style={{ width: "220px" }}
    >
      {/* Main Glassmorphic Card Container */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-2xl transition-all duration-500 group-hover:border-red-400/60 group-hover:shadow-[0_0_40px_rgba(239,68,68,0.4),0_0_80px_rgba(239,68,68,0.2),inset_0_0_60px_rgba(239,68,68,0.1)]">

        {/* Animated gradient glow overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-red-500/20 via-transparent to-amber-500/20 pointer-events-none" />

        {/* Top gloss effect */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />

        {/* Player Image Section */}
        <div className="relative h-[280px] overflow-hidden rounded-t-[28px]">
          <AvatarImage
            src={photoUrl}
            alt={fullName}
            width={440}
            height={560}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
          />

          {/* Dynamic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-500" />

          {/* Spotlight effect on hover */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Top badge and star */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            {/* Position badge */}
            {position && (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 + 0.2 }}
                className="inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-400/50 shadow-lg"
              >
                <FaUser className="text-[10px] text-red-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {position}
                </span>
              </motion.div>
            )}

            {/* Star decoration */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: index * 0.05 + 0.3, type: "spring" }}
              className="p-2 bg-gradient-to-br from-amber-400/30 to-red-500/30 backdrop-blur-md rounded-full border border-amber-400/40 shadow-lg group-hover:shadow-[0_0_20px_rgba(251,191,36,0.5)] transition-all duration-300"
            >
              <Star className="h-4 w-4 text-amber-400 fill-amber-400/50 group-hover:fill-amber-400 transition-all" />
            </motion.div>
          </div>

          {/* Player name overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
            <div className="text-center">
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 + 0.15 }}
                className="text-xl font-black text-white tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] group-hover:text-red-400 transition-colors duration-300"
              >
                {firstName}
              </motion.div>
              {lastName && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 + 0.2 }}
                  className="text-sm font-semibold text-white/90 tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
                >
                  {lastName}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section - Integrated Glassmorphic Panel */}
        <div className="relative p-4 bg-gradient-to-br from-black/60 via-black/40 to-black/60 backdrop-blur-md">
          {/* Divider line with glow */}
          <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-red-400/50 to-transparent group-hover:via-red-400 transition-all duration-500" />

          {/* Info badges row */}
          <div className="flex items-center justify-center gap-2 mb-3">
            {age != null && (
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 group-hover:border-amber-400/40 transition-all">
                <FaBirthdayCake className="text-[10px] text-amber-400" />
                <span className="text-xs font-semibold text-white">{age}y</span>
              </div>
            )}
            {heightCm != null && (
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 group-hover:border-amber-400/40 transition-all">
                <FaRulerVertical className="text-[10px] text-amber-400" />
                <span className="text-xs font-semibold text-white">{heightCm}cm</span>
              </div>
            )}
          </div>

          {/* Stats header */}
          <div className="flex items-center justify-center gap-2 mb-2.5">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-red-400/30" />
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500/20 to-amber-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-red-400/40">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="text-[10px] font-black text-red-300 uppercase tracking-widest">
                Stats
              </span>
            </div>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-red-400/30" />
          </div>

          {/* Stats grid - Modern layout */}
          <div className="space-y-2">
            {/* Top row: Matches, Goals, Assists */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Matches" value={totals.matches} icon={<FaFutbol />} />
              <StatCard label="Goals" value={totals.goals} icon={<FaFutbol />} highlight />
              <StatCard label="Assists" value={totals.assists} icon={<FaHandsHelping />} />
            </div>

            {/* Bottom row: MVP, Best GK */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="MVP"
                value={totals.mvp}
                icon={<Star className="w-3 h-3" />}
                highlight={totals.mvp > 0}
              />
              <StatCard
                label="Best GK"
                value={totals.best_gk}
                icon={<Star className="w-3 h-3" />}
                highlight={totals.best_gk > 0}
              />
            </div>
          </div>

          {/* Footer tag */}
          <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-center gap-2 text-[9px] text-white/40 uppercase tracking-wider">
            <FaFutbol className="text-[8px]" />
            <span>Career Stats</span>
          </div>
        </div>

        {/* Bottom glass shine */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Outer glow ring on hover */}
      <div className="absolute inset-0 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-red-500/0 via-red-500/10 to-amber-500/0 blur-xl -z-10" />
    </motion.div>
  );
}

// New StatCard component for the modern stats display
type StatCardProps = {
  label: string;
  value: number;
  icon?: React.ReactNode;
  highlight?: boolean;
};

function StatCard({ label, value, icon, highlight = false }: StatCardProps) {
  return (
    <div className={[
      "relative overflow-hidden rounded-xl px-2.5 py-2 transition-all duration-300",
      "bg-gradient-to-br backdrop-blur-sm border",
      highlight
        ? "from-amber-500/20 to-red-500/20 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
        : "from-white/5 to-white/10 border-white/10 hover:border-white/20"
    ].join(" ")}>
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative flex flex-col items-center justify-center gap-1">
        {icon && (
          <div className={[
            "text-xs",
            highlight ? "text-amber-400" : "text-white/60"
          ].join(" ")}>
            {icon}
          </div>
        )}
        <div className={[
          "text-lg font-black tabular-nums leading-none",
          highlight ? "text-amber-400" : "text-white"
        ].join(" ")}>
          {value}
        </div>
        <div className="text-[9px] uppercase tracking-widest font-semibold text-white/50">
          {label}
        </div>
      </div>
    </div>
  );
}
