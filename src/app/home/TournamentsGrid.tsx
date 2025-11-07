"use client";

import Link from "next/link";
import type { Tournament } from "@/app/tournaments/useTournamentData";

type TournamentsGridProps = {
  tournaments: Tournament[];
};

const TournamentsGrid: React.FC<TournamentsGridProps> = ({ tournaments }) => {
  return (
    <section className="relative text-white">
      <div className="container mx-auto px-4">
        <header className="mb-8 flex items-end justify-between">
          <h2 className="text-3xl font-semibold tracking-tight">Διοργανώσεις</h2>
          <Link
            href="/tournaments"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Δείτε όλες →
          </Link>
        </header>

        {tournaments.length === 0 ? (
          <p className="text-center text-neutral-400">No tournaments available</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.id}`}
                aria-label={`View ${tournament.name}`}
                className="group relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 p-6 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:border-white/20">
                  {/* Hover glow */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(300px_140px_at_90%_-10%,rgba(255,255,255,0.15),transparent_60%)]"
                  />

                  <div className="flex items-center gap-4">
                    {tournament.logo ? (
                      <img
                        src={tournament.logo}
                        alt={`${tournament.name} logo`}
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/20"
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-black ring-1 ring-white/20">
                        <span className="text-lg font-semibold">
                          {String(tournament.name || "?")?.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-medium tracking-tight">
                        {tournament.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-300">
                        {tournament.season ? (
                          <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5">
                            Season {tournament.season}
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5">
                            Season N/A
                          </span>
                        )}
                        {tournament.format ? (
                          <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5">
                            {tournament.format}
                          </span>
                        ) : null}
                        {tournament.status ? (
                          <StatusPill status={tournament.status} />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="mt-6 flex items-center justify-between text-sm text-neutral-300">
                    <div className="flex items-center gap-3">
                      <Meta label="Teams" value={String(tournament.teams_count ?? "-")} />
                      <Meta label="Matches" value={String(tournament.matches_count ?? "-")} />
                    </div>
                    <span className="opacity-70">View →</span>
                  </div>

                  {/* Card shine */}
                  <div
                    aria-hidden
                    className="absolute -top-1/2 left-1/2 h-[200%] w-[140%] -translate-x-1/2 rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</span>
      <span className="text-neutral-100">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status?.toLowerCase?.() || "";
  let classes = "bg-neutral-100 text-black"; // default
  if (["live", "ongoing", "active", "running"].includes(s)) classes = "bg-white text-black";
  if (["completed", "finished"].includes(s)) classes = "bg-neutral-800 text-white";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${classes}`}>{status}</span>
  );
}

export default TournamentsGrid;
