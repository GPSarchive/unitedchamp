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

const Skeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-600/20 via-transparent to-transparent" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent" />

    <div className="relative container mx-auto max-w-7xl px-4 py-8">
      <div className="h-12 w-2/3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 animate-pulse shadow-2xl" />
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 animate-pulse shadow-2xl"
          />
        ))}
      </div>
    </div>
  </div>
);

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
    // Update store if tournament is not loaded OR if the tournament ID has changed
    if (!tournament || tournament.id !== initialData.tournament.id) {
      console.log('[TournamentClient] Hydrating store with:', {
        tournament: initialData.tournament.name,
        stagesCount: initialData.stages.length,
        teamsCount: initialData.teams.length,
        matchesCount: initialData.matches.length,
        standingsCount: initialData.standings.length,
        playersCount: initialData.players.length,
      });

      console.log('[TournamentClient] Players data:', initialData.players);
      console.log('[TournamentClient] Teams data:', initialData.teams);

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

  // Show skeleton if tournament is not loaded OR if the IDs don't match (during navigation)
  if (!tournament || tournament.id !== initialData.tournament.id) return <Skeleton />;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-hidden">
      {/* Multi-layer gradient backgrounds */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-600/20 via-transparent to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-slate-950/50 pointer-events-none" />

      {/* Animated gradient orbs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

      <div className="relative container mx-auto max-w-7xl px-4 py-12 space-y-12">
        {/* Tournament Header - Hero Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/5 via-white/[0.02] to-white/5 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_48px_rgba(99,102,241,0.3)] transition-all duration-500"
        >
          {/* Animated gradient border effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-cyan-500/20 opacity-0 hover:opacity-100 transition-opacity duration-500 blur-xl" />

          {/* Glass morphism background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-purple-950/40 to-slate-950/40" />

          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-400/20 via-transparent to-transparent" />

          <div className="relative px-8 py-12 md:px-16 md:py-16">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              {/* Left side - Title & Status */}
              <div className="space-y-4 flex-1">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30 border border-indigo-400/50 text-white text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                  {tournament.status === 'running' ? 'Σε Εξέλιξη' :
                   tournament.status === 'completed' ? 'Ολοκληρωμένο' :
                   'Προγραμματισμένο'}
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-purple-300 drop-shadow-[0_0_30px_rgba(99,102,241,0.5)]"
                >
                  {tournament.name}
                </motion.h1>

                {tournament.season && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl text-white/80 font-semibold flex items-center gap-2"
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    Σεζόν {tournament.season}
                  </motion.p>
                )}
              </div>

              {/* Right side - Stats Cards */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex gap-4 md:gap-6"
              >
                {[
                  { value: initialData.teams.length, label: 'Ομάδες', gradient: 'from-indigo-500 to-indigo-600', icon: '👥' },
                  { value: sortedStages.length, label: 'Στάδια', gradient: 'from-purple-500 to-purple-600', icon: '🎯' },
                  { value: initialData.matches.length, label: 'Αγώνες', gradient: 'from-cyan-500 to-cyan-600', icon: '⚽' }
                ].map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative text-center px-6 py-4 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 group-hover:border-white/40 transition-all shadow-xl group-hover:scale-105 group-hover:-translate-y-1 duration-300">
                      <div className="text-2xl mb-2">{stat.icon}</div>
                      <div className={`text-4xl md:text-5xl font-black bg-gradient-to-br ${stat.gradient} text-transparent bg-clip-text drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]`}>
                        {stat.value}
                      </div>
                      <div className="text-xs md:text-sm text-white/70 font-bold mt-2 tracking-wide uppercase">
                        {stat.label}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.header>

        {/* Stages Section */}
        <section className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-12 rounded-full bg-gradient-to-b from-indigo-500 via-purple-500 to-cyan-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
              <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-300">
                Στάδια Τουρνουά
              </h2>
            </div>
            {sortedStages.length > 0 && (
              <span className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/20 text-sm font-semibold text-white/80">
                {sortedStages.length} {sortedStages.length === 1 ? 'στάδιο' : 'στάδια'}
              </span>
            )}
          </motion.div>

          {sortedStages.length === 0 ? (
            <motion.article
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="rounded-3xl border-2 border-dashed border-white/20 backdrop-blur-2xl bg-gradient-to-br from-white/5 via-white/[0.02] to-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-16 text-center"
            >
              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                <svg className="w-10 h-10 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-white mb-3">
                Δεν υπάρχουν στάδια ακόμα
              </p>
              <p className="text-white/60 text-lg">
                Τα στάδια του τουρνουά θα εμφανιστούν εδώ όταν δημιουργηθούν.
              </p>
            </motion.article>
          ) : (
            <div className="space-y-8">
              <AnimatePresence mode="wait">
                {sortedStages.map((stage, index) => {
                  const Renderer = getRendererForStage(stage);
                  const stageColors = {
                    league: { gradient: 'from-indigo-500 to-indigo-700', shadow: 'rgba(99,102,241,0.4)', icon: '👥' },
                    groups: { gradient: 'from-purple-500 to-purple-700', shadow: 'rgba(168,85,247,0.4)', icon: '🎯' },
                    knockout: { gradient: 'from-cyan-500 to-cyan-700', shadow: 'rgba(34,211,238,0.4)', icon: '🏆' },
                    mixed: { gradient: 'from-pink-500 to-pink-700', shadow: 'rgba(236,72,153,0.4)', icon: '✨' }
                  };
                  const colors = stageColors[stage.kind as keyof typeof stageColors] || stageColors.league;

                  return (
                    <motion.article
                      key={stage.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -30 }}
                      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
                      className="group"
                    >
                      <div className="relative rounded-3xl border border-white/20 backdrop-blur-2xl bg-gradient-to-br from-white/5 via-white/[0.02] to-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_48px] transition-all duration-500 overflow-hidden"
                        style={{ '--tw-shadow-color': colors.shadow } as React.CSSProperties}
                      >
                        {/* Hover gradient effect */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                        {/* Stage Header */}
                        <header className="relative px-8 py-6 border-b border-white/10 bg-gradient-to-r from-white/[0.03] via-white/[0.05] to-white/[0.03] backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white font-black text-xl shadow-[0_0_30px] transition-all group-hover:scale-110 group-hover:rotate-3 duration-300`}
                                style={{ boxShadow: `0 0 30px ${colors.shadow}` }}
                              >
                                <span className="relative z-10">{index + 1}</span>
                                <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
                                  {stage.name}
                                </h3>
                                <p className="text-sm text-white/60 font-semibold mt-1">
                                  {stage.kind === 'league' && 'Πρωτάθλημα'}
                                  {stage.kind === 'groups' && 'Όμιλοι'}
                                  {stage.kind === 'knockout' && 'Νοκ-άουτ'}
                                  {stage.kind === 'mixed' && 'Μικτό'}
                                </p>
                              </div>
                            </div>

                            <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-br ${colors.gradient} bg-opacity-20 backdrop-blur-xl border border-white/30 text-white text-sm font-bold shadow-lg transition-all group-hover:scale-105 duration-300`}>
                              <span className="text-lg">{colors.icon}</span>
                              <span className="capitalize tracking-wide">{stage.kind}</span>
                            </div>
                          </div>
                        </header>

                        {/* Stage Content */}
                        <div className="p-8 bg-gradient-to-br from-black/10 via-transparent to-black/10">
                          <Renderer stage={stage} />
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Player Statistics Section */}
        <section>
          {(() => {
            console.log('[TournamentClient] Rendering PlayerStatistics section:', {
              hasPlayers: !!players,
              playersLength: players?.length || 0,
              hasTeams: !!teams,
              teamsLength: teams?.length || 0,
            });

            if (players && teams) {
              return (
                <PlayerStatistics
                  players={players}
                  teams={teams}
                />
              );
            }

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border border-white/20 backdrop-blur-2xl bg-gradient-to-br from-white/5 via-white/[0.02] to-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-12 text-center"
              >
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
                <p className="text-lg font-semibold text-white/80 mb-2">Loading player statistics...</p>
                <p className="text-sm text-white/50">Players: {players?.length || 0}, Teams: {teams?.length || 0}</p>
              </motion.div>
            );
          })()}
        </section>
      </div>
    </main>
  );
};

export default TournamentClient;






