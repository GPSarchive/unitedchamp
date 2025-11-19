"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  FaTrophy,
  FaUsers,
  FaHashtag,
  FaChartLine,
  FaCalendarAlt,
  FaAward,
} from "react-icons/fa";
import type { Team } from "@/app/lib/types";
import LightRays from "./react-bits/LightRays";

type TournamentLight = {
  id: number;
  name: string | null;
  season: string | null;
  status?: string | null;
  winner_team_id?: number | null;
};

type TeamSidebarProps = {
  team: Team;
  tournaments: TournamentLight[];
  wins: { id: number; name: string | null; season: string | null }[];
  errors?: {
    membership?: string;
    wins?: string;
  };
};

type StatTileProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
};

function StatTile({ icon, label, value, highlight }: StatTileProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-2xl px-3 py-2 bg-black/45 border text-center transition-all",
        highlight
          ? "border-amber-400/80 shadow-[0_0_18px_rgba(251,191,36,0.4)]"
          : "border-white/10",
      ].join(" ")}
    >
      <div className="mb-1 text-base text-red-400">{icon}</div>
      <span className="text-[9px] uppercase tracking-[0.16em] text-white/55">
        {label}
      </span>
      <span className="mt-0.5 text-sm font-semibold text-white tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default function TeamSidebar({
  team,
  tournaments,
  wins,
  errors,
}: TeamSidebarProps) {
  const membershipCount = tournaments.length;
  const winsCount = wins.length;

  const establishedYear = team.created_at
    ? new Date(team.created_at).getFullYear()
    : null;

  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl border border-white/12 bg-black/55",
        "shadow-[0_24px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl px-5 py-6 md:px-8 md:py-7",
        "bg-[radial-gradient(circle_at_0_0,rgba(248,250,252,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(239,68,68,0.33),transparent_55%)]",
      ].join(" ")}
    >
      {/* Subtle glow at the top, same vibe as the stats modal */}
      <div className="pointer-events-none absolute inset-x-8 -top-8 h-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.7),transparent_60%)] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative flex flex-col gap-6 md:flex-row md:items-center"
      >
        {/* Logo + light rays halo */}
        <div className="flex justify-center md:justify-start md:flex-shrink-0">
          <div className="relative h-28 w-28 md:h-40 md:w-40">
            <div className="absolute inset-0 rounded-full bg-black/70 border border-white/15 shadow-[0_0_30px_rgba(0,0,0,0.9)] overflow-hidden">
              {/* Light rays with team logo */}
              <LightRays
                className="h-full w-full rounded-full"
                raysOrigin="top-center"
                raysColor="#ffffff"
                raysSpeed={1.2}
                lightSpread={0.9}
                rayLength={1.5}
                followMouse
                mouseInfluence={0.16}
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
          </div>
        </div>

        {/* Main text + quick stats */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-3 py-1 mb-2">
              <FaUsers className="h-3 w-3 text-red-400" />
              <span className="text-[10px] tracking-[0.18em] uppercase text-white/70">
                Προφίλ Ομάδας
              </span>
            </div>

            <h1
              className="text-3xl md:text-4xl font-extrabold text-white"
              style={{
                textShadow:
                  "2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
              }}
            >
              {team.name}
            </h1>

            <p
              className="mt-1 text-sm text-white/80"
              style={{
                textShadow: "1px 1px 3px rgba(0,0,0,0.85)",
              }}
            >
              Επίσημο προφίλ ομάδας, συμμετοχές σε τουρνουά και τίτλοι.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-200">
              {establishedYear && (
                <span className="inline-flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full border border-white/10">
                  <FaCalendarAlt className="h-3 w-3 text-red-400" />
                  Ίδρυση {establishedYear}
                </span>
              )}
              {typeof team.am !== "undefined" && team.am !== null && (
                <span className="inline-flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full border border-white/10">
                  <FaHashtag className="h-3 w-3 text-red-400" />
                  AM: {team.am}
                </span>
              )}
            </div>
          </div>

          {/* Stat tiles – styled like StatPill but larger */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              icon={<FaHashtag className="h-4 w-4" />}
              label="ΚΩΔΙΚΟΣ"
              value={team.id}
            />
            <StatTile
              icon={<FaChartLine className="h-4 w-4" />}
              label="SEASON SCORE"
              value={team.season_score ?? 0}
              highlight
            />
            <StatTile
              icon={<FaUsers className="h-4 w-4" />}
              label="ΤΟΥΡΝΟΥΑ"
              value={membershipCount}
            />
            <StatTile
              icon={<FaTrophy className="h-4 w-4" />}
              label="ΤΙΤΛΟΙ"
              value={winsCount}
              highlight={winsCount > 0}
            />
          </div>
        </div>
      </motion.div>

      {/* Bottom lists – same glassy cards as player stats modal */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="relative mt-6 grid gap-5 md:grid-cols-2"
      >
        {membershipCount > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FaCalendarAlt className="h-4 w-4 text-red-400" />
              <h2
                className="text-sm font-semibold text-white"
                style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.9)" }}
              >
                Συμμετοχές σε Τουρνουά
              </h2>
            </div>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {tournaments.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-zinc-100 hover:border-red-400/80 hover:bg-black/70 transition-colors"
                >
                  <span className="truncate">
                    {t.name ?? "Άγνωστο τουρνουά"}
                  </span>
                  {t.season && (
                    <span className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-full bg-red-900/40 border border-red-500/60 px-2 py-0.5 text-[10px] text-red-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      {t.season}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {winsCount > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FaAward className="h-4 w-4 text-amber-400" />
              <h2
                className="text-sm font-semibold text-white"
                style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.9)" }}
              >
                Κατακτήσεις Τίτλων
              </h2>
            </div>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {wins.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-black/55 px-3 py-1.5 text-xs text-amber-50 shadow-[0_0_15px_rgba(251,191,36,0.35)]"
                >
                  <span className="truncate">
                    {w.name || "Πρωταθλητής"}
                  </span>
                  {w.season && (
                    <span className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-300/80 px-2 py-0.5 text-[10px] text-amber-50">
                      <FaTrophy className="h-3 w-3" />
                      {w.season}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {errors?.membership && (
        <p className="mt-3 text-xs text-red-300/90">
          Σφάλμα φόρτωσης συμμετοχών: {errors.membership}
        </p>
      )}
      {errors?.wins && (
        <p className="mt-1 text-xs text-red-300/90">
          Σφάλμα φόρτωσης τίτλων: {errors.wins}
        </p>
      )}
    </section>
  );
}
