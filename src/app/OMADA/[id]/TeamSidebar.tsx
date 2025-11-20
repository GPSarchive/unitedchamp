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
  FaCrown,
  FaMedal,
  FaFire,
} from "react-icons/fa";
import {
  GiTrophy,
  GiLaurelCrown,
  GiSoccerBall,
  GiChampions,
} from "react-icons/gi";
import {
  MdEmojiEvents,
  MdStars,
  MdSportsSoccer,
} from "react-icons/md";
import { Award, TrendingUp, Calendar, Hash } from "lucide-react";
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

/**
 * Transform external logo URLs to use local CORS-enabled proxy.
 * External URLs (e.g., https://www.ultrachamp.gr/api/public/team-logo/...)
 * need to be proxied through our API to enable CORS for WebGL.
 */
function getProxiedLogoUrl(logoUrl: string | null | undefined): string {
  if (!logoUrl) return "/placeholder-logo.png";

  // If already a relative URL or local, return as-is
  if (logoUrl.startsWith("/")) return logoUrl;

  try {
    const url = new URL(logoUrl);
    // If it's an external ultrachamp.gr URL, extract the path and use local proxy
    if (url.hostname === "www.ultrachamp.gr" || url.hostname === "ultrachamp.gr") {
      // Extract path after /api/public/team-logo/
      const match = url.pathname.match(/\/api\/public\/team-logo\/(.+)/);
      if (match && match[1]) {
        return `/api/public/team-logo/${match[1]}`;
      }
    }
    // For other external URLs, return as-is (might need proxy in future)
    return logoUrl;
  } catch {
    // Invalid URL, return as-is
    return logoUrl;
  }
}

function StatTile({ icon, label, value, highlight }: StatTileProps) {
  return (
    <motion.div
      whileHover={{ 
        scale: 1.05, 
        y: -4,
        transition: { duration: 0.2 }
      }}
      className={[
        "flex flex-col items-center justify-center rounded-2xl px-3 py-3 bg-black/45 border text-center transition-all duration-300",
        "hover:bg-black/60 hover:border-amber-400/80 hover:shadow-[0_0_25px_rgba(251,191,36,0.6)]",
        highlight
          ? "border-amber-400/80 shadow-[0_0_18px_rgba(251,191,36,0.4)]"
          : "border-white/10",
      ].join(" ")}
    >
      <div className={[
        "mb-1.5 text-lg transition-all duration-300 group-hover:text-amber-400",
        highlight ? "text-amber-400" : "text-red-400"
      ].join(" ")}>
        {icon}
      </div>
      <span className="text-[9px] uppercase tracking-[0.16em] text-white/55 font-semibold">
        {label}
      </span>
      <span className={[
        "mt-1 text-base font-bold tabular-nums transition-all duration-300",
        highlight ? "text-amber-400" : "text-white"
      ].join(" ")}>
        {value}
      </span>
    </motion.div>
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

  return (
    <section
      className={[
        "relative overflow-hidden rounded-3xl border border-white/12 bg-black/55",
        "shadow-[0_24px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl px-5 py-6 sm:px-6 sm:py-7 md:px-8 md:py-8 lg:px-10 lg:py-9",
        "bg-[radial-gradient(circle_at_0_0,rgba(248,250,252,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(239,68,68,0.33),transparent_55%)]",
      ].join(" ")}
    >
      {/* Subtle glow at the top, same vibe as the stats modal */}
      <div className="pointer-events-none absolute inset-x-8 -top-8 h-12 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.7),transparent_60%)] opacity-50" />

      {/* Decorative corner accents */}
      <div className="pointer-events-none absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-transparent rounded-tl-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-amber-500/10 to-transparent rounded-br-3xl" />

      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative flex flex-col gap-6 lg:gap-8 md:flex-row md:items-center"
      >
        {/* Logo + light rays halo - Enhanced sizing */}
        <div className="flex justify-center md:justify-start md:flex-shrink-0">
          <motion.div 
            className="relative h-32 w-32 sm:h-36 sm:w-36 md:h-44 md:w-44 lg:h-48 lg:w-48"
            whileHover={{ 
              scale: 1.08, 
              rotate: 2,
              transition: { duration: 0.3 }
            }}
          >
            <div className="absolute inset-0 rounded-full bg-black/70 border-2 border-white/15 shadow-[0_0_40px_rgba(0,0,0,0.9)] overflow-hidden">
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
                logoSrc={getProxiedLogoUrl(team.logo)}
                logoStrength={4}
                logoFit="cover"
                logoScale={1.0}
                popIn
                popDuration={800}
                popDelay={100}
                popScaleFrom={0.85}
              />
            </div>
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500/20 via-amber-500/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 blur-xl -z-10" />
          </motion.div>
        </div>

        {/* Main text + quick stats */}
        <div className="flex-1 space-y-4 sm:space-y-5">
          <div>
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-4 py-1.5 mb-3"
            >
              <GiTrophy className="h-4 w-4 text-red-400" />
              <span className="text-[10px] tracking-[0.18em] uppercase text-white/70 font-semibold">
                Προφίλ Ομάδας
              </span>
            </motion.div>

            <motion.h1
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-extrabold text-white mb-2"
              style={{
                textShadow:
                  "2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
              }}
            >
              {team.name}
            </motion.h1>

            <motion.p
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-sm sm:text-base text-white/80 mb-3"
              style={{
                textShadow: "1px 1px 3px rgba(0,0,0,0.85)",
              }}
            >
              Επίσημο προφίλ ομάδας, συμμετοχές σε τουρνουά και τίτλοι.
            </motion.p>

            {typeof team.am !== "undefined" && team.am !== null && (
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs"
              >
                <span className="inline-flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 hover:border-red-400/40 transition-all">
                  <Hash className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-white/90 font-medium">AM: {team.am}</span>
                </span>
              </motion.div>
            )}
          </div>

          {/* Stat tiles – Enhanced with better icons and responsive grid */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4"
          >
            <StatTile
              icon={<TrendingUp className="h-5 w-5" />}
              label="SEASON SCORE"
              value={team.season_score ?? 0}
            />
            <StatTile
              icon={<GiSoccerBall className="h-5 w-5" />}
              label="ΤΟΥΡΝΟΥΑ"
              value={membershipCount}
            />
            <StatTile
              icon={<GiLaurelCrown className="h-5 w-5" />}
              label="ΤΙΤΛΟΙ"
              value={winsCount}
              highlight={winsCount > 0}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom lists – Enhanced styling with better spacing */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="relative mt-6 sm:mt-7 lg:mt-8 grid gap-5 sm:gap-6 lg:gap-7 md:grid-cols-2"
      >
        {membershipCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
              <div className="p-2 rounded-lg bg-red-500/20 border border-red-400/40">
                <Calendar className="h-4 w-4 text-red-400" />
              </div>
              <h2
                className="text-sm sm:text-base font-bold text-white"
                style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.9)" }}
              >
                Συμμετοχές σε Τουρνουά
              </h2>
              <span className="ml-auto text-xs font-semibold text-white/60 bg-black/40 px-2 py-1 rounded-full">
                {membershipCount}
              </span>
            </div>
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {tournaments.map((t, idx) => (
                <motion.li
                  key={t.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8 + idx * 0.05, duration: 0.3 }}
                  className="group flex items-center justify-between rounded-xl border border-white/10 bg-black/45 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 hover:border-red-400/80 hover:bg-black/70 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300"
                >
                  <span className="truncate font-medium group-hover:text-white transition-colors">
                    {t.name ?? "Άγνωστο τουρνουά"}
                  </span>
                  {t.season && (
                    <span className="ml-3 shrink-0 inline-flex items-center gap-1.5 rounded-full bg-red-900/40 border border-red-500/60 px-2.5 py-1 text-[10px] text-red-100 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                      {t.season}
                    </span>
                  )}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {winsCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-amber-400/20">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/40">
                <GiLaurelCrown className="h-4 w-4 text-amber-400" />
              </div>
              <h2
                className="text-sm sm:text-base font-bold text-white"
                style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.9)" }}
              >
                Κατακτήσεις Τίτλων
              </h2>
              <span className="ml-auto text-xs font-semibold text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full">
                {winsCount}
              </span>
            </div>
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {wins.map((w, idx) => (
                <motion.li
                  key={w.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8 + idx * 0.05, duration: 0.3 }}
                  className="group flex items-center justify-between rounded-xl border border-amber-400/60 bg-black/55 px-3.5 py-2.5 text-xs sm:text-sm text-amber-50 shadow-[0_0_15px_rgba(251,191,36,0.35)] hover:shadow-[0_0_25px_rgba(251,191,36,0.5)] hover:border-amber-400/80 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    <FaTrophy className="h-3.5 w-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="truncate font-semibold group-hover:text-white transition-colors">
                      {w.name || "Πρωταθλητής"}
                    </span>
                  </div>
                  {w.season && (
                    <span className="ml-3 shrink-0 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-300/80 px-2.5 py-1 text-[10px] text-amber-50 font-semibold">
                      <MdEmojiEvents className="h-3 w-3" />
                      {w.season}
                    </span>
                  )}
                </motion.li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {errors?.membership && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-xs sm:text-sm text-red-300/90 bg-red-950/30 border border-red-500/40 rounded-lg px-3 py-2"
        >
          ⚠️ Σφάλμα φόρτωσης συμμετοχών: {errors.membership}
        </motion.p>
      )}
      {errors?.wins && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-xs sm:text-sm text-red-300/90 bg-red-950/30 border border-red-500/40 rounded-lg px-3 py-2"
        >
          ⚠️ Σφάλμα φόρτωσης τίτλων: {errors.wins}
        </motion.p>
      )}

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(239, 68, 68, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 68, 68, 0.7);
        }
      `}</style>
    </section>
  );
}