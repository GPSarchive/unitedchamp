"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { PlayerImage, TeamImage } from "@/app/lib/OptimizedImage";
import { FaFutbol, FaCrown, FaStar, FaHandPaper } from "react-icons/fa";
import { GiGoalKeeper } from "react-icons/gi";
import type { Id } from "@/app/lib/types";

type Player = {
  id: Id;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
};

type Participant = {
  player: Player;
  teamId: Id;
  played: boolean;
  playerNumber?: number | null;
  goals?: number;
  assists?: number;
  ownGoals?: number;
  yellowCards?: number;
  redCards?: number;
  blueCards?: number;
  isCaptain?: boolean;
  isGK?: boolean;
  isMvp?: boolean;
  isBestGk?: boolean;
  position?: string | null;
};

/* ── Small card-shaped icons ── */
function MiniYellowCard() {
  return (
    <span className="block h-[12px] w-[9px] rounded-[1.5px] bg-yellow-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_3px_rgba(0,0,0,0.5)]" />
  );
}
function MiniRedCard() {
  return (
    <span className="block h-[12px] w-[9px] rounded-[1.5px] bg-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.5)]" />
  );
}
function MiniBlueCard() {
  return (
    <span className="block h-[12px] w-[9px] rounded-[1.5px] bg-blue-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.5)]" />
  );
}

/**
 * MatchParticipantsShowcase — Side-by-side player grid with inline mini-stats.
 */
export default function MatchParticipantsShowcase({
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  teamALogo,
  teamBLogo,
  participants,
}: {
  teamAId: Id;
  teamBId: Id;
  teamAName: string;
  teamBName: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  participants: Participant[];
}) {
  const teamAParticipants = participants.filter((p) => p.teamId === teamAId);
  const teamBParticipants = participants.filter((p) => p.teamId === teamBId);

  if (teamAParticipants.length === 0 && teamBParticipants.length === 0) {
    return null;
  }

  return (
    <div className="py-4">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <div className="mb-2 flex items-center justify-center gap-3">
          <Users className="h-7 w-7 text-red-500" />
          <h2
            className="text-3xl font-bold md:text-4xl text-white"
            style={{
              textShadow:
                "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            }}
          >
            Συμμετέχοντες Αγώνα
          </h2>
        </div>
        <p
          className="text-base text-white/70"
          style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.8)" }}
        >
          Οι παίκτες που συμμετείχαν στον αγώνα
        </p>
      </motion.div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {teamAParticipants.length > 0 && (
          <TeamSection
            teamName={teamAName}
            teamLogo={teamALogo}
            participants={teamAParticipants}
          />
        )}
        {teamBParticipants.length > 0 && (
          <TeamSection
            teamName={teamBName}
            teamLogo={teamBLogo}
            participants={teamBParticipants}
          />
        )}
      </div>
    </div>
  );
}

/* ── Team section ── */
function TeamSection({
  teamName,
  teamLogo,
  participants,
}: {
  teamName: string;
  teamLogo: string | null;
  participants: Participant[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
    >
      {/* Team heading */}
      <div className="mb-5 text-center">
        <h3
          className="text-2xl font-bold text-white md:text-3xl"
          style={{
            textShadow:
              "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
          }}
        >
          {teamName}
        </h3>
        <p
          className="mt-1 text-sm text-red-300/80"
          style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
        >
          {participants.length}{" "}
          {participants.length === 1 ? "παίκτης" : "παίκτες"}
        </p>
      </div>

      {/* Player cards grid */}
      <div className="flex flex-wrap justify-center gap-4">
        {participants.map((participant, index) => (
          <ParticipantCard
            key={participant.player.id}
            participant={participant}
            teamLogo={teamLogo}
            index={index}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Individual player card ── */
function ParticipantCard({
  participant,
  teamLogo,
  index,
}: {
  participant: Participant;
  teamLogo: string | null;
  index: number;
}) {
  const { player, playerNumber } = participant;
  const goals = participant.goals ?? 0;
  const assists = participant.assists ?? 0;
  const ownGoals = participant.ownGoals ?? 0;
  const yellowCards = participant.yellowCards ?? 0;
  const redCards = participant.redCards ?? 0;
  const blueCards = participant.blueCards ?? 0;
  const isCaptain = participant.isCaptain ?? false;
  const isGK = participant.isGK ?? false;
  const isMvp = participant.isMvp ?? false;
  const isBestGk = participant.isBestGk ?? false;

  const playerName =
    `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() ||
    "Άγνωστος";
  const firstName = player.first_name || "Άγνωστος";

  const isPlaceholderPhoto =
    !player.photo || player.photo === "/player-placeholder.jpg";

  const hasStats =
    goals > 0 ||
    assists > 0 ||
    ownGoals > 0 ||
    yellowCards > 0 ||
    redCards > 0 ||
    blueCards > 0;

  const hasRoles = isCaptain || isGK || isMvp || isBestGk;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.07,
        duration: 0.45,
        type: "spring",
        stiffness: 220,
      }}
      whileHover={{ scale: 1.06, y: -6 }}
      className="cursor-pointer"
    >
      <div
        className="relative flex flex-col items-center overflow-hidden rounded-2xl border-2 border-white/20 bg-black/40 backdrop-blur-sm transition-shadow hover:shadow-[0_0_28px_rgba(239,68,68,0.4)] hover:border-red-500/50"
        style={{ width: "148px" }}
      >
        {/* Role badges — absolute top-left */}
        {hasRoles && (
          <div className="absolute left-2 top-2 flex flex-col gap-1 z-10">
            {isCaptain && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/90 shadow-md">
                <FaCrown className="text-amber-900 text-[9px]" />
              </span>
            )}
            {isGK && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/90 shadow-md">
                <GiGoalKeeper className="text-white text-[10px]" />
              </span>
            )}
            {isMvp && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/90 shadow-md">
                <FaStar className="text-amber-900 text-[9px]" />
              </span>
            )}
            {isBestGk && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/90 shadow-md">
                <FaHandPaper className="text-white text-[9px]" />
              </span>
            )}
          </div>
        )}

        {/* Avatar */}
        <div className="relative mt-4 mb-2 h-[88px] w-[88px] overflow-hidden rounded-full border-2 border-white/30 bg-gradient-to-br from-slate-700 to-slate-900 shadow-xl">
          {!isPlaceholderPhoto ? (
            <PlayerImage
              src={player.photo!}
              alt={playerName}
              width={88}
              height={88}
              className="block h-full w-full object-cover object-center"
            />
          ) : teamLogo ? (
            <div className="relative h-full w-full p-2.5">
              <TeamImage
                src={teamLogo}
                alt={`${firstName} team logo`}
                width={88}
                height={88}
                className="block h-full w-full object-contain"
              />
            </div>
          ) : null}
        </div>

        {/* Name */}
        <div className="w-full px-2 text-center pb-2">
          <div
            className="text-sm font-bold text-white leading-tight"
            style={{
              textShadow:
                "1px 1px 2px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px 0.5px 0 #000",
            }}
          >
            {playerNumber != null && (
              <span className="text-red-400 text-xs mr-0.5">
                #{playerNumber}{" "}
              </span>
            )}
            {firstName}
          </div>
          {player.last_name && (
            <div
              className="text-xs text-white/70 leading-tight"
              style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
            >
              {player.last_name}
            </div>
          )}
        </div>

        {/* Stats strip — only shown when there are stats */}
        {hasStats && (
          <div className="w-full border-t border-white/10 bg-white/5 px-2 py-2">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {/* Goals */}
              {goals > 0 && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.min(goals, 3) }).map((_, i) => (
                    <FaFutbol key={i} className="text-white text-[11px]" />
                  ))}
                  {goals > 3 && (
                    <span className="text-[10px] font-bold text-white/80">
                      +{goals - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Assists */}
              {assists > 0 && (
                <div className="flex items-center gap-0.5">
                  <svg
                    className="text-sky-400"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span className="text-[10px] font-bold text-sky-400">
                    {assists}
                  </span>
                </div>
              )}

              {/* Own goals */}
              {ownGoals > 0 && (
                <div className="flex items-center gap-0.5">
                  <FaFutbol className="text-orange-400 text-[11px]" />
                  <span className="text-[9px] font-bold text-orange-400 uppercase">
                    og
                  </span>
                </div>
              )}

              {/* Cards */}
              {yellowCards > 0 &&
                Array.from({ length: Math.min(yellowCards, 2) }).map((_, i) => (
                  <MiniYellowCard key={`y${i}`} />
                ))}
              {redCards > 0 && <MiniRedCard />}
              {blueCards > 0 && <MiniBlueCard />}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
