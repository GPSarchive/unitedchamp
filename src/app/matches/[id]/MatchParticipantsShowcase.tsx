"use client";

import { motion } from "framer-motion";
import { PlayerImage, TeamImage } from "@/app/lib/OptimizedImage";
import {
  SoccerBall,
  YellowCard,
  RedCard,
  BlueCard,
  AssistIcon,
  CaptainIcon,
  GoalkeeperIcon,
  MvpIcon,
  OwnGoalIcon,
} from "@/app/lib/MatchIcons";
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
  // Stats from stats editor
  goals?: number;
  assists?: number;
  ownGoals?: number;
  yellowCards?: number;
  redCards?: number;
  blueCards?: number;
  isCaptain?: boolean;
  isGK?: boolean;
  isMvp?: boolean;
  isBestGK?: boolean;
  position?: string | null;
};

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
    <section className="space-y-8">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <SoccerBall className="h-7 w-7 text-emerald-400 shrink-0" />
        <h2
          className="text-2xl font-bold text-white md:text-3xl"
          style={{
            textShadow:
              "2px 2px 6px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
          }}
        >
          Συμμετέχοντες Αγώνα
        </h2>
        <span className="ml-auto text-sm text-white/50">
          {participants.length} παίκτες
        </span>
      </motion.div>

      {/* Side-by-side team columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {teamAParticipants.length > 0 && (
          <TeamColumn
            teamName={teamAName}
            teamLogo={teamALogo}
            participants={teamAParticipants}
            accent="left"
          />
        )}
        {teamBParticipants.length > 0 && (
          <TeamColumn
            teamName={teamBName}
            teamLogo={teamBLogo}
            participants={teamBParticipants}
            accent="right"
          />
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  Team column                                            */
/* ─────────────────────────────────────────────────────── */

function TeamColumn({
  teamName,
  teamLogo,
  participants,
  accent,
}: {
  teamName: string;
  teamLogo: string | null;
  participants: Participant[];
  accent: "left" | "right";
}) {
  const accentColor =
    accent === "left"
      ? "from-emerald-500/20 to-transparent border-emerald-500/30"
      : "from-sky-500/20 to-transparent border-sky-500/30";
  const dotColor = accent === "left" ? "bg-emerald-400" : "bg-sky-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: accent === "right" ? 0.1 : 0 }}
      className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden"
    >
      {/* Team header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${accentColor} border-b border-white/10`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
        {teamLogo && (
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black/60 p-1 ring-1 ring-white/20">
            <TeamImage
              src={teamLogo}
              alt={teamName}
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <span className="font-bold text-white text-base">{teamName}</span>
        <span className="ml-auto text-xs text-white/50">
          {participants.length}{" "}
          {participants.length === 1 ? "παίκτης" : "παίκτες"}
        </span>
      </div>

      {/* Player rows */}
      <ul className="divide-y divide-white/6">
        {participants.map((p, i) => (
          <PlayerRow key={p.player.id} participant={p} index={i} teamLogo={teamLogo} />
        ))}
      </ul>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  Individual player row                                  */
/* ─────────────────────────────────────────────────────── */

function PlayerRow({
  participant: p,
  index,
  teamLogo,
}: {
  participant: Participant;
  index: number;
  teamLogo: string | null;
}) {
  const name =
    `${p.player.first_name ?? ""} ${p.player.last_name ?? ""}`.trim() ||
    "Άγνωστος";
  const hasPhoto =
    p.player.photo && p.player.photo !== "/player-placeholder.jpg";

  const goals = p.goals ?? 0;
  const assists = p.assists ?? 0;
  const ownGoals = p.ownGoals ?? 0;
  const yellow = p.yellowCards ?? 0;
  const red = p.redCards ?? 0;
  const blue = p.blueCards ?? 0;

  const hasStats =
    goals > 0 ||
    assists > 0 ||
    ownGoals > 0 ||
    yellow > 0 ||
    red > 0 ||
    blue > 0;

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
    >
      {/* Avatar */}
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-black/60 ring-1 ring-white/15">
        {hasPhoto ? (
          <PlayerImage
            src={p.player.photo!}
            alt={name}
            width={44}
            height={44}
            className="h-full w-full object-cover object-top"
          />
        ) : teamLogo ? (
          <div className="relative h-full w-full p-1.5">
            <TeamImage
              src={teamLogo}
              alt={name}
              width={44}
              height={44}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="grid h-full w-full place-items-center text-sm font-bold text-white/60">
            {(p.player.first_name?.[0] ?? "") + (p.player.last_name?.[0] ?? "")}
          </div>
        )}
        {/* Player number overlay */}
        {p.playerNumber != null && (
          <div className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl-md bg-black/80 text-[9px] font-bold text-white">
            {p.playerNumber}
          </div>
        )}
      </div>

      {/* Name + badges + stats */}
      <div className="min-w-0 flex-1">
        {/* Top row: name + role badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-white text-sm leading-tight truncate">
            {name}
          </span>
          {p.position && (
            <span className="rounded px-1.5 py-0.5 bg-white/10 text-white/70 text-[10px] font-medium uppercase tracking-wide">
              {p.position}
            </span>
          )}
          {p.isCaptain && (
            <span
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-semibold"
              title="Αρχηγός"
            >
              <CaptainIcon className="h-3 w-3" />
              Αρχηγός
            </span>
          )}
          {p.isGK && (
            <span
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold"
              title="Τερματοφύλακας"
            >
              <GoalkeeperIcon className="h-3 w-3" />
              GK
            </span>
          )}
          {p.isBestGK && (
            <span
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-semibold"
              title="Καλύτερος Τερματοφύλακας"
            >
              <GoalkeeperIcon className="h-3 w-3" />
              Best GK
            </span>
          )}
          {p.isMvp && (
            <span
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-400/30 text-yellow-300 text-[10px] font-semibold"
              title="MVP"
            >
              <MvpIcon className="h-3 w-3" />
              MVP
            </span>
          )}
        </div>

        {/* Stats row */}
        {hasStats && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {goals > 0 && (
              <StatChip
                icon={<SoccerBall className="h-3.5 w-3.5" />}
                value={goals}
                color="text-white"
                label={goals === 1 ? "γκολ" : "γκολ"}
              />
            )}
            {ownGoals > 0 && (
              <StatChip
                icon={<OwnGoalIcon className="h-3.5 w-3.5" />}
                value={ownGoals}
                color="text-orange-400"
                label="αυτ."
              />
            )}
            {assists > 0 && (
              <StatChip
                icon={<AssistIcon className="h-3.5 w-3.5" />}
                value={assists}
                color="text-sky-400"
                label={assists === 1 ? "ασίστ" : "ασίστ"}
              />
            )}
            {yellow > 0 && (
              <StatChip
                icon={<YellowCard className="h-4 w-3" />}
                value={yellow}
                color="text-yellow-300"
                label=""
              />
            )}
            {red > 0 && (
              <StatChip
                icon={<RedCard className="h-4 w-3" />}
                value={red}
                color="text-red-400"
                label=""
              />
            )}
            {blue > 0 && (
              <StatChip
                icon={<BlueCard className="h-4 w-3" />}
                value={blue}
                color="text-blue-400"
                label=""
              />
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  Stat chip                                              */
/* ─────────────────────────────────────────────────────── */

function StatChip({
  icon,
  value,
  color,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  color: string;
  label: string;
}) {
  return (
    <span
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-white/8 border border-white/10 text-xs font-medium ${color}`}
    >
      {icon}
      <span>{value}</span>
      {label && <span className="text-white/50">{label}</span>}
    </span>
  );
}
