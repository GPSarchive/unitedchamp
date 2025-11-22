// app/OMADA/[id]/MatchesSection.tsx
import Image from "next/image";
import Link from "next/link";
import type { Match } from "@/app/lib/types";
import { FaCalendarAlt, FaTrophy, FaClock } from "react-icons/fa";

interface MatchesSectionProps {
  matches: Match[] | null;
  teamId: number;
  errorMessage?: string | null;
}

/** Stable date formatting (no hydration mismatches) */
const dtf = new Intl.DateTimeFormat("el-GR", {
  dateStyle: "medium",
});
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dtf.format(d);
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export default function MatchesSection({
  matches,
  teamId,
  errorMessage,
}: MatchesSectionProps) {
  return (
    <section className="mb-12 rounded-2xl border border-orange-800/30 bg-orange-900/10 p-8 shadow-xl">
      <h2 className="text-3xl font-bold text-orange-300 mb-6 flex items-center gap-3"><FaTrophy className="text-orange-400" /> Matches</h2>

      {errorMessage ? (
        <p className="text-red-400">Error loading matches: {errorMessage}</p>
      ) : !matches || matches.length === 0 ? (
        <p className="text-gray-400">No matches recorded for this team.</p>
      ) : (
        <div className="space-y-6">
          {matches.map((match) => {
            const teamA = match.team_a ?? null;
            const teamB = match.team_b ?? null;

            const isTeamA = teamA?.id === teamId;
            const isTeamB = teamB?.id === teamId;

            const myTeam = isTeamA ? teamA : teamB;
            const opponent = isTeamA ? teamB : isTeamB ? teamA : null;

            const myScore = isTeamA
              ? match.team_a_score
              : isTeamB
              ? match.team_b_score
              : null;
            const oppScore = isTeamA
              ? match.team_b_score
              : isTeamB
              ? match.team_a_score
              : null;

            type Result = "Win" | "Loss" | "Draw" | "Upcoming";
            let result: Result;
            if (match.status === "finished") {
              if (match.winner_team_id == null) result = "Draw";
              else if (match.winner_team_id === teamId) result = "Win";
              else result = "Loss";
            } else {
              result = "Upcoming";
            }

            const whenText = formatDate(match.match_date);

            return (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                aria-label={`Match vs ${opponent?.name ?? "—"} on ${whenText}`}
                className="group block rounded-2xl p-6 border border-orange-800/40 bg-orange-900/20 shadow-lg hover:shadow-2xl hover:border-orange-600/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              >
                <div className="flex flex-col items-center gap-4">
                  {/* Date */}
                  <div className="flex items-center gap-2 text-orange-300 text-lg font-semibold">
                    <FaCalendarAlt className="text-orange-400" />
                    <time dateTime={match.match_date ?? undefined}>
                      {whenText}
                    </time>
                    {result === "Upcoming" && <span className="flex items-center gap-1 ml-4"><FaClock className="text-orange-400" /> Scheduled</span>}
                  </div>

                  {/* Teams and Score */}
                  <div className="flex items-center justify-between w-full max-w-lg">
                    {/* My Team */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-orange-500/50">
                        <Image
                          src={myTeam?.logo ?? "/logo.jpg"}
                          alt={`${myTeam?.name ?? "My Team"} logo`}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      <p className="text-white font-bold text-lg">{myTeam?.name ?? "—"}</p>
                    </div>

                    {/* Score / VS */}
                    <div className="text-4xl font-extrabold text-orange-400 mx-8">
                      {result === "Upcoming" ? "VS" : `${myScore ?? "—"} - ${oppScore ?? "—"}`}
                    </div>

                    {/* Opponent */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 overflow-hidden rounded-full ring-1 ring-gray-500/50">
                        <Image
                          src={opponent?.logo ?? "/logo.jpg"}
                          alt={`${opponent?.name ?? "Opponent"} logo`}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      <p className="text-gray-300 text-lg">{opponent?.name ?? "—"}</p>
                    </div>
                  </div>

                  {/* Result */}
                  <span
                    className={[
                      "mt-4 inline-flex items-center rounded-full px-4 py-2 text-lg font-semibold",
                      result === "Win"
                        ? "bg-emerald-900/30 text-emerald-300 border border-emerald-600/50"
                        : result === "Loss"
                        ? "bg-rose-900/30 text-rose-300 border border-rose-600/50"
                        : result === "Draw"
                        ? "bg-slate-900/30 text-slate-300 border border-slate-600/50"
                        : "bg-orange-900/30 text-orange-300 border border-orange-600/50", // Upcoming
                    ].join(" ")}
                  >
                    {result}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}