"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { PlayerImage, TeamImage } from "@/app/lib/OptimizedImage";
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
};

/**
 * MatchParticipantsShowcase - Elegant sporty participant display
 * Shows player cards with emerald accents for finished matches
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

  const hasParticipants = teamAParticipants.length > 0 || teamBParticipants.length > 0;

  if (!hasParticipants) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Users className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Συμμετέχοντες Αγώνα</h2>
          <p className="text-sm text-white/50">Οι παίκτες που συμμετείχαν στον αγώνα</p>
        </div>
      </div>

      {/* Teams Display */}
      <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-2 lg:gap-12">
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
    </motion.div>
  );
}

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
    <div>
      {/* Team Header */}
      <div className="mb-5 text-center">
        <h3 className="text-xl font-bold text-white">{teamName}</h3>
        <p className="mt-1 text-sm text-emerald-400/70">
          {participants.length} {participants.length === 1 ? "παίκτης" : "παίκτες"}
        </p>
      </div>

      {/* Participants Grid */}
      <div className="flex flex-wrap justify-center gap-4">
        {participants.map((participant, index) => (
          <ParticipantCard
            key={participant.player.id}
            player={participant.player}
            teamLogo={teamLogo}
            index={index}
            playerNumber={participant.playerNumber}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantCard({
  player,
  teamLogo,
  index,
  playerNumber,
}: {
  player: Player;
  teamLogo: string | null;
  index: number;
  playerNumber?: number | null;
}) {
  const firstName = player.first_name || "Άγνωστος";
  const playerName = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || "Άγνωστος";
  const isPlaceholderPhoto = !player.photo || player.photo === "/player-placeholder.jpg";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.05, y: -4 }}
      className="group cursor-pointer"
    >
      <div
        className="relative flex flex-col items-center rounded-xl border border-white/[0.08] bg-zinc-800/50 p-4 transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10"
        style={{ width: "130px" }}
      >
        {/* Avatar */}
        <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-full ring-2 ring-white/10 bg-zinc-700/50 transition-all group-hover:ring-emerald-500/30">
          {!isPlaceholderPhoto ? (
            <PlayerImage
              src={player.photo!}
              alt={playerName}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : teamLogo ? (
            <div className="relative h-full w-full p-2.5">
              <TeamImage
                src={teamLogo}
                alt={`${firstName} team`}
                width={80}
                height={80}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/20">
              {firstName.charAt(0)}
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="text-center">
          <div className="text-sm font-semibold text-white">
            {playerNumber && (
              <span className="text-emerald-400">#{playerNumber} </span>
            )}
            {firstName}
          </div>
          {player.last_name && (
            <div className="text-xs text-white/50">{player.last_name}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
