import Image from "next/image";
import Link from "next/link";
import type { Match } from "@/app/lib/types";

interface MatchesSectionProps {
  matches: Match[] | null;
  teamId: number;
  errorMessage?: string | null;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

export default function MatchesSection({
  matches,
  teamId,
  errorMessage,
}: MatchesSectionProps) {
  return (
    <section className="mb-12  border border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-transparent p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Matches</h2>

      {errorMessage ? (
        <p className="text-red-400">Error loading matches: {errorMessage}</p>
      ) : !matches || matches.length === 0 ? (
        <p className="text-gray-400">No matches recorded for this team.</p>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const isTeamA = match.team_a.id === teamId;
            const opponent = isTeamA ? match.team_b : match.team_a;
            const myScore = isTeamA ? match.team_a_score : match.team_b_score;
            const oppScore = isTeamA ? match.team_b_score : match.team_a_score;

            let result = "";
            if (match.status === "finished") {
              if (match.winner_team_id === teamId) result = "Win";
              else if (match.winner_team_id === null) result = "Draw";
              else result = "Loss";
            } else {
              result = "Upcoming";
            }

            return (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                aria-label={`Match vs ${opponent.name} on ${formatDate(match.match_date)}`}
                className="group block rounded-xl p-4 border border-orange-400/20 bg-orange-500/5 shadow-md hover:shadow-lg hover:border-orange-400/40 transition
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {opponent.logo && (
                      <Image
                        src={opponent.logo}
                        alt={`${opponent.name} logo`}
                        width={40}
                        height={40}
                        className="rounded-full ring-1 ring-orange-400/30"
                      />
                    )}
                    <div>
                      <p className="text-white font-semibold group-hover:underline">
                        vs {opponent.name}
                      </p>
                      <p className="text-gray-300 text-sm">
                        {formatDate(match.match_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-sm text-orange-300">
                      {result}
                    </span>
                    {match.status === "finished" && (
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
