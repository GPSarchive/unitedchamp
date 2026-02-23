"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { TeamImage } from "@/app/lib/OptimizedImage";
import { Trophy, Goal, Calendar, User } from "lucide-react";
import type { Id } from "@/app/lib/types";
import { StatusBadge, type MatchStatusType } from "@/components/ui/StatusBadge";

type Team = {
  id: Id;
  name: string;
  logo: string | null;
  colour?: string | null;
};

type Player = {
  id: Id;
  first_name: string | null;
  last_name: string | null;
};

type Scorer = {
  player: Player;
  goals: number;
  ownGoals?: number;
  teamId: Id;
};

/**
 * TeamVersusScore - Cinematic match scoreboard
 * ESPN meets Apple meets Greek football culture
 */
export default function TeamVersusScore({
  teamA,
  teamB,
  scoreA,
  scoreB,
  status,
  matchDate,
  referee,
  winnerTeamId,
  scorers = [],
}: {
  teamA: Team;
  teamB: Team;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  matchDate: string | null;
  referee: string | null;
  winnerTeamId: Id | null;
  scorers?: Scorer[];
}) {
  const isFinished = status === "finished";
  const isPostponed = status === "postponed";
  const aIsWinner = winnerTeamId && winnerTeamId === teamA.id;
  const bIsWinner = winnerTeamId && winnerTeamId === teamB.id;

  const dateLabel = matchDate
    ? new Date(matchDate).toLocaleString("el-GR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "TBD";

  // Separate scorers by team
  const teamAScorers = scorers.filter((s) => s.teamId === teamA.id && s.goals > 0);
  const teamBScorers = scorers.filter((s) => s.teamId === teamB.id && s.goals > 0);
  const teamAOwnGoals = scorers.filter((s) => s.teamId === teamB.id && s.ownGoals && s.ownGoals > 0);
  const teamBOwnGoals = scorers.filter((s) => s.teamId === teamA.id && s.ownGoals && s.ownGoals > 0);

  // Build gradient based on winner
  const getBackgroundGradient = () => {
    if (isFinished && winnerTeamId) {
      const winnerColor = aIsWinner ? teamA.colour : teamB.colour;
      if (winnerColor) {
        return `radial-gradient(ellipse at center, ${winnerColor}08 0%, transparent 50%), radial-gradient(ellipse at center, #18181B 0%, #09090B 100%)`;
      }
    }
    return "radial-gradient(ellipse at center, #18181B 0%, #09090B 100%)";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
      className="relative rounded-2xl border border-white/10 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      style={{ background: getBackgroundGradient() }}
      data-testid="match-scoreboard"
    >
      {/* Main Content */}
      <div className="relative z-10 p-6 md:p-8 lg:p-10">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 md:gap-8">
          {/* Team A */}
          <TeamDisplay
            team={teamA}
            isWinner={!!aIsWinner}
            align="right"
            scorers={[...teamAScorers, ...teamAOwnGoals]}
            isFinished={isFinished}
          />

          {/* Center - Score / VS */}
          <div className="flex flex-col items-center justify-center min-h-[200px]">
            {isFinished ? (
              <ScoreDisplay
                scoreA={scoreA ?? 0}
                scoreB={scoreB ?? 0}
                aIsWinner={!!aIsWinner}
                bIsWinner={!!bIsWinner}
              />
            ) : isPostponed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-6 py-4 rounded-xl bg-orange-500/20 border border-orange-500/30"
              >
                <span className="text-2xl font-black text-orange-400 uppercase tracking-wider">
                  ΑΝΑΒΛΗΘΗΚΕ
                </span>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <motion.span
                  className="text-5xl md:text-6xl lg:text-7xl font-black text-white/80"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    textShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  }}
                >
                  VS
                </motion.span>
              </motion.div>
            )}

            {/* Match Status */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <StatusBadge status={status as MatchStatusType} size="md" />
            </div>
          </div>

          {/* Team B */}
          <TeamDisplay
            team={teamB}
            isWinner={!!bIsWinner}
            align="left"
            scorers={[...teamBScorers, ...teamBOwnGoals]}
            isFinished={isFinished}
          />
        </div>

        {/* Match Info Bar */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-400/60" />
              <span className="font-mono">{dateLabel}</span>
            </div>
            {referee && (
              <>
                <span className="text-white/20">|</span>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-400/60" />
                  <span>Διαιτητής: <span className="text-white/80 font-medium">{referee}</span></span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Animated Score Display
 */
function ScoreDisplay({
  scoreA,
  scoreB,
  aIsWinner,
  bIsWinner,
}: {
  scoreA: number;
  scoreB: number;
  aIsWinner: boolean;
  bIsWinner: boolean;
}) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 12 }}
      className="flex items-center gap-4 md:gap-6"
    >
      <AnimatedNumber 
        value={scoreA} 
        isWinner={aIsWinner} 
      />
      <span className="text-4xl md:text-5xl font-black text-white/30">—</span>
      <AnimatedNumber 
        value={scoreB} 
        isWinner={bIsWinner} 
      />
    </motion.div>
  );
}

/**
 * Animated Number with count-up effect
 */
function AnimatedNumber({ value, isWinner }: { value: number; isWinner: boolean }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      animate(count, value, { duration: 1, ease: [0.16, 1, 0.3, 1] });
    }
  }, [count, value]);

  return (
    <motion.span
      className={`text-6xl md:text-7xl lg:text-8xl font-black tabular-nums ${
        isWinner ? "text-amber-400" : "text-white/50"
      }`}
      style={{
        textShadow: isWinner
          ? "0 0 40px rgba(251,191,36,0.5), 0 4px 20px rgba(0,0,0,0.5)"
          : "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      {rounded}
    </motion.span>
  );
}

/**
 * Team Display Component
 */
function TeamDisplay({
  team,
  isWinner,
  align,
  scorers = [],
  isFinished,
}: {
  team: Team;
  isWinner: boolean;
  align: "left" | "right";
  scorers?: Scorer[];
  isFinished: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: align === "right" ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`flex flex-col items-center gap-4 ${align === "right" ? "items-end" : "items-start"} md:items-center`}
    >
      {/* Team Logo */}
      <div className="relative pointer-events-none">
        <motion.div
          className={`relative h-24 w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 overflow-hidden rounded-2xl bg-black/50 p-3 ${
            isWinner
              ? "border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)]"
              : "border-2 border-white/20"
          }`}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3 }}
        >
          {team.logo ? (
            <TeamImage
              src={team.logo}
              alt={team.name}
              fill
              objectFit="contain"
              sizes="(min-width: 1024px) 128px, (min-width: 768px) 112px, 96px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/40">
              {team.name.charAt(0)}
            </div>
          )}
        </motion.div>

        {/* Winner Trophy Badge */}
        {isWinner && (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.3 }}
            className="absolute -right-2 -top-2"
          >
            <div className="rounded-full bg-gradient-to-br from-amber-400 to-amber-500 p-2 shadow-[0_0_15px_rgba(251,191,36,0.6)]">
              <Trophy className="h-5 w-5 text-amber-900" />
            </div>
          </motion.div>
        )}

        {/* Animated Pulse for Winner */}
        {isWinner && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-amber-400"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {/* Team Name */}
      <h3
        className={`text-lg md:text-xl font-bold text-center max-w-[150px] ${
          isWinner ? "text-amber-400" : "text-white"
        }`}
        style={{
          textShadow: isWinner
            ? "0 0 20px rgba(251,191,36,0.4)"
            : "0 2px 10px rgba(0,0,0,0.5)",
        }}
      >
        {team.name}
      </h3>

      {/* Scorers List */}
      {isFinished && scorers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`space-y-1.5 ${align === "right" ? "text-right" : "text-left"} md:text-center`}
        >
          {scorers.map((scorer, idx) => {
            const isOwnGoal = (scorer.ownGoals ?? 0) > 0;
            const goalCount = isOwnGoal ? scorer.ownGoals! : scorer.goals;
            if (goalCount <= 0) return null;

            const playerName = `${scorer.player.first_name ?? ""} ${scorer.player.last_name ?? ""}`.trim() || "Άγνωστος";

            return (
              <motion.div
                key={`${scorer.player.id}-${isOwnGoal ? "own" : "goals"}-${idx}`}
                initial={{ opacity: 0, x: align === "right" ? 10 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className="flex items-center gap-1.5 justify-center"
              >
                <span className="text-xs text-white/70">
                  {playerName}
                  {isOwnGoal && <span className="text-white/40"> (αυτ.)</span>}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: goalCount }).map((_, i) => (
                    <Goal
                      key={i}
                      className={`h-3 w-3 ${isOwnGoal ? "text-white/40" : "text-amber-400"}`}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
