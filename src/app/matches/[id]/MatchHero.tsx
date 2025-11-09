// src/app/matches/[id]/MatchHero.tsx
"use client";

import { motion } from "framer-motion";
import { Trophy, Calendar, User } from "lucide-react";
import type { Id } from "@/app/lib/types";
import { TeamImage, TournamentImage } from "@/app/lib/OptimizedImage";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MatchHero({
  teamA,
  teamB,
  tournament,
  score,
  status,
  date,
  referee,
  winnerId,
}: {
  teamA: { id: Id; name: string; logo: string | null };
  teamB: { id: Id; name: string; logo: string | null };
  tournament?: { name: string; logo: string | null } | null;
  score: { a: number | null; b: number | null };
  status: string;
  date: string;
  referee?: string | null;
  winnerId?: Id | null;
}) {
  const aIsWinner = winnerId && winnerId === teamA.id;
  const bIsWinner = winnerId && winnerId === teamB.id;

  return (
    <div className="relative overflow-hidden">
      {/* Orange/amber gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-600 via-orange-700 to-amber-900" />
        <motion.div
          className="absolute -left-1/4 top-0 h-[600px] w-[600px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.4), transparent)" }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-1/4 bottom-0 h-[600px] w-[600px] rounded-full blur-3xl opacity-25"
          style={{ background: "radial-gradient(closest-side, rgba(245,158,11,0.4), transparent)" }}
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
        />
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Tournament Header */}
        {tournament && (
          <motion.div
            className="mb-12 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {tournament.logo && (
              <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-amber-300/40 bg-black/80 p-3 shadow-[0_0_40px_rgba(251,191,36,0.3)]">
                <TournamentImage
                  src={tournament.logo}
                  alt={tournament.name}
                  fill
                  objectFit="contain"
                  priority
                />
              </div>
            )}
            <h1 className="bg-gradient-to-r from-amber-100 via-white to-amber-100 bg-clip-text text-center text-3xl font-bold tracking-wide text-transparent drop-shadow-lg md:text-4xl">
              {tournament.name}
            </h1>
          </motion.div>
        )}

        {/* Main Match Display - GRAND */}
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
          {/* Team A - GRAND */}
          <motion.div
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative">
              {/* Winner crown */}
              {aIsWinner && (
                <motion.div
                  className="absolute -top-8 left-1/2 -translate-x-1/2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Trophy className="h-10 w-10 text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.9)]" />
                </motion.div>
              )}

              {/* GRAND Team Logo */}
              <div
                className={`relative h-48 w-48 overflow-hidden rounded-3xl border-4 bg-black/95 shadow-2xl transition-all md:h-64 md:w-64 lg:h-72 lg:w-72 ${
                  aIsWinner
                    ? "border-amber-300/80 shadow-[0_0_60px_rgba(251,191,36,0.6)]"
                    : "border-amber-900/50 shadow-[0_10px_50px_rgba(0,0,0,0.9)]"
                }`}
              >
                {teamA.logo ? (
                  <TeamImage
                    src={teamA.logo}
                    alt={`${teamA.name} logo`}
                    fill
                    objectFit="contain"
                    className="p-6"
                    sizes="(min-width: 1024px) 288px, (min-width: 768px) 256px, 192px"
                    priority
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-neutral-900 to-black">
                    <span className="text-6xl font-bold text-amber-300 md:text-7xl lg:text-8xl">
                      {initials(teamA.name)}
                    </span>
                  </div>
                )}

                {/* Gold shimmer effect */}
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-3xl"
                  style={{
                    background:
                      "linear-gradient(120deg, transparent 30%, rgba(251,191,36,0.4) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                />
              </div>
            </div>

            <div className="text-center">
              <h2
                className={`text-2xl font-bold tracking-wide md:text-3xl lg:text-4xl ${
                  aIsWinner ? "text-white drop-shadow-lg" : "text-amber-50"
                }`}
              >
                {teamA.name}
              </h2>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-amber-100/70">Home</p>
            </div>
          </motion.div>

          {/* Center Score Section - GRAND */}
          <motion.div
            className="flex flex-col items-center gap-6 px-8 py-12"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {/* Status Badge */}
            <div className="rounded-full border border-amber-300/50 bg-black/60 px-6 py-2 backdrop-blur-sm">
              <span className="text-sm font-semibold uppercase tracking-widest text-amber-100">
                {status}
              </span>
            </div>

            {/* GRAND Score Display */}
            <div className="relative">
              <div className="flex items-center gap-6">
                <motion.div
                  className={`text-7xl font-black drop-shadow-2xl md:text-8xl lg:text-9xl ${
                    aIsWinner ? "text-amber-200" : "text-white"
                  }`}
                  whileHover={{ scale: 1.1 }}
                >
                  {score.a ?? "–"}
                </motion.div>

                <div className="text-5xl font-light text-amber-300/50 md:text-6xl">:</div>

                <motion.div
                  className={`text-7xl font-black drop-shadow-2xl md:text-8xl lg:text-9xl ${
                    bIsWinner ? "text-amber-200" : "text-white"
                  }`}
                  whileHover={{ scale: 1.1 }}
                >
                  {score.b ?? "–"}
                </motion.div>
              </div>

              {/* Decorative gold lines */}
              <div className="absolute -bottom-4 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
            </div>

            {/* Match Info */}
            <div className="mt-4 space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-white/95">
                <Calendar className="h-4 w-4 text-amber-300" />
                <span className="text-sm font-medium">{date}</span>
              </div>
              {referee && (
                <div className="flex items-center justify-center gap-2 text-amber-100/80">
                  <User className="h-4 w-4 text-amber-300/80" />
                  <span className="text-xs">Διαιτητής: {referee}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Team B - GRAND */}
          <motion.div
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative">
              {/* Winner crown */}
              {bIsWinner && (
                <motion.div
                  className="absolute -top-8 left-1/2 -translate-x-1/2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Trophy className="h-10 w-10 text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.9)]" />
                </motion.div>
              )}

              {/* GRAND Team Logo */}
              <div
                className={`relative h-48 w-48 overflow-hidden rounded-3xl border-4 bg-black/95 shadow-2xl transition-all md:h-64 md:w-64 lg:h-72 lg:w-72 ${
                  bIsWinner
                    ? "border-amber-300/80 shadow-[0_0_60px_rgba(251,191,36,0.6)]"
                    : "border-amber-900/50 shadow-[0_10px_50px_rgba(0,0,0,0.9)]"
                }`}
              >
                {teamB.logo ? (
                  <TeamImage
                    src={teamB.logo}
                    alt={`${teamB.name} logo`}
                    fill
                    objectFit="contain"
                    className="p-6"
                    sizes="(min-width: 1024px) 288px, (min-width: 768px) 256px, 192px"
                    priority
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-neutral-900 to-black">
                    <span className="text-6xl font-bold text-amber-300 md:text-7xl lg:text-8xl">
                      {initials(teamB.name)}
                    </span>
                  </div>
                )}

                {/* Gold shimmer effect */}
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-3xl"
                  style={{
                    background:
                      "linear-gradient(120deg, transparent 30%, rgba(251,191,36,0.4) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                />
              </div>
            </div>

            <div className="text-center">
              <h2
                className={`text-2xl font-bold tracking-wide md:text-3xl lg:text-4xl ${
                  bIsWinner ? "text-white drop-shadow-lg" : "text-amber-50"
                }`}
              >
                {teamB.name}
              </h2>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-amber-100/70">Away</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}