"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Tournament } from "@/app/tournaments/useTournamentData";

type TournamentsClientProps = {
  initialTournaments: Tournament[];
};

type StatusFilter = "all" | "running" | "completed" | "scheduled";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Όλα" },
  { value: "running", label: "Σε Εξέλιξη" },
  { value: "completed", label: "Ολοκληρωμένα" },
  { value: "scheduled", label: "Προγραμματισμένα" },
];

const TournamentsClient: React.FC<TournamentsClientProps> = ({ initialTournaments }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    return initialTournaments.filter((t) => {
      const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [initialTournaments, search, statusFilter]);

  return (
    <section className="relative min-h-screen bg-black text-white">
      {/* Decorative BG: soft radial glow + subtle gridlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
                   [mask-image:radial-gradient(ellipse_120%_80%_at_50%_30%,#000_20%,transparent_70%)]
                   bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.06)_0_2px,transparent_2px_12px)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_120%_80%_at_50%_20%,#000_20%,transparent_70%)] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      <div className="container mx-auto px-4 py-12">
        <header className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">Διοργάνωσεις</h1>
        </header>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <input
            type="text"
            placeholder="Αναζήτηση διοργάνωσης..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900/80 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
          />
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  statusFilter === f.value
                    ? "bg-white text-black"
                    : "border border-white/10 bg-neutral-900 text-neutral-300 hover:border-white/20 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-neutral-400 py-12">
            {initialTournaments.length === 0
              ? "Δεν υπάρχουν διοργανώσεις"
              : "Δεν βρέθηκαν αποτελέσματα"}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((tournament) => (
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
                      />)
                      : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-black ring-1 ring-white/20">
                        <span className="text-lg font-semibold">
                          {String(tournament.name || "?")?.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-medium tracking-tight">
                        {tournament.name}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-300">
                        {tournament.season ? (
                          <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5">Σεζόν {tournament.season}</span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5">Σεζόν -</span>
                        )}
                        {tournament.format ? (
                          <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5">{tournament.format}</span>
                        ) : null}
                        {tournament.status ? (
                          <StatusPill status={tournament.status} />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Winner row */}
                  {tournament.status === 'completed' && tournament.winner_team_name && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                      <span className="text-yellow-400 text-sm">🏆</span>
                      <span className="text-xs text-yellow-300 font-medium truncate">
                        {tournament.winner_team_name}
                      </span>
                    </div>
                  )}

                  {/* Footer row */}
                  <div className="mt-6 flex items-center justify-between text-sm text-neutral-300">
                    <div className="flex items-center gap-3">
                      <Meta label="Ομάδες" value={String(tournament.teams_count ?? "-")} />
                      <Meta label="Αγώνες" value={String(tournament.matches_count ?? "-")} />
                    </div>
                    <span className="opacity-70">Προβολή →</span>
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
  if (["live", "ongoing", "active"].includes(s)) classes = "bg-white text-black";
  if (["completed", "finished"].includes(s)) classes = "bg-neutral-800 text-white";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${classes}`}>{status}</span>
  );
}

export default TournamentsClient;
