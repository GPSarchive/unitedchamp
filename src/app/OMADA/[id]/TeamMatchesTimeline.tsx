"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Trophy, Clock } from "lucide-react";
import { Match } from "@/app/lib/types";

const dtf = new Intl.DateTimeFormat("el-GR", {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
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

    // Filter out matches without valid dates first
    const matchesWithDates = matches.filter((match) => {
      if (!match.match_date) return false;
      const dateTime = new Date(match.match_date).getTime();
      return !Number.isNaN(dateTime);
    });

    const upcoming: Match[] = [];
    const finished: Match[] = [];

    matchesWithDates.forEach((match) => {
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
      <section className="rounded-2xl bg-red-950/60 border border-red-800/60 p-4">
        <p className="text-red-200 text-sm">
          Σφάλμα φόρτωσης αγώνων: {errorMessage}
        </p>
      </section>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <section className="rounded-2xl bg-black/60 border border-white/10 p-6">
        <h2
          className="text-xl font-bold text-white mb-2"
          style={{
            textShadow:
              "1px 1px 2px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000",
          }}
        >
          Αγώνες Ομάδας
        </h2>
        <p className="text-sm text-zinc-300">
          Δεν υπάρχουν καταγεγραμμένοι αγώνες.
        </p>
      </section>
    );
  }

  return (
    <section className="py-6 px-2 sm:px-4 lg:px-6" aria-label="Team matches timeline">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8 sm:mb-10 lg:mb-12 text-center"
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3">
          <Trophy className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-amber-500" />
          <h2
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white"
            style={{
              textShadow:
                "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            }}
          >
            Αγώνες Ομάδας
          </h2>
          <Calendar className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-amber-500" />
        </div>
        <p
          className="text-base sm:text-lg lg:text-xl text-white/80 mb-2"
          style={{
            textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          }}
        >
          Πρόγραμμα και αποτελέσματα αγώνων
        </p>
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-700/40 to-amber-700/40 backdrop-blur-sm px-4 py-2 rounded-full border border-red-600/50">
          <Clock className="h-4 w-4 text-red-400" />
          <span className="text-sm font-bold text-white">
            Σύνολο αγώνων: {matches.length}
          </span>
        </div>
      </motion.div>

      {/* Main Card Container */}
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-black/70 backdrop-blur-sm shadow-2xl">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-transparent to-amber-950/30 pointer-events-none" />

          {/* Tabs */}
          <div className="relative px-5 sm:px-6 pt-6 pb-4">
            <div className="inline-flex rounded-xl bg-black/70 backdrop-blur-sm p-1 ring-1 ring-white/20 shadow-lg">
              <button
                onClick={() => handleTabChange('upcoming')}
                className={[
                  'px-5 py-3 text-sm font-black rounded-lg transition-all duration-300 uppercase tracking-wider',
                  tab === 'upcoming'
                    ? 'bg-gradient-to-r from-red-700 to-amber-700 text-white shadow-[0_0_20px_rgba(185,28,28,0.4)]'
                    : 'text-white/70 hover:text-white hover:bg-white/5',
                ].join(' ')}
                aria-pressed={tab === 'upcoming'}
              >
                Επερχόμενοι
              </button>
              <button
                onClick={() => handleTabChange('finished')}
                className={[
                  'px-5 py-3 text-sm font-black rounded-lg transition-all duration-300 uppercase tracking-wider',
                  tab === 'finished'
                    ? 'bg-gradient-to-r from-red-700 to-amber-700 text-white shadow-[0_0_20px_rgba(185,28,28,0.4)]'
                    : 'text-white/70 hover:text-white hover:bg-white/5',
                ].join(' ')}
                aria-pressed={tab === 'finished'}
              >
                Ολοκληρωμένοι
              </button>
            </div>
          </div>

          {/* Header with count */}
          <div className="relative px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/10">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white"
              style={{
                textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {tab === 'upcoming' ? 'Επερχόμενοι Αγώνες' : 'Ολοκληρωμένοι Αγώνες'}
            </h3>
            <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="text-xs font-bold text-white">
                {currentMatches.length} {tab === 'upcoming' ? 'επερχόμενοι' : 'ολοκληρωμένοι'}
              </span>
            </div>
          </div>

          {/* Matches List */}
          <ul className="relative divide-y divide-white/10">
            {pageSlice.length === 0 && (
              <li className="px-5 sm:px-6 py-8 text-center">
                <p className="text-sm text-white/60 font-semibold">
                  Δεν υπάρχουν {tab === 'upcoming' ? 'επερχόμενοι' : 'ολοκληρωμένοι'} αγώνες.
                </p>
              </li>
            )}
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

              return (
                <motion.li
                  key={match.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * 0.05,
                    duration: 0.5,
                    type: "spring",
                    stiffness: 150,
                  }}
                  className="relative px-5 sm:px-6 py-6 hover:bg-gradient-to-r hover:from-red-950/20 hover:to-amber-950/20 transition-all duration-300 group"
                >
                  <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                    {/* My Team */}
                    <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                      <div className="relative">
                        <Image
                          src={myLogo}
                          alt={myName}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-full object-contain ring-2 ring-amber-600/50 bg-black/50 backdrop-blur-sm group-hover:ring-amber-500 group-hover:scale-110 transition-all duration-300"
                        />
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 rounded-full bg-amber-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                      </div>
                      <span className="truncate font-black text-white uppercase tracking-wide text-lg group-hover:text-amber-400 transition-colors duration-300"
                        style={{
                          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                        }}
                      >
                        {myName}
                      </span>
                    </div>

                    {/* Score or VS */}
                    <div className="flex flex-col items-center justify-center text-center shrink-0">
                      {showScore ? (
                        <div className="relative">
                          <div className="font-black tabular-nums text-white text-[28px] sm:text-[32px] leading-none"
                            style={{
                              textShadow: "2px 2px 4px rgba(0,0,0,0.9)",
                            }}
                          >
                            {myScore} <span className="mx-2 text-white/50">–</span> {oppScore}
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="font-black text-white/90 text-[26px] sm:text-[30px] leading-none px-4 py-2 rounded-xl bg-gradient-to-r from-red-800/30 to-amber-800/30 backdrop-blur-sm border border-amber-700/30"
                            style={{
                              textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
                            }}
                          >
                            VS
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-[13px] text-white/70 leading-none whitespace-nowrap bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                        <Calendar className="w-3 h-3" />
                        {formatDate(match.match_date)}
                      </div>
                    </div>

                    {/* Opponent */}
                    <div className="flex items-center gap-4 justify-end min-w-0 w-full sm:w-auto sm:justify-start">
                      <span className="truncate font-black text-white uppercase tracking-wide text-lg text-right sm:text-left group-hover:text-amber-400 transition-colors duration-300"
                        style={{
                          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                        }}
                      >
                        {oppName}
                      </span>
                      <div className="relative">
                        <Image
                          src={oppLogo}
                          alt={oppName}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-full object-contain ring-2 ring-white/30 bg-black/50 backdrop-blur-sm group-hover:ring-white/50 group-hover:scale-110 transition-all duration-300"
                        />
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
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
          </ul>

          {/* Pagination */}
          {currentMatches.length > 0 && (
            <div className="relative flex items-center justify-between px-5 sm:px-6 py-5 border-t border-white/10 bg-black/40 backdrop-blur-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-white uppercase tracking-wider disabled:text-white/30 disabled:cursor-not-allowed bg-gradient-to-r from-red-900/50 to-amber-900/50 hover:from-red-800/60 hover:to-amber-800/60 border border-white/20 disabled:border-white/10 transition-all duration-300 shadow-lg disabled:shadow-none"
              >
                Προηγούμενα
              </button>
              <div className="flex items-center gap-2 text-xs text-white/70 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                <span>Σελίδα</span>
                <span className="font-black text-white text-base">{page}</span>
                <span>/</span>
                <span className="font-semibold">{totalPages}</span>
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-white uppercase tracking-wider disabled:text-white/30 disabled:cursor-not-allowed bg-gradient-to-r from-red-900/50 to-amber-900/50 hover:from-red-800/60 hover:to-amber-800/60 border border-white/20 disabled:border-white/10 transition-all duration-300 shadow-lg disabled:shadow-none"
              >
                Επόμενα
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}