"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { TournamentImage } from "@/app/lib/OptimizedImage";
import { Trophy, Calendar, ChevronRight } from "lucide-react";

/**
 * TournamentHeader - Sticky mini-bar tournament context
 * Shows at top of match page with tournament info
 */
export default function TournamentHeader({
  logo,
  name,
  matchday,
  round,
  matchDate,
  tournamentId,
}: {
  logo: string | null;
  name: string;
  matchday?: number | null;
  round?: number | null;
  matchDate?: string | null;
  tournamentId?: number | null;
}) {
  const matchdayLabel = round
    ? `Round ${round}`
    : matchday
    ? `Αγωνιστική ${matchday}`
    : null;

  const dateLabel = matchDate
    ? new Date(matchDate).toLocaleDateString("el-GR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6"
      data-testid="tournament-header"
    >
      <div className="flex items-center justify-between rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-3">
        {/* Left: Tournament Info */}
        <div className="flex items-center gap-3">
          {/* Tournament Logo */}
          <div className="relative h-8 w-8 shrink-0">
            {logo ? (
              <TournamentImage
                src={logo}
                alt={name}
                width={32}
                height={32}
                className="h-full w-full object-contain"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-amber-500/20">
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>
            )}
          </div>

          {/* Tournament Name */}
          {tournamentId ? (
            <Link
              href={`/tournaments/${tournamentId}`}
              className="group flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                {name}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-white/40 group-hover:text-white/60 transition-colors" />
            </Link>
          ) : (
            <span className="text-sm font-medium text-white/70">{name}</span>
          )}
        </div>

        {/* Right: Match Context */}
        <div className="flex items-center gap-3 text-xs">
          {matchdayLabel && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 font-mono font-medium">
              {matchdayLabel}
            </span>
          )}
          {dateLabel && (
            <div className="flex items-center gap-1.5 text-white/50">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-mono">{dateLabel}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
