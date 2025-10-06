"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Match } from "@/app/lib/types";
import { FaCalendarAlt, FaTrophy, FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface MatchesTimelineProps {
  matches: Match[] | null;
  teamId: number;
  errorMessage?: string | null;
}

const dtf = new Intl.DateTimeFormat("el-GR", {
  dateStyle: "medium",
  timeZone: "Europe/Athens",
});

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dtf.format(d);
}

// Safe time extractor: invalid or missing dates go to the bottom
function timeValue(iso: string | null | undefined) {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

export default function MatchesTimeline({
  matches,
  teamId,
  errorMessage,
}: MatchesTimelineProps) {
  if (errorMessage) return <p className="text-red-400">Error loading matches: {errorMessage}</p>;
  if (!matches || matches.length === 0) return <p className="text-slate-400">No matches recorded.</p>;

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => timeValue(b.match_date) - timeValue(a.match_date)),
    [matches]
  );

  const pageSize = 5;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(sortedMatches.length / pageSize));
  const start = page * pageSize;
  const end = Math.min(start + pageSize, sortedMatches.length);
  const pageSlice = sortedMatches.slice(start, end);

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  return (
    <section className="rounded-2xl p-6 shadow-xl backdrop-blur-sm border border-amber-500/20 bg-gradient-to-b from-stone-900/60 via-amber-950/5 to-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 flex items-center gap-2">
          <FaTrophy className="text-amber-400" /> Ιστορικό Αγώνων
        </h2>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">
            Προβολή <span className="text-slate-200">{start + 1}</span>–<span className="text-slate-200">{end}</span>{" "}
            από <span className="text-slate-200">{sortedMatches.length}</span>
          </span>
          <div className="flex items-center rounded-lg border border-amber-600/30 overflow-hidden">
            <button
              type="button"
              onClick={goPrev}
              disabled={page === 0}
              className="px-2 py-1 disabled:opacity-40 hover:bg-amber-500/10 focus:outline-none"
              aria-label="Previous page"
              title="Previous"
            >
              <FaChevronLeft />
            </button>
            <div className="px-3 py-1 text-slate-300 border-l border-r border-amber-600/30">
              {page + 1}/{totalPages}
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 disabled:opacity-40 hover:bg-amber-500/10 focus:outline-none"
              aria-label="Next page"
              title="Next"
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {pageSlice.map((match) => {
          const teamA = match.team_a ?? null;
          const teamB = match.team_b ?? null;
          const isTeamA = teamA?.id === teamId;
          const myTeam = isTeamA ? teamA : teamB;
          const opponent = isTeamA ? teamB : teamA;
          const myScore = isTeamA ? match.team_a_score : match.team_b_score;
          const oppScore = isTeamA ? match.team_b_score : match.team_a_score;

          type Result = "Win" | "Loss" | "Draw" | "Upcoming";
          let result: Result;
          if (match.status === "finished") {
            if (match.winner_team_id == null) result = "Draw";
            else result = match.winner_team_id === teamId ? "Win" : "Loss";
          } else {
            result = "Upcoming";
          }

          const resultColor =
            {
              Win: "bg-emerald-900/30 text-emerald-300 border-emerald-600/50",
              Loss: "bg-rose-900/30 text-rose-300 border-rose-600/50",
              Draw: "bg-stone-900/30 text-stone-300 border-stone-600/50",
              Upcoming: "bg-orange-900/30 text-amber-300 border-amber-600/50",
            }[result];

          const resultLabel =
            {
              Win: "Νίκη",
              Loss: "Ήττα",
              Draw: "Ισοπαλία",
              Upcoming: "Προγραμματισμένος",
            }[result];

          return (
            <Link
              key={match.id}
              href={`/matches/${match.id}`}
              className="block p-4 rounded-xl bg-stone-950/70 border border-amber-600/30 hover:border-amber-400/50 transition-shadow hover:shadow-md hover:shadow-orange-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              {/* Card layout: teams (fill) | date+status (auto) */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                {/* Teams row — 5 columns: name | logo | center | logo | name */}
                <div className="grid w-full grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-2 sm:gap-3">
                  {/* Left name (outside) */}
                  <p className="truncate max-w-[18ch] font-semibold text-white text-right min-w-0 justify-self-end">
                    {myTeam?.name ?? "—"}
                  </p>

                  {/* Left logo (hugs center) */}
                  <Image
                    src={myTeam?.logo ?? "/logo.jpg"}
                    alt={`${myTeam?.name ?? "My Team"} logo`}
                    width={32}
                    height={32}
                    className="rounded-full justify-self-end flex-none"
                  />

                  {/* Center: score or VS (true middle, stable width) */}
                  <div className="px-2 text-base font-extrabold leading-none tracking-tight text-white text-center tabular-nums min-w-[4.75rem]">
                    {match.status === "finished" ? (
                      <>
                        {myScore ?? "—"} <span className=" text-slate-500">-</span> {oppScore ?? "—"}
                        
                      </>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 text-xs uppercase rounded-full bg-white/5 ring-1 ring-white/10 text-slate-300">
                        VS
                      </span>
                    )}
                  </div>

                  {/* Right logo (hugs center) */}
                  <Image
                    src={opponent?.logo ?? "/logo.jpg"}
                    alt={`${opponent?.name ?? "Opponent"} logo`}
                    width={32}
                    height={32}
                    className="rounded-full justify-self-start flex-none"
                  />

                  {/* Right name (outside) */}
                  <p className="truncate max-w-[18ch] text-slate-200 min-w-0 justify-self-start">
                    {opponent?.name ?? "—"}
                  </p>
                </div>

                {/* Date + status */}
                <div className="text-right">
                  <p className="text-sm text-slate-400 flex items-center gap-1 justify-end">
                    <FaCalendarAlt /> {formatDate(match.match_date)}
                  </p>
                  <span className={`mt-1 inline-block px-3 py-1 text-xs rounded-full border ${resultColor}`}>
                    {resultLabel}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}