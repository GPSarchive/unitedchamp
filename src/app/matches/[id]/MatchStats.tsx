// src/app/matches/[id]/MatchStats.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";
import GlossOverlay from "@/app/paiktes/GlossOverlay";
import { PlayerImage } from "@/app/lib/OptimizedImage";

/* ────────────────────────────────────────────────────────────
   Premium SVG Icon Components
   ──────────────────────────────────────────────────────────── */

/** Classic football / soccer ball */
function SoccerBallIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* White fill */}
      <circle cx="16" cy="16" r="14.5" fill="white" />
      {/* Black pentagon pattern */}
      <path
        d="M16 4.5 L19.8 10.5 L26.5 10.5 L23.5 16 L26.5 21.5 L19.8 21.5 L16 27.5 L12.2 21.5 L5.5 21.5 L8.5 16 L5.5 10.5 L12.2 10.5 Z"
        fill="#1a1a1a"
      />
      {/* Outer ring */}
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="#444" strokeWidth="1" />
    </svg>
  );
}

/** Match-style football card (yellow / red / blue) */
function FootballCard({
  color,
  className = "w-4 h-5",
}: {
  color: "yellow" | "red" | "blue";
  className?: string;
}) {
  const map = {
    yellow: { fill: "#F59E0B", stroke: "#92400E", inner: "#FCD34D" },
    red: { fill: "#EF4444", stroke: "#7F1D1D", inner: "#FCA5A5" },
    blue: { fill: "#3B82F6", stroke: "#1E3A8A", inner: "#93C5FD" },
  };
  const c = map[color];
  return (
    <svg className={className} viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow effect */}
      <rect x="2.5" y="2" width="12" height="18" rx="2.5" fill="rgba(0,0,0,0.25)" />
      {/* Card body */}
      <rect x="1" y="0.5" width="12" height="18" rx="2.5" fill={c.fill} stroke={c.stroke} strokeWidth="1" />
      {/* Sheen highlight */}
      <path d="M3 1.5 Q4 1 5 1.5 L5 3 Q4 2.5 3 3 Z" fill={c.inner} opacity="0.6" />
    </svg>
  );
}

/** Stylised assist "A" with underline */
function AssistIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="15"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        fill="currentColor"
      >
        A
      </text>
      <line x1="4" y1="21" x2="20" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Own-goal: ball with red X */
function OwnGoalIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14.5" fill="white" />
      <path
        d="M16 4.5 L19.8 10.5 L26.5 10.5 L23.5 16 L26.5 21.5 L19.8 21.5 L16 27.5 L12.2 21.5 L5.5 21.5 L8.5 16 L5.5 10.5 L12.2 10.5 Z"
        fill="#ddd"
      />
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="#aaa" strokeWidth="1" />
      {/* Red X overlay */}
      <line x1="8" y1="8" x2="24" y2="24" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
      <line x1="24" y1="8" x2="8" y2="24" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** MVP 5-point star */
function StarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z" />
    </svg>
  );
}

/** Goalkeeper glove */
function GloveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.5 9H16V6a1.5 1.5 0 0 0-3 0v3h-1V4a1.5 1.5 0 0 0-3 0v5H8V7a1.5 1.5 0 0 0-3 0v6a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-2.5A1.5 1.5 0 0 0 18.5 9H17.5Z" />
    </svg>
  );
}

/** Captain "C" circle badge */
function CaptainIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      {/* Bold C letter */}
      <path
        d="M15 9.5 A5 5 0 1 0 15 14.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   Stat chip: icon + count (hides when value is 0)
   ──────────────────────────────────────────────────────────── */

function StatChip({
  icon,
  value,
  label,
  colorClass,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  colorClass: string;
}) {
  if (value <= 0) return null;
  return (
    <div
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${colorClass}`}
      title={`${label}: ${value}`}
    >
      {icon}
      <span>{value}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Role badge: small pill
   ──────────────────────────────────────────────────────────── */

function RoleBadge({
  icon,
  label,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  colorClass: string;
}) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colorClass}`}
      title={label}
    >
      {icon}
      {label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────
   Helper
   ──────────────────────────────────────────────────────────── */

function sameTeam(a: unknown, b: unknown) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/* ────────────────────────────────────────────────────────────
   Player Card – photo + stats
   ──────────────────────────────────────────────────────────── */

function PlayerStatCard({
  player,
  part,
  row,
  index,
}: {
  player: { id: Id; first_name: string; last_name: string; photo: string };
  part: ParticipantRow | null;
  row: MatchPlayerStatRow | null;
  index: number;
}) {
  const name = `${player.first_name} ${player.last_name}`.trim();
  const firstName = player.first_name || name;
  const imgSrc =
    player.photo && player.photo !== "/player-placeholder.jpg"
      ? player.photo
      : null;
  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`.toUpperCase();

  const pos = row?.position ?? part?.position ?? null;
  const number = row?.player_number ?? null;
  const isCaptain = !!(row?.is_captain ?? part?.is_captain);
  const isGK = !!(row?.gk ?? part?.gk);
  const isMvp = !!row?.mvp;
  const isBestGk = !!row?.best_goalkeeper;

  const goals = row?.goals ?? 0;
  const assists = row?.assists ?? 0;
  const ownGoals = row?.own_goals ?? 0;
  const yellow = row?.yellow_cards ?? 0;
  const red = row?.red_cards ?? 0;
  const blue = row?.blue_cards ?? 0;

  const hasStats = goals > 0 || assists > 0 || ownGoals > 0 || yellow > 0 || red > 0 || blue > 0;
  const hasRoles = isCaptain || isGK || isMvp || isBestGk;

  /** Gold border for MVP, dark red for red card, teal for best GK */
  const borderStyle = isMvp
    ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.45)]"
    : red > 0
    ? "border-red-600/60"
    : "border-white/25";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.45, type: "spring", stiffness: 180 }}
      whileHover={{ y: -6, scale: 1.04 }}
      className="cursor-default"
    >
      <div
        className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 bg-black/50 p-4 backdrop-blur-sm transition-all duration-300 hover:bg-black/65 hover:shadow-xl ${borderStyle}`}
        style={{ minWidth: 140, maxWidth: 164 }}
      >
        {/* Player number badge – top left */}
        {number != null && (
          <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-white border border-white/20">
            {number}
          </div>
        )}

        {/* MVP crown – top right */}
        {isMvp && (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-amber-400/20 p-1 border border-amber-400/40">
            <StarIcon className="w-3.5 h-3.5 text-amber-300" />
          </div>
        )}
        {isBestGk && !isMvp && (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-teal-400/20 p-1 border border-teal-400/40">
            <GloveIcon className="w-3.5 h-3.5 text-teal-300" />
          </div>
        )}

        {/* ── Photo circle ── */}
        <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/30 bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg flex-shrink-0">
          {imgSrc ? (
            <>
              <PlayerImage
                src={imgSrc}
                alt={name}
                width={96}
                height={96}
                className="block h-full w-full object-cover object-top"
              />
              <GlossOverlay
                src={imgSrc}
                maskSrc={imgSrc}
                run
                disableIfOpaque={false}
                intensity={0.8}
                angle={20}
                thickness={100}
                duration={3.5}
              />
            </>
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl font-black text-white/60">
              {initials}
            </div>
          )}
        </div>

        {/* ── Name ── */}
        <div className="text-center leading-tight">
          <div
            className="text-sm font-bold text-white"
            style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.9)" }}
          >
            {firstName}
          </div>
          {player.last_name && (
            <div className="text-[11px] text-white/70 font-medium">
              {player.last_name}
            </div>
          )}
          {pos && (
            <div className="mt-0.5 text-[10px] text-white/50 uppercase tracking-widest">
              {pos}
            </div>
          )}
        </div>

        {/* ── Role badges ── */}
        {hasRoles && (
          <div className="flex flex-wrap justify-center gap-1">
            {isCaptain && (
              <RoleBadge
                icon={<CaptainIcon className="w-3 h-3" />}
                label="Αρχηγός"
                colorClass="bg-amber-500/20 text-amber-300 border border-amber-400/30"
              />
            )}
            {isGK && !isBestGk && (
              <RoleBadge
                icon={<GloveIcon className="w-3 h-3" />}
                label="GK"
                colorClass="bg-teal-500/20 text-teal-300 border border-teal-400/30"
              />
            )}
            {isMvp && (
              <RoleBadge
                icon={<StarIcon className="w-3 h-3" />}
                label="MVP"
                colorClass="bg-amber-400/20 text-amber-200 border border-amber-300/30"
              />
            )}
            {isBestGk && (
              <RoleBadge
                icon={<GloveIcon className="w-3 h-3" />}
                label="Best GK"
                colorClass="bg-teal-400/20 text-teal-200 border border-teal-300/30"
              />
            )}
          </div>
        )}

        {/* ── Stat chips ── */}
        {hasStats && (
          <div className="flex flex-wrap justify-center gap-1.5 border-t border-white/10 pt-2.5 w-full">
            <StatChip
              icon={<SoccerBallIcon className="w-3.5 h-3.5" />}
              value={goals}
              label="Γκόλ"
              colorClass="bg-white/10 text-white border border-white/15"
            />
            <StatChip
              icon={<AssistIcon className="w-3.5 h-3.5" />}
              value={assists}
              label="Ασίστ"
              colorClass="bg-sky-500/20 text-sky-300 border border-sky-400/20"
            />
            <StatChip
              icon={<OwnGoalIcon className="w-3.5 h-3.5" />}
              value={ownGoals}
              label="Αυτογκόλ"
              colorClass="bg-orange-500/20 text-orange-300 border border-orange-400/20"
            />
            <StatChip
              icon={<FootballCard color="yellow" className="w-3 h-4" />}
              value={yellow}
              label="Κίτρινη Κάρτα"
              colorClass="bg-yellow-500/20 text-yellow-200 border border-yellow-400/20"
            />
            <StatChip
              icon={<FootballCard color="red" className="w-3 h-4" />}
              value={red}
              label="Κόκκινη Κάρτα"
              colorClass="bg-red-500/20 text-red-300 border border-red-400/20"
            />
            <StatChip
              icon={<FootballCard color="blue" className="w-3 h-4" />}
              value={blue}
              label="Μπλε Κάρτα"
              colorClass="bg-blue-500/20 text-blue-300 border border-blue-400/20"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Team panel – header + player card grid
   ──────────────────────────────────────────────────────────── */

function TeamPanel({
  teamId,
  teamName,
  teamLogo,
  associations,
  participants,
  statsByPlayer,
  align,
}: {
  teamId: Id;
  teamName: string;
  teamLogo?: string | null;
  associations: PlayerAssociation[];
  participants: Map<number, ParticipantRow>;
  statsByPlayer: Map<number, MatchPlayerStatRow>;
  align: "left" | "right";
}) {
  const played = associations.filter((a) => {
    const part = participants.get(a.player.id) ?? null;
    const row = statsByPlayer.get(a.player.id) ?? null;
    const byPart = !!(part?.played && sameTeam(part.team_id, teamId));
    const byStats = !!(row && sameTeam(row.team_id, teamId));
    return byPart || byStats;
  });

  return (
    <div>
      {/* Team header */}
      <motion.div
        initial={{ opacity: 0, x: align === "left" ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className={`mb-6 flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {teamLogo && (
          <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/20 bg-black/40 p-1 flex-shrink-0">
            {/* TeamImage can't be used client-side easily so use img */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={teamLogo}
              alt={teamName}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <div className={align === "right" ? "text-right" : "text-left"}>
          <h3
            className="text-xl font-black text-white md:text-2xl"
            style={{ textShadow: "1px 1px 4px rgba(0,0,0,0.9)" }}
          >
            {teamName}
          </h3>
          <p className="text-sm text-white/50">
            {played.length} {played.length === 1 ? "παίκτης" : "παίκτες"}
          </p>
        </div>
      </motion.div>

      {/* Players grid */}
      {played.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/40">
          Δεν υπάρχουν συμμετέχοντες
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
          {played.map(({ player }, i) => {
            const part = participants.get(player.id) ?? null;
            const row = statsByPlayer.get(player.id) ?? null;
            return (
              <PlayerStatCard
                key={player.id}
                player={{
                  id: player.id,
                  first_name: player.first_name ?? "",
                  last_name: player.last_name ?? "",
                  photo: (player as any).photo ?? "",
                }}
                part={part}
                row={row}
                index={i}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Legend row – icon key for the stat chips
   ──────────────────────────────────────────────────────────── */

function StatsLegend() {
  const items = [
    { icon: <SoccerBallIcon className="w-4 h-4" />, label: "Γκόλ" },
    { icon: <AssistIcon className="w-4 h-4 text-sky-300" />, label: "Ασίστ" },
    { icon: <OwnGoalIcon className="w-4 h-4" />, label: "Αυτογκόλ" },
    { icon: <FootballCard color="yellow" className="w-3.5 h-4.5" />, label: "Κίτρινη" },
    { icon: <FootballCard color="red" className="w-3.5 h-4.5" />, label: "Κόκκινη" },
    { icon: <FootballCard color="blue" className="w-3.5 h-4.5" />, label: "Μπλε" },
    { icon: <StarIcon className="w-4 h-4 text-amber-300" />, label: "MVP" },
    { icon: <GloveIcon className="w-4 h-4 text-teal-300" />, label: "Best GK" },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      {items.map(({ icon, label }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs text-white/60">
          {icon}
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Root export – Match Participants & Stats
   ──────────────────────────────────────────────────────────── */

export default function ParticipantsStats({
  teamA,
  teamB,
  teamALogo,
  teamBLogo,
  associationsA,
  associationsB,
  statsByPlayer,
  participants,
  className,
}: {
  teamA: { id: Id; name: string };
  teamB: { id: Id; name: string };
  teamALogo?: string | null;
  teamBLogo?: string | null;
  associationsA: PlayerAssociation[];
  associationsB: PlayerAssociation[];
  statsByPlayer: Map<number, MatchPlayerStatRow>;
  participants: Map<number, ParticipantRow>;
  className?: string;
}) {
  return (
    <section className={`space-y-8 ${className ?? ""}`}>
      {/* Section heading */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <SoccerBallIcon className="w-8 h-8" />
          <h2
            className="text-3xl font-black text-white md:text-4xl"
            style={{
              textShadow:
                "2px 2px 6px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            }}
          >
            Συμμετέχοντες &amp; Στατιστικά
          </h2>
          <SoccerBallIcon className="w-8 h-8" />
        </div>
        <p className="text-sm text-white/50 uppercase tracking-widest">
          Match report
        </p>
      </motion.div>

      {/* Icon legend */}
      <StatsLegend />

      {/* Two columns */}
      <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Vertical divider on desktop */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />

        <TeamPanel
          teamId={teamA.id}
          teamName={teamA.name}
          teamLogo={teamALogo}
          associations={associationsA}
          participants={participants}
          statsByPlayer={statsByPlayer}
          align="left"
        />

        <TeamPanel
          teamId={teamB.id}
          teamName={teamB.name}
          teamLogo={teamBLogo}
          associations={associationsB}
          participants={participants}
          statsByPlayer={statsByPlayer}
          align="right"
        />
      </div>
    </section>
  );
}
