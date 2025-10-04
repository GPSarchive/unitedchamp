// app/OMADA/[id]/MatchesTimeline.tsx
import Image from "next/image";
import Link from "next/link";
import type { Match } from "@/app/lib/types";
import { FaCalendarAlt, FaTrophy } from "react-icons/fa";

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

export default function MatchesTimeline({
  matches,
  teamId,
  errorMessage,
}: MatchesTimelineProps) {
  if (errorMessage) {
    return <p className="text-red-400">Error loading matches: {errorMessage}</p>;
  }

  if (!matches || matches.length === 0) {
    return <p className="text-slate-400">No matches recorded.</p>;
  }

  return (
    <section className="rounded-2xl p-6 shadow-xl backdrop-blur-sm border border-amber-500/20 bg-gradient-to-b from-stone-900/60 via-amber-950/5 to-zinc-900">
      <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 mb-4 flex items-center gap-2">
        <FaTrophy className="text-amber-400" /> Match History
      </h2>

      <div className="space-y-4">
        {matches.map((match) => {
          const teamA = match.team_a ?? null;
          const teamB = match.team_b ?? null;
          const isTeamA = teamA?.id === teamId;
          const myTeam = isTeamA ? teamA : teamB;
          const opponent = isTeamA ? teamB : teamA;
          const myScore = isTeamA ? match.team_a_score : match.team_b_score;
          const oppScore = isTeamA ? match.team_b_score : match.team_a_score;

          let result: "Win" | "Loss" | "Draw" | "Upcoming";
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
              Upcoming:
                "bg-orange-900/30 text-amber-300 border-amber-600/50",
            }[result];

          return (
            <Link
              key={match.id}
              href={`/matches/${match.id}`}
              className="block p-4 rounded-xl bg-stone-950/40 border border-amber-600/30 hover:border-amber-400/50 transition-shadow hover:shadow-md hover:shadow-orange-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    src={myTeam?.logo ?? "/logo.jpg"}
                    alt="My Team"
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                  <span className="font-bold text-white">{myScore ?? "-"}</span>
                  <span className="text-slate-400">vs</span>
                  <span className="text-slate-300">{oppScore ?? "-"}</span>
                  <Image
                    src={opponent?.logo ?? "/logo.jpg"}
                    alt="Opponent"
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-400 flex items-center gap-1 justify-end">
                    <FaCalendarAlt /> {formatDate(match.match_date)}
                  </p>
                  <span
                    className={`mt-1 inline-block px-3 py-1 text-xs rounded-full border ${resultColor}`}
                  >
                    {result}
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
