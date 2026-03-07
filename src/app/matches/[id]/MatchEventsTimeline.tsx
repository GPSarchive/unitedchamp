"use client";

import { motion } from "framer-motion";
import { PlayerImage, TeamImage } from "@/app/lib/OptimizedImage";
import type { Id, MatchPlayerStatRow } from "@/app/lib/types";
import {
  GoalIcon,
  AssistIcon,
  OwnGoalIcon,
  YellowCardIcon,
  RedCardIcon,
  BlueCardIcon,
  MvpIcon,
  BestGkIcon,
  CaptainIcon,
  GkIcon,
} from "./StatIcons";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type Player = {
  id: Id;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
};

type ParticipantWithStats = {
  player: Player;
  teamId: Id;
  played: boolean;
  stats: MatchPlayerStatRow | null;
  playerNumber?: number | null;
};

type StatEvent = {
  type:
    | "goal"
    | "assist"
    | "own_goal"
    | "yellow_card"
    | "red_card"
    | "blue_card"
    | "mvp"
    | "best_gk"
    | "captain"
    | "gk";
  count: number;
};

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */

function getPlayerEvents(stats: MatchPlayerStatRow | null): StatEvent[] {
  if (!stats) return [];
  const events: StatEvent[] = [];

  if (stats.goals > 0) events.push({ type: "goal", count: stats.goals });
  if (stats.assists > 0) events.push({ type: "assist", count: stats.assists });
  if (stats.own_goals > 0)
    events.push({ type: "own_goal", count: stats.own_goals });
  if (stats.mvp) events.push({ type: "mvp", count: 1 });
  if (stats.best_goalkeeper) events.push({ type: "best_gk", count: 1 });
  if (stats.is_captain) events.push({ type: "captain", count: 1 });
  if (stats.gk) events.push({ type: "gk", count: 1 });
  if (stats.yellow_cards > 0)
    events.push({ type: "yellow_card", count: stats.yellow_cards });
  if (stats.red_cards > 0)
    events.push({ type: "red_card", count: stats.red_cards });
  if (stats.blue_cards > 0)
    events.push({ type: "blue_card", count: stats.blue_cards });

  return events;
}

const EVENT_META: Record<
  StatEvent["type"],
  { icon: React.FC<{ className?: string }>; label: string; color: string }
> = {
  goal: { icon: GoalIcon, label: "Γκολ", color: "text-amber-400" },
  assist: { icon: AssistIcon, label: "Ασίστ", color: "text-sky-400" },
  own_goal: { icon: OwnGoalIcon, label: "Αυτογκόλ", color: "text-orange-400" },
  yellow_card: {
    icon: YellowCardIcon,
    label: "Κίτρινη",
    color: "text-yellow-400",
  },
  red_card: { icon: RedCardIcon, label: "Κόκκινη", color: "text-red-400" },
  blue_card: { icon: BlueCardIcon, label: "Μπλε", color: "text-blue-400" },
  mvp: { icon: MvpIcon, label: "MVP", color: "text-amber-300" },
  best_gk: { icon: BestGkIcon, label: "Best GK", color: "text-emerald-400" },
  captain: { icon: CaptainIcon, label: "Αρχηγός", color: "text-amber-500" },
  gk: { icon: GkIcon, label: "Τερματοφύλακας", color: "text-indigo-400" },
};

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function EventBadge({ event }: { event: StatEvent }) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 backdrop-blur-sm"
      title={meta.label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={`text-xs font-semibold ${meta.color}`}>
        {event.count > 1 ? `×${event.count}` : meta.label}
      </span>
    </div>
  );
}

function PlayerEventCard({
  participant,
  teamLogo,
  index,
}: {
  participant: ParticipantWithStats;
  teamLogo: string | null;
  index: number;
}) {
  const { player, stats, playerNumber } = participant;
  const events = getPlayerEvents(stats);
  const playerName =
    `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || "Άγνωστος";
  const isPlaceholderPhoto =
    !player.photo || player.photo === "/player-placeholder.jpg";

  const hasEvents = events.length > 0;
  const position = stats?.position ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.4,
        ease: "easeOut",
      }}
      className="group"
    >
      <div
        className={`relative flex items-center gap-4 rounded-xl border p-3 transition-all duration-200 ${
          hasEvents
            ? "border-white/15 bg-white/[0.06] hover:bg-white/[0.1] hover:border-white/25"
            : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
        }`}
      >
        {/* Player avatar */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/20 bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg">
          {!isPlaceholderPhoto ? (
            <PlayerImage
              src={player.photo!}
              alt={playerName}
              width={48}
              height={48}
              className="h-full w-full object-cover object-center"
            />
          ) : teamLogo ? (
            <div className="relative h-full w-full p-1.5">
              <TeamImage
                src={teamLogo}
                alt="team"
                width={48}
                height={48}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white/60">
              {(player.first_name?.[0] ?? "") + (player.last_name?.[0] ?? "")}
            </div>
          )}
        </div>

        {/* Name + position + number */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {playerNumber && (
              <span className="text-xs font-bold text-white/40">
                #{playerNumber}
              </span>
            )}
            <span
              className="truncate text-sm font-semibold text-white"
              style={{
                textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
              }}
            >
              {playerName}
            </span>
            {position && (
              <span className="hidden text-xs text-white/40 sm:inline">
                {position}
              </span>
            )}
          </div>

          {/* Event badges */}
          {hasEvents && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {events.map((event, i) => (
                <EventBadge key={`${event.type}-${i}`} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Team section
   ──────────────────────────────────────────────────────────── */

function TeamEventsSection({
  teamName,
  teamLogo,
  participants,
}: {
  teamName: string;
  teamLogo: string | null;
  participants: ParticipantWithStats[];
}) {
  // Sort: players with events first (more events = higher), then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const aEvents = getPlayerEvents(a.stats).length;
    const bEvents = getPlayerEvents(b.stats).length;
    if (aEvents !== bEvents) return bEvents - aEvents;
    const aName = `${a.player.first_name} ${a.player.last_name}`;
    const bName = `${b.player.first_name} ${b.player.last_name}`;
    return aName.localeCompare(bName);
  });

  return (
    <div>
      {/* Team header */}
      <div className="mb-4 flex items-center gap-3">
        {teamLogo && (
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
            <TeamImage
              src={teamLogo}
              alt={teamName}
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <h3
          className="text-lg font-bold text-white"
          style={{
            textShadow:
              "1px 1px 3px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000",
          }}
        >
          {teamName}
        </h3>
        <span className="text-xs text-white/40">
          {sorted.length}{" "}
          {sorted.length === 1 ? "παίκτης" : "παίκτες"}
        </span>
      </div>

      {/* Player cards list */}
      <div className="space-y-2">
        {sorted.map((participant, index) => (
          <PlayerEventCard
            key={participant.player.id}
            participant={participant}
            teamLogo={teamLogo}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────────────────────── */

export default function MatchEventsTimeline({
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
  participants: ParticipantWithStats[];
}) {
  const teamAParticipants = participants.filter((p) => p.teamId === teamAId);
  const teamBParticipants = participants.filter((p) => p.teamId === teamBId);

  if (teamAParticipants.length === 0 && teamBParticipants.length === 0) {
    return null;
  }

  // Count total events for the summary bar
  const allEvents = participants.flatMap((p) => getPlayerEvents(p.stats));
  const totalGoals = allEvents
    .filter((e) => e.type === "goal")
    .reduce((sum, e) => sum + e.count, 0);
  const totalAssists = allEvents
    .filter((e) => e.type === "assist")
    .reduce((sum, e) => sum + e.count, 0);
  const totalCards = allEvents
    .filter((e) =>
      ["yellow_card", "red_card", "blue_card"].includes(e.type)
    )
    .reduce((sum, e) => sum + e.count, 0);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/10 bg-black/40 p-5 shadow-2xl backdrop-blur-md md:p-8"
    >
      {/* Section header */}
      <div className="mb-6">
        <h2
          className="text-2xl font-bold text-white md:text-3xl"
          style={{
            textShadow:
              "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000",
          }}
        >
          Στατιστικά Αγώνα
        </h2>

        {/* Quick summary bar */}
        <div className="mt-3 flex flex-wrap gap-3">
          {totalGoals > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
              <GoalIcon className="h-4 w-4" />
              <span className="text-xs font-semibold text-amber-300">
                {totalGoals} {totalGoals === 1 ? "γκολ" : "γκολ"}
              </span>
            </div>
          )}
          {totalAssists > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1">
              <AssistIcon className="h-4 w-4" />
              <span className="text-xs font-semibold text-sky-300">
                {totalAssists} {totalAssists === 1 ? "ασίστ" : "ασίστ"}
              </span>
            </div>
          )}
          {totalCards > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">
              <YellowCardIcon className="h-4 w-4" />
              <span className="text-xs font-semibold text-yellow-300">
                {totalCards} {totalCards === 1 ? "κάρτα" : "κάρτες"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-6 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {/* Two-column team layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        {teamAParticipants.length > 0 && (
          <TeamEventsSection
            teamName={teamAName}
            teamLogo={teamALogo}
            participants={teamAParticipants}
          />
        )}
        {teamBParticipants.length > 0 && (
          <TeamEventsSection
            teamName={teamBName}
            teamLogo={teamBLogo}
            participants={teamBParticipants}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-8 border-t border-white/8 pt-4">
        <div className="flex flex-wrap justify-center gap-3">
          {(
            [
              "goal",
              "assist",
              "own_goal",
              "yellow_card",
              "red_card",
              "blue_card",
              "mvp",
              "best_gk",
              "captain",
              "gk",
            ] as const
          ).map((type) => {
            const meta = EVENT_META[type];
            const Icon = meta.icon;
            return (
              <div
                key={type}
                className="flex items-center gap-1 text-white/40"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px]">{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
