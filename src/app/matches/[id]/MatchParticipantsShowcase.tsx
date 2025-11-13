"use client";

import { motion } from "framer-motion";
import { Users, Star } from "lucide-react";
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
};

/**
 * MatchParticipantsShowcase - Side by side display of match participants
 * Shows player images with gold styling and black outline text
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
    <div className="py-6">
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
              className="text-3xl font-bold md:text-4xl text-white"
              style={{
                textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
              }}
            >
              Συμμετέχοντες Αγώνα
            </h2>
          </div>
          <p
            className="text-lg text-white/80"
            style={{
              textShadow: '1px 1px 3px rgba(0,0,0,0.8)'
            }}
          >
            Οι παίκτες που συμμετείχαν στον αγώνα
          </p>
        </motion.div>

        {/* Teams Display - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Team A */}
          {teamAParticipants.length > 0 && (
            <TeamSection
              teamName={teamAName}
              teamLogo={teamALogo}
              participants={teamAParticipants}
            />
          )}

          {/* Team B */}
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
      transition={{ duration: 0.6 }}
    >
      {/* Team Name */}
      <div className="mb-6 text-center">
        <h3
          className="text-2xl font-bold text-white md:text-3xl"
          style={{
            textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
          }}
        >
          {teamName}
        </h3>
        <p
          className="mt-1 text-sm text-red-300/90"
          style={{
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          {participants.length} {participants.length === 1 ? "παίκτης" : "παίκτες"}
        </p>
      </div>

      {/* Participants Grid */}
      <div className="flex flex-wrap justify-center gap-6">
        {participants.map((participant, index) => (
          <ParticipantCard
            key={participant.player.id}
            player={participant.player}
            teamLogo={teamLogo}
            index={index}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ParticipantCard({
  player,
  teamLogo,
  index,
}: {
  player: Player;
  teamLogo: string | null;
  index: number;
}) {
  const playerName =
    `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || "Άγνωστος";
  const firstName = player.first_name || "Άγνωστος";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        type: "spring",
        stiffness: 200,
      }}
      whileHover={{ scale: 1.08, y: -8 }}
      className="group cursor-pointer"
    >
      <div
        className="relative flex flex-col items-center overflow-hidden rounded-2xl border-2 border-white/30 bg-black/40 p-4 backdrop-blur-sm transition-all hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] hover:border-red-500/60"
        style={{ width: "140px" }}
      >
        {/* Player Photo or Team Logo */}
        <div className="relative mb-3 h-24 w-24 overflow-hidden rounded-full border-3 border-white/40 bg-gradient-to-br from-slate-700 to-slate-800 shadow-xl">
          {player.photo ? (
            <PlayerImage
              src={player.photo}
              alt={playerName}
              width={96}
              height={96}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : teamLogo ? (
            <div className="relative h-full w-full p-3">
              <TeamImage
                src={teamLogo}
                alt={`${firstName} team logo`}
                fill
                objectFit="contain"
                sizes="96px"
                className="transition-transform duration-300 group-hover:scale-110"
              />
            </div>
          ) : null}

          {/* Hover glow effect */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-red-500/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
          />
        </div>

        {/* Player Name - Centered */}
        <div className="text-center">
          <div
            className="mb-1 text-sm font-bold text-white"
            style={{
              textShadow: '1px 1px 2px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000'
            }}
          >
            {firstName}
          </div>
          {player.last_name && (
            <div
              className="text-xs text-white/80"
              style={{
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {player.last_name}
            </div>
          )}
        </div>
          {/* Decorative star on hover */}

        {/* Decorative star on hover */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          whileHover={{ opacity: 1, scale: 1 }}
          className="absolute right-2 top-2"
        >
          <Star className="h-4 w-4 text-red-500" />
        </motion.div>
      </div>
    </motion.div>
  );
}