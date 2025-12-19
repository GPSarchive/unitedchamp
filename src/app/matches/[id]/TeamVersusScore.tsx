"use client";

import { motion } from "framer-motion";
import { SquareTeamLogo } from "@/app/components/TeamLogo";
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
        timeZone: "UTC",
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
      className="rounded-2xl border border-white/20 bg-black/50 p-6 backdrop-blur-sm md:p-8 shadow-lg"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
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
              className="flex items-center gap-3 text-6xl font-black md:text-7xl lg:text-8xl"
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
              className="text-5xl font-black text-white md:text-6xl lg:text-7xl"
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
        <SquareTeamLogo
          src={team.logo}
          alt={team.name}
          size="xl"
          borderStyle={isWinner ? "strong" : "normal"}
          rounded="lg"
          priority
          className={`!h-20 !w-20 md:!h-28 md:!w-28 lg:!h-32 lg:!w-32 ${
            isWinner
              ? "shadow-[0_0_30px_rgba(251,191,36,0.5)]"
              : ""
          }`}
        />

        {/* Winner Trophy */}
        {isWinner && (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="absolute -right-2 -top-2 pointer-events-none z-10"
          >
            <div className="rounded-full bg-amber-400 p-2 shadow-lg">
              <Trophy className="h-5 w-5 text-amber-900" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Team Name */}
      <div
        className={`max-w-full px-2 text-center text-lg font-bold md:text-xl ${
          isWinner
            ? "text-amber-400"
            : "text-white"
        }`}
        style={{
          textShadow: isWinner
            ? '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 15px rgba(251,191,36,0.4)'
            : '1px 1px 3px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000'
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