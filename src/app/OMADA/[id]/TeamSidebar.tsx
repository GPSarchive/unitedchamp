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
      className="sticky top-8 h-fit space-y-6 rounded-2xl bg-black/50 p-6 border border-white/20 shadow-lg backdrop-blur-sm"
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
      <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400">
          {team.name}
        </h1>
        <p className="text-sm text-white/70 mt-1" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
          Established: {team.created_at ? new Date(team.created_at).toLocaleDateString() : "Unknown"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
      <div className="p-4 rounded-xl bg-black/40 border border-white/20 text-center backdrop-blur-sm">
      <FaHashtag className="mx-auto text-cyan-400 mb-2" />
          <p className="text-sm text-white/70" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>Team ID</p>
          <p className="text-xl font-bold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{team.am ?? "—"}</p>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-white/20 text-center backdrop-blur-sm">
          <FaChartLine className="mx-auto text-purple-400 mb-2" />
          <p className="text-sm text-white/70" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>Season Score</p>
          <p className="text-xl font-bold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{team.season_score ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-white/20 text-center backdrop-blur-sm">
          <FaUsers className="mx-auto text-blue-400 mb-2" />
          <p className="text-sm text-white/70" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>Tournaments</p>
          <p className="text-xl font-bold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{membershipCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-white/20 text-center backdrop-blur-sm">
          <FaTrophy className="mx-auto text-amber-400 mb-2" />
          <p className="text-sm text-white/70" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>Championships</p>
          <p className="text-xl font-bold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{winsCount}</p>
        </div>
      </div>

      {/* Tournaments List */}
{membershipCount > 0 && (
  <div>
    <h3
      className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 mb-2 flex items-center gap-2"
      title="Tournaments the team has participated in"
    >
      <FaCalendarAlt className="text-cyan-400" /> Tournaments
    </h3>
    <ul className="space-y-2">
      {tournaments.map((t) => (
        <li
          key={t.id}
          className="text-sm text-white bg-black/40 border border-white/20 hover:border-white/40 hover:shadow-md hover:bg-black/50 transition-all rounded-lg px-3 py-2 flex items-center justify-between backdrop-blur-sm"
        >
          <span className="truncate" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{t.name ?? "—"}</span>

          {t.season ? (
            <span className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-md border border-purple-400/30 bg-purple-900/25 px-2 py-0.5 text-purple-200 text-xs">
              <span className="size-1.5 rounded-full bg-purple-400/80" />
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
      className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 mb-2 flex items-center gap-2"
      title="Championships the team has won"
    >
      <FaAward className="text-amber-400" /> Championships
    </h3>
    <ul className="space-y-2">
      {wins.map((w) => (
        <li
          key={w.id}
          className="text-sm text-white bg-black/40 border border-amber-400/30 hover:border-amber-400/50 hover:shadow-md hover:shadow-amber-500/20 transition-all rounded-lg px-3 py-2 flex items-center justify-between backdrop-blur-sm"
        >
          <span className="truncate" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{w.name ?? "Champion"}</span>

          {w.season ? (
            <span className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-900/20 px-2 py-0.5 text-amber-200 text-xs">
              <span className="size-1.5 rounded-full bg-amber-400/80" />
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