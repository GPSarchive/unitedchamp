import Image from "next/image";
import Link from "next/link";
import type { Match } from "@/app/lib/types";

interface MatchesSectionProps {
  matches: Match[] | null;
  teamId: number;
  errorMessage?: string | null;
}

/** Stable date formatting (no hydration mismatches) */
const dtf = new Intl.DateTimeFormat("el-GR", {
  dateStyle: "medium",
  timeZone: "Europe/Athens",
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
    <section className="mb-12 border border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-transparent p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Matches</h2>

      {errorMessage ? (
        <p className="text-red-400">Error loading matches: {errorMessage}</p>
      ) : !matches || matches.length === 0 ? (
        <p className="text-gray-400">No matches recorded for this team.</p>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const teamA = match.team_a ?? null;
            const teamB = match.team_b ?? null;

            const isTeamA = teamA?.id === teamId;
            const isTeamB = teamB?.id === teamId;

            // Choose opponent safely; if our team isn't on either side, show whichever exists.
            const opponent = isTeamA ? teamB : isTeamB ? teamA : teamA ?? teamB;
            const opponentName = opponent?.name ?? "—";
            const opponentLogo = opponent?.logo ?? null;

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

            // Match['status'] is likely "scheduled" | "finished" (no "live")
            type Result = "Win" | "Loss" | "Draw" | "Upcoming";
            let result: Result;
            if (match.status === "finished") {
              if (match.winner_team_id == null) result = "Draw";
              else if (match.winner_team_id === teamId) result = "Win";
              else result = "Loss";
            } else {
              // treat anything not "finished" as upcoming to satisfy the narrower type
              result = "Upcoming";
            }

            const whenText = formatDate(match.match_date);

            return (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                aria-label={`Match vs ${opponentName} on ${whenText}`}
                className="group block rounded-xl p-4 border border-orange-400/20 bg-orange-500/5 shadow-md hover:shadow-lg hover:border-orange-400/40 transition
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {opponentLogo ? (
                      <Image
                        src={opponentLogo}
                        alt={`${opponentName} logo`}
                        width={40}
                        height={40}
                        className="rounded-full ring-1 ring-orange-400/30"
                      />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-full ring-1 ring-orange-400/30 bg-orange-500/10"
                        aria-hidden
                      />
                    )}
                    <div>
                      <p className="text-white font-semibold group-hover:underline">
                        vs {opponentName}
                      </p>
                      <p className="text-gray-300 text-sm">
                        <time dateTime={match.match_date ?? undefined}>
                          {whenText}
                        </time>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-sm",
                        result === "Win"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : result === "Loss"
                          ? "bg-rose-500/10 text-rose-300"
                          : result === "Draw"
                          ? "bg-slate-500/10 text-slate-300"
                          : "bg-orange-500/10 text-orange-300", // Upcoming
                      ].join(" ")}
                    >
                      {result}
                    </span>

                    {match.status === "finished" &&
                      isFiniteNumber(myScore) &&
                      isFiniteNumber(oppScore) && (
                        <p className="text-white font-bold">
                          {myScore} - {oppScore}
                        </p>
                      )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
