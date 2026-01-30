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
 * TeamVersusScore - Elegant sporty match display
 * Shows team logos with VS or scores, plus goal scorers
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

  // Separate scorers by team
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden"
    >
      {/* Match info header */}
      <div className="flex items-center justify-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            isFinished
              ? "bg-emerald-500/15 border border-emerald-500/20 text-emerald-400"
              : "bg-white/5 border border-white/10 text-white/50"
          }`}
        >
          {isFinished && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          {status === "finished" ? "Ολοκληρώθηκε" : status === "postponed" ? "Αναβλήθηκε" : "Προγραμματισμένο"}
        </span>
        <span className="text-sm text-white/40">|</span>
        <span className="text-sm font-medium text-white/60">{dateLabel}</span>
        {referee && (
          <>
            <span className="text-sm text-white/40">|</span>
            <span className="text-xs text-white/40">
              Διαιτητής: <span className="text-white/60">{referee}</span>
            </span>
          </>
        )}
      </div>

      {/* Main match display */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-8 md:gap-8 md:px-8 md:py-12">
        {/* Team A */}
        <TeamDisplay
          team={teamA}
          isWinner={!!aIsWinner}
          align="right"
          scorers={[...teamAScorers, ...teamAOwnGoals]}
        />

        {/* Center - VS or Score */}
        <div className="flex flex-col items-center gap-2">
          {isFinished ? (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex items-center gap-2 md:gap-4"
            >
              <ScoreBadge score={scoreA ?? 0} isWinner={!!aIsWinner} />
              <span className="text-2xl font-bold text-white/20 md:text-3xl">:</span>
              <ScoreBadge score={scoreB ?? 0} isWinner={!!bIsWinner} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] md:h-20 md:w-20"
            >
              <span className="text-2xl font-black text-white/30 md:text-3xl">VS</span>
            </motion.div>
          )}
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

function ScoreBadge({ score, isWinner }: { score: number; isWinner: boolean }) {
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-2xl text-4xl font-black tabular-nums transition-all md:h-20 md:w-20 md:text-5xl ${
        isWinner
          ? "bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10"
          : "bg-white/[0.04] text-white/60"
      }`}
    >
      {score}
    </div>
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
      className={`flex flex-col items-center gap-4 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {/* Team Logo */}
      <div className="relative">
        <div
          className={`relative h-20 w-20 overflow-hidden rounded-2xl ring-2 transition-all md:h-28 md:w-28 lg:h-32 lg:w-32 ${
            isWinner
              ? "ring-emerald-400/50 shadow-xl shadow-emerald-500/20"
              : "ring-white/10"
          } bg-zinc-800/60 p-2`}
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
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/20">
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
            className="absolute -right-2 -top-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
              <Trophy className="h-4 w-4 text-white" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Team Name */}
      <div
        className={`max-w-full px-2 text-center text-lg font-bold md:text-xl ${
          isWinner ? "text-emerald-300" : "text-white/80"
        }`}
      >
        {team.name}
      </div>

      {/* Scorers */}
      {scorers.length > 0 && (
        <div className="mt-1 w-full space-y-1 px-2">
          {scorers.map((scorer) => {
            const isOwnGoal = (scorer.ownGoals ?? 0) > 0;
            const goalCount = isOwnGoal ? scorer.ownGoals! : scorer.goals;
            if (goalCount <= 0) return null;

            const playerName =
              `${scorer.player.first_name ?? ""} ${scorer.player.last_name ?? ""}`.trim() || "Άγνωστος";

            return (
              <motion.div
                key={`${scorer.player.id}-${isOwnGoal ? "own" : "goals"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-start gap-1.5"
              >
                <span className="text-xs text-white/60">
                  {playerName}
                  {isOwnGoal && <span className="text-white/40"> (αυτογκόλ)</span>}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: goalCount }).map((_, i) => (
                    <Goal
                      key={i}
                      className={`h-3 w-3 ${
                        isOwnGoal ? "text-white/30" : "text-emerald-400"
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
