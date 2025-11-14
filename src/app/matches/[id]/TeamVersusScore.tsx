"use client";

import { motion } from "framer-motion";
import { TeamImage } from "@/app/lib/OptimizedImage";
import { Trophy, Goal } from "lucide-react";
import type { Id } from "@/app/lib/types";

type Team = {
  id: Id;
  name: string;
  logo: string | null;
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
 * TeamVersusScore - Displays team logos with VS between them when scheduled
 * Shows scores instead of VS when match is finished
 * Includes goal scorers below each team
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
  const aIsWinner = winnerTeamId && winnerTeamId === teamA.id;
  const bIsWinner = winnerTeamId && winnerTeamId === teamB.id;

  const dateLabel = matchDate
    ? new Date(matchDate).toLocaleString("el-GR", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBD";

  // Separate scorers by team (including own goals that benefited each team)
  const teamAScorers = scorers.filter(
    (s) => s.teamId === teamA.id && s.goals > 0
  );
  const teamBScorers = scorers.filter(
    (s) => s.teamId === teamB.id && s.goals > 0
  );

  // Own goals that benefited each team
  const teamAOwnGoals = scorers.filter(
    (s) => s.teamId === teamB.id && s.ownGoals && s.ownGoals > 0
  );
  const teamBOwnGoals = scorers.filter(
    (s) => s.teamId === teamA.id && s.ownGoals && s.ownGoals > 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/20 bg-black/50 p-4 backdrop-blur-sm md:p-6 lg:p-8 shadow-lg overflow-hidden"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4 lg:gap-8">
        {/* Team A */}
        <TeamDisplay
          team={teamA}
          isWinner={!!aIsWinner}
          align="right"
          scorers={[...teamAScorers, ...teamAOwnGoals]}
        />

        {/* Center - VS or Score */}
        <div className="flex flex-col items-center gap-3">
          {isFinished ? (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex items-center gap-1 text-4xl font-black sm:text-5xl sm:gap-2 md:text-6xl md:gap-3 lg:text-7xl"
            >
              <span
                className="text-white"
                style={{
                  textShadow: '3px 3px 6px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                }}
              >
                {scoreA ?? 0}
              </span>
              <span className="text-white/60">-</span>
              <span
                className="text-white"
                style={{
                  textShadow: '3px 3px 6px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                }}
              >
                {scoreB ?? 0}
              </span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, rotate: -10 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ duration: 0.5 }}
              className="text-3xl font-black text-white sm:text-4xl md:text-5xl lg:text-6xl"
              style={{
                textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
              }}
            >
              VS
            </motion.div>
          )}

          {/* Match info */}
          <div className="text-center">
            <div
              className="text-sm uppercase tracking-wider text-white/80 md:text-base"
              style={{
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {status === "finished" ? "Ολοκληρώθηκε" : "Προγραμματισμένο"}
            </div>
            <div
              className="mt-1 text-base text-white/80 md:text-lg"
              style={{
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {dateLabel}
            </div>
            {referee && (
              <div
                className="mt-1 text-xs text-white/70"
                style={{
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}
              >
                Διαιτητής: <span className="font-medium">{referee}</span>
              </div>
            )}
          </div>
        </div>

        {/* Team B */}
        <TeamDisplay
          team={teamB}
          isWinner={!!bIsWinner}
          align="left"
          scorers={[...teamBScorers, ...teamBOwnGoals]}
        />
      </div>
    </motion.div>
  );
}

function TeamDisplay({
  team,
  isWinner,
  align,
  scorers = [],
}: {
  team: Team;
  isWinner: boolean;
  align: "left" | "right";
  scorers?: Scorer[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: align === "right" ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`flex flex-col items-center gap-3 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {/* Team Logo */}
      <div className="relative pointer-events-none">
        <div
          className={`relative h-16 w-16 overflow-hidden rounded-2xl border-2 sm:h-20 sm:w-20 md:h-24 md:w-24 lg:h-28 lg:w-28 ${
            isWinner
              ? "border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)]"
              : "border-white/20"
          } bg-black p-2`}
        >
          {team.logo ? (
            <TeamImage
              src={team.logo}
              alt={team.name}
              fill
              objectFit="contain"
              sizes="(min-width: 1024px) 128px, (min-width: 768px) 112px, 80px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/40">
              {team.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Winner Trophy */}
        {isWinner && (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="absolute -right-2 -top-2 pointer-events-none"
          >
            <div className="rounded-full bg-amber-400 p-2 shadow-lg">
              <Trophy className="h-5 w-5 text-amber-900" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Team Name */}
      <div
        className={`max-w-full px-1 text-center text-sm font-bold sm:text-base md:text-lg lg:text-xl break-words hyphens-auto ${
          isWinner
            ? "text-amber-400"
            : "text-white"
        }`}
        style={{
          textShadow: isWinner
            ? '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 15px rgba(251,191,36,0.4)'
            : '1px 1px 3px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000',
          overflowWrap: 'break-word',
          wordBreak: 'break-word'
        }}
      >
        {team.name}
      </div>

      {/* Scorers - Google Champions League style */}
      {scorers.length > 0 && (
        <div className="mt-3 w-full space-y-1.5 px-2">
          {scorers.map((scorer) => {
            const isOwnGoal = (scorer.ownGoals ?? 0) > 0;
            const goalCount = isOwnGoal ? scorer.ownGoals! : scorer.goals;

            // Skip if no goals to display
            if (goalCount <= 0) return null;

            const playerName = `${scorer.player.first_name ?? ""} ${scorer.player.last_name ?? ""}`.trim() || "Άγνωστος";

            return (
              <motion.div
                key={`${scorer.player.id}-${isOwnGoal ? 'own' : 'goals'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-start gap-1.5"
              >
                <span
                  className="text-xs text-white/90"
                  style={{
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}
                >
                  {playerName}
                  {isOwnGoal ? <span className="text-white/60"> (αυτογκόλ)</span> : null}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: goalCount }).map((_, i) => (
                    <Goal
                      key={i}
                      className={`h-3 w-3 ${
                        isOwnGoal ? "text-white/60" : "text-amber-400"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}