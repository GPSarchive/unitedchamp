"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Match } from "@/app/lib/types";

const dateFormatter = new Intl.DateTimeFormat("el-GR", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "—";
  return dateFormatter.format(value);
}

function timeValue(iso: string | null | undefined) {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

type TabKey = "upcoming" | "finished";

type TeamMatchesTimelineProps = {
  matches: Match[] | null;
  teamId: number;
  errorMessage?: string | null;
};

export default function TeamMatchesTimeline({
  matches,
  teamId,
  errorMessage,
}: TeamMatchesTimelineProps) {
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const { upcomingMatches, finishedMatches } = useMemo(() => {
    if (!matches || matches.length === 0) {
      return { upcomingMatches: [], finishedMatches: [] };
    }

    const upcoming: Match[] = [];
    const finished: Match[] = [];

    matches.forEach((match) => {
      const hasScores = typeof match.team_a_score === "number" && typeof match.team_b_score === "number";
      if (hasScores) {
        finished.push(match);
      } else {
        upcoming.push(match);
      }
    });

    upcoming.sort((a, b) => timeValue(a.match_date) - timeValue(b.match_date));
    finished.sort((a, b) => timeValue(b.match_date) - timeValue(a.match_date));

    return { upcomingMatches: upcoming, finishedMatches: finished };
  }, [matches]);

  const currentMatches = tab === "upcoming" ? upcomingMatches : finishedMatches;
  const totalPages = Math.max(1, Math.ceil(currentMatches.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, currentMatches.length);
  const pageSlice = currentMatches.slice(start, end);

  const handleTabChange = (nextTab: TabKey) => {
    setTab(nextTab);
    setPage(1);
  };

  if (errorMessage) {
    return (
      <section className="rounded-3xl border border-rose-800/40 bg-rose-950/30 p-6 text-rose-100">
        Failed to load matches: {errorMessage}
      </section>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
        No matches have been recorded for this team yet.
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Match log</h2>
          <p className="text-sm text-slate-400">Upcoming fixtures and recent results.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 p-1 text-xs uppercase tracking-[0.2em] text-slate-400">
          <TabButton label="Upcoming" isActive={tab === "upcoming"} onClick={() => handleTabChange("upcoming")} />
          <TabButton label="Finished" isActive={tab === "finished"} onClick={() => handleTabChange("finished")} />
        </div>
      </header>

      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-slate-500">
        {currentMatches.length} matches
      </p>

      {pageSlice.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">
          There are no {tab === "upcoming" ? "upcoming" : "finished"} matches to show.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {pageSlice.map((match) => {
            const teamA = match.team_a ?? null;
            const teamB = match.team_b ?? null;
            const isTeamA = teamA?.id === teamId;
            const myTeam = isTeamA ? teamA : teamB;
            const opponent = isTeamA ? teamB : teamA;
            const myScore = isTeamA ? match.team_a_score : match.team_b_score;
            const oppScore = isTeamA ? match.team_b_score : match.team_a_score;

            const myName = myTeam?.name ?? "My team";
            const oppName = opponent?.name ?? "Opponent";
            const myLogo = myTeam?.logo || "/logo.jpg";
            const oppLogo = opponent?.logo || "/logo.jpg";

            const showScore = typeof myScore === "number" && typeof oppScore === "number";

            return (
              <li key={match.id}>
                <Link
                  href={`/matches/${match.id}`}
                  className="group block rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-700 hover:bg-slate-900"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <TeamBadge name={myName} logo={myLogo} align="left" />

                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        {match.tournament?.name ?? ""}
                      </div>
                      <div className="text-2xl font-semibold text-white tabular-nums">
                        {showScore ? (
                          <>
                            {myScore} <span className="mx-2 text-slate-600">–</span> {oppScore}
                          </>
                        ) : (
                          <span className="text-base font-medium text-slate-400">VS</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{formatDate(match.match_date)}</div>
                    </div>

                    <TeamBadge name={oppName} logo={oppLogo} align="right" />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-800 px-3 py-1">Match #{match.id}</span>
                    {match.tournament?.season ? (
                      <span className="rounded-full border border-slate-800 px-3 py-1">
                        Season {match.tournament.season}
                      </span>
                    ) : null}
                    {tab === "finished" && match.winner_team_id ? (
                      <span className="rounded-full border border-slate-800 px-3 py-1 text-slate-300">
                        Winner: {match.winner_team_id === myTeam?.id ? myName : oppName}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {currentMatches.length > pageSize ? (
        <div className="mt-8 flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-full border border-slate-800 px-4 py-2 font-medium text-slate-300 transition disabled:cursor-not-allowed disabled:border-slate-900 disabled:text-slate-600"
          >
            Previous
          </button>
          <span>
            Page <span className="text-slate-200">{page}</span> of {totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded-full border border-slate-800 px-4 py-2 font-medium text-slate-300 transition disabled:cursor-not-allowed disabled:border-slate-900 disabled:text-slate-600"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-medium transition ${
        isActive ? "bg-slate-200 text-slate-900" : "hover:bg-slate-800/80 hover:text-slate-200"
      }`}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

function TeamBadge({
  name,
  logo,
  align,
}: {
  name: string;
  logo: string;
  align: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${align === "right" ? "justify-end text-right" : "text-left"}`}>
      {align === "right" ? null : (
        <Image
          src={logo}
          alt={name}
          width={48}
          height={48}
          className="h-12 w-12 rounded-2xl border border-slate-800 bg-slate-900 object-contain"
        />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-400">{align === "right" ? "Opponent" : "Team"}</p>
        <p className="truncate text-base font-semibold text-white">{name}</p>
      </div>
      {align === "right" ? (
        <Image
          src={logo}
          alt={name}
          width={48}
          height={48}
          className="h-12 w-12 rounded-2xl border border-slate-800 bg-slate-900 object-contain"
        />
      ) : null}
    </div>
  );
}
