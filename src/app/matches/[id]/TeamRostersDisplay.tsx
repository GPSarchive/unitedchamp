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

type RosterPlayer = {
  player: Player;
  teamId: Id;
};

/**
 * TeamRostersDisplay - Full team rosters for scheduled matches
 * Sports-premium styling with amber accents
 */
export default function TeamRostersDisplay({
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  teamALogo,
  teamBLogo,
  rosterPlayers,
}: {
  teamAId: Id;
  teamBId: Id;
  teamAName: string;
  teamBName: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  rosterPlayers: RosterPlayer[];
}) {
  const teamARoster = rosterPlayers.filter((p) => p.teamId === teamAId);
  const teamBRoster = rosterPlayers.filter((p) => p.teamId === teamBId);

  const hasRoster = teamARoster.length > 0 || teamBRoster.length > 0;

  if (!hasRoster) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden"
      data-testid="team-rosters"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-center gap-3">
          <Users className="h-6 w-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Ρόστερ Ομάδων</h2>
        </div>
        <p className="text-center text-sm text-white/50 mt-1">
          Τα ρόστερ των ομάδων που θα αγωνιστούν
        </p>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        {/* Team A */}
        {teamARoster.length > 0 && (
          <TeamSection
            teamName={teamAName}
            teamLogo={teamALogo}
            roster={teamARoster}
          />
        )}

        {/* Team B */}
        {teamBRoster.length > 0 && (
          <TeamSection
            teamName={teamBName}
            teamLogo={teamBLogo}
            roster={teamBRoster}
          />
        )}
      </div>
    </motion.div>
  );
}

function TeamSection({
  teamName,
  teamLogo,
  roster,
}: {
  teamName: string;
  teamLogo: string | null;
  roster: RosterPlayer[];
}) {
  return (
    <div className="p-6">
      {/* Team Header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {teamLogo && (
          <div className="relative h-10 w-10 shrink-0">
            <TeamImage
              src={teamLogo}
              alt={teamName}
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <div className="text-center">
          <h3 className="text-lg font-bold text-white">{teamName}</h3>
          <p className="text-xs text-amber-400/80 font-mono">
            {roster.length} {roster.length === 1 ? "παίκτης" : "παίκτες"}
          </p>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="flex flex-wrap justify-center gap-4">
        {roster.map((rosterPlayer, index) => (
          <RosterPlayerCard
            key={rosterPlayer.player.id}
            player={rosterPlayer.player}
            teamLogo={teamLogo}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

function RosterPlayerCard({
  player,
  teamLogo,
  index,
}: {
  player: Player;
  teamLogo: string | null;
  index: number;
}) {
  const firstName = player.first_name || "Άγνωστος";
  const lastName = player.last_name || "";
  const isPlaceholderPhoto = !player.photo || player.photo === "/player-placeholder.jpg";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
        type: "spring",
        stiffness: 200,
      }}
      whileHover={{ y: -6, scale: 1.03 }}
      className="cursor-pointer"
    >
      <div className="relative flex flex-col items-center p-4 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-amber-400/30 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)] transition-all w-[120px]">
        {/* Avatar */}
        <div className="relative mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-white/20 bg-black/50">
          {!isPlaceholderPhoto ? (
            <PlayerImage
              src={player.photo!}
              alt={`${firstName} ${lastName}`}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : teamLogo ? (
            <div className="relative h-full w-full p-2">
              <TeamImage
                src={teamLogo}
                alt={firstName}
                fill
                objectFit="contain"
                sizes="64px"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-amber-400/60">
              {firstName.charAt(0)}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <p className="text-sm font-medium text-white leading-tight">{firstName}</p>
          {lastName && (
            <p className="text-xs text-white/50 leading-tight">{lastName}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
