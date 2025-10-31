"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Match } from "@/app/lib/types";

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
      <section className="rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur p-5 sm:p-6">
        <p className="text-red-400">Σφάλμα φόρτωσης αγώνων: {errorMessage}</p>
      </section>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur p-5 sm:p-6">
        <p className="text-white/70">Δεν υπάρχουν καταγεγραμμένοι αγώνες.</p>
      </section>
    );
  }

  return (
    <section aria-label="Team matches timeline">
      <div className="mx-auto w-full">
        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur overflow-hidden">
          {/* Tabs */}
          <div className="px-5 sm:px-6 pt-4">
            <div className="inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
              <button
                onClick={() => handleTabChange('upcoming')}
                className={[
                  'px-5 py-3 text-sm font-semibold rounded-lg transition',
                  tab === 'upcoming'
                    ? 'bg-white/90 text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10',
                ].join(' ')}
                aria-pressed={tab === 'upcoming'}
              >
                Επερχόμενοι
              </button>
              <button
                onClick={() => handleTabChange('finished')}
                className={[
                  'px-5 py-3 text-sm font-semibold rounded-lg transition',
                  tab === 'finished'
                    ? 'bg-white/90 text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10',
                ].join(' ')}
                aria-pressed={tab === 'finished'}
              >
                Ολοκληρωμένοι
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/10">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {tab === 'upcoming' ? 'Επερχόμενοι Αγώνες' : 'Ολοκληρωμένοι Αγώνες'}
            </h2>
            <span className="text-xs sm:text-sm text-white/70">
              {currentMatches.length} σύνολο
            </span>
          </div>

          {/* Matches List */}
          <ul className="divide-y divide-white/10">
            {pageSlice.length === 0 && (
              <li className="px-5 sm:px-6 py-5 text-sm text-white/70">
                Δεν υπάρχουν {tab === 'upcoming' ? 'επερχόμενοι' : 'ολοκληρωμένοι'} αγώνες.
              </li>
            )}
            {pageSlice.map((match) => {
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
                <li
                  key={match.id}
                  className="relative px-5 sm:px-6 py-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    {/* My Team */}
                    <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                      <Image
                        src={myLogo}
                        alt={myName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-contain ring-2 ring-amber-400/30 bg-black/30"
                      />
                      <span className="truncate font-extrabold text-white uppercase tracking-wide text-lg">
                        {myName}
                      </span>
                    </div>

                    {/* Score or VS */}
                    <div className="flex flex-col items-center justify-center text-center shrink-0">
                      {showScore ? (
                        <div className="font-black tabular-nums text-white text-[24px] sm:text-[28px] leading-none">
                          {myScore} <span className="mx-2">–</span> {oppScore}
                        </div>
                      ) : (
                        <div className="font-extrabold text-white/85 text-[22px] sm:text-[24px] leading-none">
                          VS
                        </div>
                      )}
                      <div className="mt-2 text-[13px] text-white/60 leading-none whitespace-nowrap">
                        {formatDate(match.match_date)}
                      </div>
                    </div>

                    {/* Opponent */}
                    <div className="flex items-center gap-4 justify-end min-w-0 w-full sm:w-auto sm:justify-start">
                      <span className="truncate font-extrabold text-white uppercase tracking-wide text-lg text-right sm:text-left">
                        {oppName}
                      </span>
                      <Image
                        src={oppLogo}
                        alt={oppName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-contain ring-1 ring-white/20 bg-black/30"
                      />
                    </div>
                  </div>
                  <Link
                    href={`/matches/${match.id}`}
                    className="absolute inset-0"
                    aria-label={`${myName} vs ${oppName}`}
                  />
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {currentMatches.length > 0 && (
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-white/10">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 disabled:text-white/40 disabled:cursor-not-allowed bg-white/10 hover:bg-white/15 transition"
              >
                Προηγούμενα
              </button>
              <div className="text-xs text-white/70">
                Σελίδα <span className="font-semibold text-white">{page}</span> / {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 disabled:text-white/40 disabled:cursor-not-allowed bg-white/10 hover:bg-white/15 transition"
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