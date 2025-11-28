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
  <div className="min-h-screen bg-zinc-950">
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="h-12 w-2/3 rounded-xl bg-zinc-900 animate-pulse" />
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-2xl bg-zinc-900 animate-pulse"
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
    if (!tournament) {
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

  if (!tournament) return <Skeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950">
      {/* Background pattern overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Tournament Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-xl shadow-black/40"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-zinc-950 to-black opacity-60" />

          <div className="relative px-8 py-10 md:px-12 md:py-14">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Left side - Title */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/30 border border-emerald-400/40 text-emerald-200 text-sm font-medium">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  {tournament.status === 'running' ? 'Σε Εξέλιξη' :
                   tournament.status === 'completed' ? 'Ολοκληρωμένο' :
                   'Προγραμματισμένο'}
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-300">
                  {tournament.name}
                </h1>

                {tournament.season && (
                  <p className="text-lg text-white/70 font-medium">
                    Σεζόν {tournament.season}
                  </p>
                )}
              </div>

              {/* Right side - Stats */}
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-emerald-400">
                    {initialData.teams.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Ομάδες
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-emerald-400">
                    {sortedStages.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Στάδια
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-emerald-400">
                    {initialData.matches.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Αγώνες
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Stages Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Στάδια Τουρνουά
            </h2>
            {sortedStages.length > 0 && (
              <span className="text-sm text-white/70">
                {sortedStages.length} {sortedStages.length === 1 ? 'στάδιο' : 'στάδια'}
              </span>
            )}
          </div>

          {sortedStages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border-2 border-dashed border-white/10 bg-black/40 p-12 text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white mb-2">
                Δεν υπάρχουν στάδια ακόμα
              </p>
              <p className="text-white/70">
                Τα στάδια του τουρνουά θα εμφανιστούν εδώ όταν δημιουργηθούν.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {sortedStages.map((stage, index) => {
                  const Renderer = getRendererForStage(stage);

                  return (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 hover:bg-zinc-950/80 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                        {/* Stage Header */}
                        <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-black via-zinc-950 to-black">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_0_1px_rgba(16,185,129,0.3)_inset]">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-white">
                                  {stage.name}
                                </h3>
                                <p className="text-sm text-white/70">
                                  {stage.kind === 'league' && 'Πρωτάθλημα'}
                                  {stage.kind === 'groups' && 'Όμιλοι'}
                                  {stage.kind === 'knockout' && 'Νοκ-άουτ'}
                                  {stage.kind === 'mixed' && 'Μικτό'}
                                </p>
                              </div>
                            </div>

                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/15 text-white text-sm font-medium">
                              {stage.kind === 'league' && '👥'}
                              {stage.kind === 'groups' && '👥'}
                              {stage.kind === 'knockout' && '🏆'}

                              <span className="capitalize">{stage.kind}</span>
                            </div>
                          </div>
                        </div>

                        {/* Stage Content */}
                        <div className="p-6">
                          <Renderer stage={stage} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Player Statistics Section */}
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
            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-white/70">
              <p>Loading player statistics...</p>
              <p className="text-xs mt-2">Players: {players?.length || 0}, Teams: {teams?.length || 0}</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default TournamentClient;






