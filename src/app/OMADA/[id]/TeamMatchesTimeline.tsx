"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Match } from "@/app/lib/types";
import { Calendar, Trophy, Clock, Shield } from "lucide-react";

const dtf = new Intl.DateTimeFormat("el-GR", {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dtf.format(d);
}

function timeValue(iso: string | null | undefined) {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

interface TeamMatchesTimelineProps {
  matches: Match[] | null;
  teamId: number;
  errorMessage?: string | null;
}

type TabKey = 'upcoming' | 'finished';

export default function TeamMatchesTimeline({
  matches,
  teamId,
  errorMessage,
}: TeamMatchesTimelineProps) {
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Separate matches into upcoming and finished based on score presence
  const { upcomingMatches, finishedMatches } = useMemo(() => {
    if (!matches || matches.length === 0) {
      return { upcomingMatches: [], finishedMatches: [] };
    }

    const upcoming: Match[] = [];
    const finished: Match[] = [];

    matches.forEach((match) => {
      // A match is finished if both scores are set (including 0)
      const hasScores = typeof match.team_a_score === 'number' && typeof match.team_b_score === 'number';

      if (hasScores) {
        finished.push(match);
      } else {
        upcoming.push(match);
      }
    });

    // Sort: upcoming ascending (soonest first), finished descending (most recent first)
    upcoming.sort((a, b) => timeValue(a.match_date) - timeValue(b.match_date));
    finished.sort((a, b) => timeValue(b.match_date) - timeValue(a.match_date));

    return { upcomingMatches: upcoming, finishedMatches: finished };
  }, [matches]);

  const currentMatches = tab === 'upcoming' ? upcomingMatches : finishedMatches;
  const totalPages = Math.max(1, Math.ceil(currentMatches.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, currentMatches.length);
  const pageSlice = currentMatches.slice(start, end);

  // Reset to page 1 when switching tabs
  const handleTabChange = (newTab: TabKey) => {
    setTab(newTab);
    setPage(1);
  };

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-white/20 bg-black/50 p-6 backdrop-blur-sm">
        <p className="text-red-400">Σφάλμα φόρτωσης αγώνων: {errorMessage}</p>
      </section>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <section className="rounded-2xl border border-white/20 bg-black/50 p-6 backdrop-blur-sm">
        <p className="text-white/70">Δεν υπάρχουν καταγεγραμμένοι αγώνες.</p>
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      aria-label="Team matches timeline"
      className="relative"
    >
      <div className="mx-auto w-full">
        <div className="rounded-2xl border border-white/20 bg-black/50 shadow-lg backdrop-blur-sm overflow-hidden relative isolate">
          {/* Floating Orb */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full blur-3xl opacity-10"
            style={{ background: "radial-gradient(closest-side, rgba(236,72,153,0.4), transparent)" }}
            animate={{ x: [0, 15, -10, 0], y: [0, -12, 8, 0] }}
            transition={{ repeat: Infinity, duration: 13, ease: "easeInOut" }}
          />

          {/* Tabs */}
          <div className="px-5 sm:px-6 pt-5 relative z-10">
            <div className="inline-flex rounded-xl bg-white/5 p-1.5 ring-1 ring-white/10">
              <button
                onClick={() => handleTabChange('upcoming')}
                className={[
                  'px-5 py-2.5 text-sm font-bold rounded-lg transition-all relative',
                  tab === 'upcoming'
                    ? 'bg-gradient-to-r from-fuchsia-500/80 to-pink-500/80 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]'
                    : 'text-white/70 hover:text-white hover:bg-white/10',
                ].join(' ')}
                aria-pressed={tab === 'upcoming'}
              >
                <Clock className="inline-block h-4 w-4 mr-1.5" />
                Επερχόμενοι
              </button>
              <button
                onClick={() => handleTabChange('finished')}
                className={[
                  'px-5 py-2.5 text-sm font-bold rounded-lg transition-all relative',
                  tab === 'finished'
                    ? 'bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                    : 'text-white/70 hover:text-white hover:bg-white/10',
                ].join(' ')}
                aria-pressed={tab === 'finished'}
              >
                <Trophy className="inline-block h-4 w-4 mr-1.5" />
                Ολοκληρωμένοι
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/10 relative z-10">
            <h2
              className="text-xl sm:text-2xl font-extrabold tracking-tight text-white"
              style={{
                textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
              }}
            >
              {tab === 'upcoming' ? 'Επερχόμενοι Αγώνες' : 'Ολοκληρωμένοι Αγώνες'}
            </h2>
            <span
              className="text-xs sm:text-sm text-white/70"
              style={{
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {currentMatches.length} σύνολο
            </span>
          </div>

          {/* Matches List */}
          <ul className="divide-y divide-white/5 relative z-10">
            {pageSlice.length === 0 && (
              <li className="px-5 sm:px-6 py-8 text-center">
                <Calendar className="h-12 w-12 text-white/30 mx-auto mb-3" />
                <p className="text-sm text-white/70">
                  Δεν υπάρχουν {tab === 'upcoming' ? 'επερχόμενοι' : 'ολοκληρωμένοι'} αγώνες.
                </p>
              </li>
            )}
            <AnimatePresence mode="popLayout">
              {pageSlice.map((match, index) => {
                const teamA = match.team_a ?? null;
                const teamB = match.team_b ?? null;
                const isTeamA = teamA?.id === teamId;
                const myTeam = isTeamA ? teamA : teamB;
                const opponent = isTeamA ? teamB : teamA;
                const myScore = isTeamA ? match.team_a_score : match.team_b_score;
                const oppScore = isTeamA ? match.team_b_score : match.team_a_score;

                const myName = myTeam?.name ?? "Η Ομάδα μου";
                const oppName = opponent?.name ?? "Αντίπαλος";
                const myLogo = myTeam?.logo || "/logo.jpg";
                const oppLogo = opponent?.logo || "/logo.jpg";

                const showScore = typeof myScore === 'number' && typeof oppScore === 'number';
                const isWin = showScore && myScore! > oppScore!;
                const isLoss = showScore && myScore! < oppScore!;
                const isDraw = showScore && myScore === oppScore;

                return (
                  <motion.li
                    key={match.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="relative px-5 sm:px-6 py-6 hover:bg-white/5 transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      {/* My Team */}
                      <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                        <div className="relative h-14 w-14 rounded-full overflow-hidden ring-2 ring-amber-400/30 bg-black/40 shadow-lg group-hover:ring-amber-400/60 transition-all">
                          <Image
                            src={myLogo}
                            alt={myName}
                            width={56}
                            height={56}
                            className="h-full w-full object-contain p-1"
                          />
                        </div>
                        <span
                          className="truncate font-extrabold text-white uppercase tracking-wide text-base sm:text-lg"
                          style={{
                            textShadow: '1px 1px 3px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000'
                          }}
                        >
                          {myName}
                        </span>
                      </div>

                      {/* Score or VS */}
                      <div className="flex flex-col items-center justify-center text-center shrink-0">
                        {showScore ? (
                          <div
                            className={`font-black tabular-nums text-[28px] sm:text-[32px] leading-none ${
                              isWin
                                ? "text-emerald-400"
                                : isLoss
                                ? "text-rose-400"
                                : "text-white"
                            }`}
                            style={{
                              textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                            }}
                          >
                            {myScore} <span className="mx-2 text-white/50">–</span> {oppScore}
                          </div>
                        ) : (
                          <div
                            className="font-extrabold text-white text-[26px] sm:text-[30px] leading-none"
                            style={{
                              textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                            }}
                          >
                            VS
                          </div>
                        )}
                        <div
                          className="mt-2 text-xs sm:text-sm text-white/60 leading-none whitespace-nowrap"
                          style={{
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                          }}
                        >
                          {formatDate(match.match_date)}
                        </div>
                        {showScore && (
                          <div
                            className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                              isWin
                                ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300"
                                : isLoss
                                ? "bg-rose-500/15 border border-rose-400/30 text-rose-300"
                                : "bg-slate-500/15 border border-slate-400/30 text-slate-300"
                            }`}
                          >
                            {isWin && <Trophy className="h-3 w-3" />}
                            {isWin ? "Νίκη" : isLoss ? "Ήττα" : "Ισοπαλία"}
                          </div>
                        )}
                      </div>

                      {/* Opponent */}
                      <div className="flex items-center gap-4 justify-end min-w-0 w-full sm:w-auto sm:justify-start">
                        <span
                          className="truncate font-extrabold text-white/90 uppercase tracking-wide text-base sm:text-lg text-right sm:text-left"
                          style={{
                            textShadow: '1px 1px 3px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000'
                          }}
                        >
                          {oppName}
                        </span>
                        <div className="relative h-14 w-14 rounded-full overflow-hidden ring-1 ring-white/20 bg-black/40 shadow-lg">
                          <Image
                            src={oppLogo}
                            alt={oppName}
                            width={56}
                            height={56}
                            className="h-full w-full object-contain p-1"
                          />
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/matches/${match.id}`}
                      className="absolute inset-0"
                      aria-label={`${myName} vs ${oppName}`}
                    />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          {/* Pagination */}
          {currentMatches.length > 0 && (
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-white/10 relative z-10">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:text-white/30 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20 disabled:hover:bg-white/10 transition-all shadow-sm hover:shadow-md"
              >
                Προηγούμενα
              </button>
              <div
                className="text-xs sm:text-sm text-white/80 font-semibold"
                style={{
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}
              >
                Σελίδα <span className="text-cyan-300">{page}</span> / {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:text-white/30 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20 disabled:hover:bg-white/10 transition-all shadow-sm hover:shadow-md"
              >
                Επόμενα
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
