// app/OMADA/[id]/TeamSidebar.tsx
'use client';

import { useEffect, useRef } from "react";
import gsap from "gsap"; // Assume gsap is installed for animations
import { FaTrophy, FaUsers, FaHashtag, FaChartLine, FaCalendarAlt, FaAward } from "react-icons/fa";
import { Team } from "@/app/lib/types";
import LightRays from "./react-bits/LightRays";

type TournamentLight = {
  id: number;
  name: string | null;
  season: string | null;
  status?: string | null;
  winner_team_id?: number | null;
};

export default function TeamSidebar({
  team,
  tournaments,
  wins,
  errors,
}: {
  team: Team;
  tournaments: TournamentLight[];
  wins: { id: number; name: string | null; season: string | null }[];
  errors?: { membership?: string; wins?: string };
}) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const membershipCount = tournaments.length;
  const winsCount = wins.length;

  useEffect(() => {
    if (sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.6, ease: "power3.out" }
      );
    }
  }, []);

  return (
    <div
      ref={sidebarRef}
      className="sticky top-8 h-fit space-y-6 rounded-2xl bg-gradient-to-b from-stone-800/50 to-stone-900/50 p-6 border border-amber-500/20 shadow-2xl backdrop-blur-md"
    >
      {/* Logo with LightRays */}
     <div className="relative mx-auto w-64 h-64 overflow-hidden rounded-full border-4 border-amber-400/30 shadow-lg ring-1 ring-amber-300/20 group">

        <LightRays
          className="absolute inset-0 h-full w-full rounded-full pointer-events-none mix-blend-screen"
          raysOrigin="top-center"
          raysColor="#fff7e6"
          raysSpeed={1.2}
          lightSpread={0.9}
          rayLength={1.5}
          followMouse
          mouseInfluence={0.15}
          noiseAmount={0.08}
          distortion={0.03}
          logoSrc={team.logo ?? "/placeholder-logo.png"}
          logoStrength={4}
          logoFit="cover"
          logoScale={1.0}
          popIn
          popDuration={800}
          popDelay={100}
          popScaleFrom={0.85}
        />
      </div>

      {/* Name and Established */}
      <div className="text-center">
      <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400">
          {team.name}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Established: {team.created_at ? new Date(team.created_at).toLocaleDateString() : "Unknown"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
      <div className="p-4 rounded-xl bg-slate-800/50 border border-amber-600/30 text-center">
      <FaHashtag className="mx-auto text-amber-400 mb-2" />
          <p className="text-sm text-slate-400">Team ID</p>
          <p className="text-xl font-bold text-white">{team.am ?? "—"}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/50 border border-amber-600/30 text-center">
          <FaChartLine className="mx-auto text-amber-400 mb-2" />
          <p className="text-sm text-slate-400">Season Score</p>
          <p className="text-xl font-bold text-white">{team.season_score ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/50 border border-amber-600/30 text-center">
          <FaUsers className="mx-auto text-amber-400 mb-2" />
          <p className="text-sm text-slate-400">Tournaments</p>
          <p className="text-xl font-bold text-white">{membershipCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/50 border border-amber-600/30 text-center">
          <FaTrophy className="mx-auto text-amber-400 mb-2" />
          <p className="text-sm text-slate-400">Championships</p>
          <p className="text-xl font-bold text-white">{winsCount}</p>
        </div>
      </div>

      {/* Tournaments List */}
{membershipCount > 0 && (
  <div>
    <h3
      className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 mb-2 flex items-center gap-2"
      title="Tournaments the team has participated in"
    >
      <FaCalendarAlt className="text-amber-400" /> Tournaments
    </h3>
    <ul className="space-y-2">
      {tournaments.map((t) => (
        <li
          key={t.id}
          className="text-sm text-slate-200 bg-slate-900/40 border border-amber-600/30 hover:border-amber-400/50 hover:shadow-md hover:shadow-orange-500/10 transition-colors rounded-lg px-3 py-2 flex items-center justify-between"
        >
          <span className="truncate">{t.name ?? "—"}</span>

          {t.season ? (
            <span className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-orange-900/25 px-2 py-0.5 text-amber-200 text-xs">
              <span className="size-1.5 rounded-full bg-amber-400/80" />
              {t.season}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  </div>
)}

{/* Wins List */}
{winsCount > 0 && (
  <div>
    <h3
      className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 mb-2 flex items-center gap-2"
      title="Championships the team has won"
    >
      <FaAward className="text-amber-400" /> Championships
    </h3>
    <ul className="space-y-2">
      {wins.map((w) => (
        <li
          key={w.id}
          className="text-sm text-slate-200 bg-slate-900/40 border border-amber-600/30 hover:border-amber-400/50 hover:shadow-md hover:shadow-orange-500/10 transition-colors rounded-lg px-3 py-2 flex items-center justify-between"
        >
          <span className="truncate">{w.name ?? "Champion"}</span>

          {w.season ? (
            <span className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-900/20 px-2 py-0.5 text-red-200 text-xs">
              <span className="size-1.5 rounded-full bg-red-400/80" />
              {w.season}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  </div>
)}

{errors?.membership && (
  <p className="text-red-400/90 text-sm">Error: {errors.membership}</p>
)}
{errors?.wins && <p className="text-red-400/90 text-sm">Error: {errors.wins}</p>}
    </div>
  );
}