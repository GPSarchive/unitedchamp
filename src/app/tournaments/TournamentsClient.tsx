"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import type { Tournament } from "@/app/tournaments/useTournamentData";

type TournamentsClientProps = {
  initialTournaments: Tournament[];
};

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  scheduled: { label: "Προγραμματισμένο", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20", dot: "bg-zinc-400" },
  running: { label: "Σε Εξέλιξη", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  completed: { label: "Ολοκληρώθηκε", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400" },
  archived: { label: "Αρχειοθετημένο", color: "text-zinc-500", bg: "bg-zinc-800/50 border-zinc-700/30", dot: "bg-zinc-600" },
};

const formatLabels: Record<string, string> = {
  league: "League",
  groups: "Groups",
  knockout: "Knockout",
  mixed: "Mixed",
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const TournamentsClient: React.FC<TournamentsClientProps> = ({ initialTournaments }) => {
  return (
    <section className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Background effects */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(16,185,129,0.04),transparent_50%)]"
      />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        {/* Page Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 sm:mb-16"
        >
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            Τουρνουά
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-white/50 max-w-xl font-light">
            Ανακάλυψε τα τουρνουά, τους αγώνες και τα αποτελέσματα.
          </p>
        </motion.header>

        {initialTournaments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-white/40 text-lg">Δεν υπάρχουν διαθέσιμα τουρνουά</p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {initialTournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
};

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const status = statusConfig[tournament.status] ?? statusConfig.scheduled;

  return (
    <motion.div variants={cardVariants}>
      <Link
        href={`/tournaments/${tournament.id}`}
        aria-label={`View ${tournament.name}`}
        className="group relative block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-2xl"
      >
        <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:border-emerald-500/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_20px_60px_-12px_rgba(16,185,129,0.15)]">
          {/* Hover glow gradient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(600px_300px_at_50%_0%,rgba(16,185,129,0.06),transparent_70%)]"
          />

          {/* Card content */}
          <div className="relative p-6">
            {/* Top: Logo + Status */}
            <div className="flex items-start justify-between mb-5">
              {tournament.logo ? (
                <img
                  src={tournament.logo}
                  alt={`${tournament.name} logo`}
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 ring-1 ring-emerald-500/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                  <span className="text-xl font-bold text-emerald-400">
                    {String(tournament.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${status.bg} ${status.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${tournament.status === 'running' ? 'animate-pulse' : ''}`} />
                {status.label}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold tracking-tight text-white mb-3 line-clamp-2 transition-colors duration-300 group-hover:text-emerald-50">
              {tournament.name}
            </h2>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {tournament.season && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">
                  Σεζόν {tournament.season}
                </span>
              )}
              {tournament.format && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-white/60 border border-white/[0.06]">
                  {formatLabels[tournament.format] || tournament.format}
                </span>
              )}
            </div>

            {/* Footer: Stats + View */}
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
              <div className="flex items-center gap-4">
                <StatItem label="Ομάδες" value={tournament.teams_count ?? "0"} />
                <StatItem label="Αγώνες" value={tournament.matches_count ?? "0"} />
              </div>
              <span className="text-xs text-white/30 font-medium transition-all duration-300 group-hover:text-emerald-400 group-hover:translate-x-0.5">
                Προβολή →
              </span>
            </div>
          </div>

          {/* Animated shine sweep */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-700 ease-out group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
          />
        </div>
      </Link>
    </motion.div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">{label}</span>
      <span className="text-sm font-semibold text-white/70">{value}</span>
    </div>
  );
}

export default TournamentsClient;
