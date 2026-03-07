"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  Awards,
  DraftMatch,
  Group,
  Player,
  Stage,
  Standing,
  Team,
  Tournament,
} from "./useTournamentData";
import { useTournamentData } from "./useTournamentData";
import { useStages } from "./useStages";
import { PlayerStatistics } from "./components/PlayerStatistics";

type TournamentClientProps = {
  initialData: {
    tournament: Tournament;
    teams: Team[];
    players: Player[];
    matches: DraftMatch[];
    stages: Stage[];
    standings: Standing[];
    awards: Awards | null;
    groups: Group[];
  };
};

/* ─── Skeleton ─── */
const Skeleton: React.FC = () => (
  <div className="min-h-screen bg-black">
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      {/* Header skeleton */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 sm:p-12 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="space-y-3 flex-1">
            <div className="h-5 w-28 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-12 w-80 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-5 w-20 rounded-lg bg-white/[0.06] animate-pulse" />
          </div>
          <div className="flex gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-28 h-24 rounded-2xl bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Stage skeletons */}
      <div className="h-7 w-48 rounded-lg bg-white/[0.06] animate-pulse mb-6" />
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-64 rounded-2xl bg-white/[0.06] animate-pulse mb-6" />
      ))}

      {/* Player stats skeleton */}
      <div className="h-7 w-52 rounded-lg bg-white/[0.06] animate-pulse mt-10 mb-6" />
      <div className="h-96 rounded-2xl bg-white/[0.06] animate-pulse" />
    </div>
  </div>
);

/* ─── Status config ─── */
const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  scheduled: { label: "Προγραμματισμένο", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20", dot: "bg-zinc-400" },
  running: { label: "Σε Εξέλιξη", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400" },
  completed: { label: "Ολοκληρώθηκε", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400" },
  archived: { label: "Αρχειοθετημένο", color: "text-zinc-500", bg: "bg-zinc-800/50 border-zinc-700/30", dot: "bg-zinc-600" },
};

const stageKindConfig: Record<string, { label: string; emoji: string }> = {
  league: { label: "Πρωτάθλημα", emoji: "🏆" },
  groups: { label: "Όμιλοι", emoji: "👥" },
  knockout: { label: "Νοκ Άουτ", emoji: "⚔️" },
  mixed: { label: "Μικτό", emoji: "🔀" },
};

/* ─── Main Component ─── */
const TournamentClient: React.FC<TournamentClientProps> = ({ initialData }) => {
  const {
    tournament,
    teams,
    players,
    setTournamentData,
    setTeams,
    setPlayers,
    setMatches,
    setStages,
    setStandings,
    setGroups,
  } = useTournamentData();
  const { stages: sortedStages, getRendererForStage } = useStages();

  useEffect(() => {
    if (!tournament || tournament.id !== initialData.tournament.id) {
      setTournamentData(initialData.tournament);
      setTeams(initialData.teams);
      setPlayers(initialData.players);
      setMatches(initialData.matches);
      setStages(initialData.stages);
      setStandings(initialData.standings);
      setGroups(initialData.groups);
    }
  }, [
    initialData,
    tournament,
    setTournamentData,
    setTeams,
    setPlayers,
    setMatches,
    setStages,
    setStandings,
    setGroups,
  ]);

  if (!tournament || tournament.id !== initialData.tournament.id) return <Skeleton />;

  const status = statusConfig[tournament.status] ?? statusConfig.scheduled;

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(16,185,129,0.07),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_90%_80%,rgba(16,185,129,0.03),transparent_50%)]" />
      </div>

      <div className="relative container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 space-y-10">
        {/* ─── Tournament Header ─── */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
        >
          <div className="relative px-6 py-8 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              {/* Left: Title + Status */}
              <div className="space-y-4 min-w-0">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${status.bg} ${status.color}`}>
                  <span className={`w-2 h-2 rounded-full ${status.dot} ${tournament.status === 'running' ? 'animate-pulse' : ''}`} />
                  {status.label}
                </span>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-emerald-200/80 bg-clip-text text-transparent leading-tight">
                  {tournament.name}
                </h1>

                {tournament.season && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-white/[0.04] text-white/50 border border-white/[0.06]">
                    Σεζόν {tournament.season}
                  </span>
                )}
              </div>

              {/* Right: Stats */}
              <div className="flex gap-3 sm:gap-4">
                <StatBlock value={initialData.teams.length} label="Ομάδες" />
                <StatBlock value={sortedStages.length} label="Στάδια" />
                <StatBlock value={initialData.matches.length} label="Αγώνες" />
              </div>
            </div>
          </div>
        </motion.header>

        {/* ─── Stages Section ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Στάδια Τουρνουά
            </h2>
            {sortedStages.length > 0 && (
              <span className="text-sm text-white/40 font-medium">
                {sortedStages.length} {sortedStages.length === 1 ? 'στάδιο' : 'στάδια'}
              </span>
            )}
          </div>

          {sortedStages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-base font-medium text-white/40 mb-1">
                Δεν υπάρχουν στάδια ακόμα
              </p>
              <p className="text-sm text-white/25">
                Τα στάδια του τουρνουά θα εμφανιστούν εδώ όταν δημιουργηθούν.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <AnimatePresence mode="wait">
                {sortedStages.map((stage, index) => {
                  const Renderer = getRendererForStage(stage);
                  const kind = stageKindConfig[stage.kind] ?? { label: stage.kind, emoji: "📋" };

                  return (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_8px_40px_-12px_rgba(16,185,129,0.08)]">
                        {/* Stage Header */}
                        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-white/[0.04] bg-white/[0.01]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500/80 to-emerald-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-emerald-500/20">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="text-lg sm:text-xl font-bold text-white">
                                  {stage.name}
                                </h3>
                                <p className="text-xs sm:text-sm text-white/40 font-medium">
                                  {kind.label}
                                </p>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-white/60">
                              <span>{kind.emoji}</span>
                              <span className="hidden sm:inline capitalize">{stage.kind}</span>
                            </span>
                          </div>
                        </div>

                        {/* Stage Content */}
                        <div className="p-4 sm:p-6">
                          <Renderer stage={stage} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.section>

        {/* ─── Player Statistics ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {players && teams ? (
            <PlayerStatistics players={players} teams={teams} />
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3 animate-pulse">
                <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-white/30 text-sm">Φόρτωση στατιστικών παικτών...</p>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
};

/* ─── Stat Block ─── */
function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 min-w-[90px] rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-center transition-colors duration-200 hover:bg-white/[0.04]">
      <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tabular-nums">
        {value}
      </div>
      <div className="text-xs sm:text-sm text-white/40 font-medium mt-1">
        {label}
      </div>
    </div>
  );
}

export default TournamentClient;
