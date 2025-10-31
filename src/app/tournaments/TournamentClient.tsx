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
  <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="h-12 w-2/3 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse"
          />
        ))}
      </div>
    </div>
  </div>
);

const TournamentClient: React.FC<TournamentClientProps> = ({ initialData }) => {
  const {
    tournament,
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
      });

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Tournament Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-xl"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
          
          <div className="relative px-8 py-10 md:px-12 md:py-14">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Left side - Title */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  {tournament.status === 'running' ? 'Σε Εξέλιξη' : 
                   tournament.status === 'completed' ? 'Ολοκληρωμένο' : 
                   'Προγραμματισμένο'}
                </div>
                
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
                  {tournament.name}
                </h1>
                
                {tournament.season && (
                  <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
                    Σεζόν {tournament.season}
                  </p>
                )}
              </div>

              {/* Right side - Stats */}
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {initialData.teams.length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">
                    Ομάδες
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-purple-600 dark:text-purple-400">
                    {sortedStages.length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">
                    Στάδια
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400">
                    {initialData.matches.length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">
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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Στάδια Τουρνουά
            </h2>
            {sortedStages.length > 0 && (
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {sortedStages.length} {sortedStages.length === 1 ? 'στάδιο' : 'στάδια'}
              </span>
            )}
          </div>

          {sortedStages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                Δεν υπάρχουν στάδια ακόμα
              </p>
              <p className="text-slate-600 dark:text-slate-400">
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
                      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                        {/* Stage Header */}
                        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/50 dark:to-transparent">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                  {stage.name}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  {stage.kind === 'league' && 'Πρωτάθλημα'}
                                  {stage.kind === 'groups' && 'Όμιλοι'}
                                  {stage.kind === 'knockout' && 'Νοκ-άουτ'}
                                  {stage.kind === 'mixed' && 'Μικτό'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
                              {stage.kind === 'league' && '👥'}
                              {stage.kind === 'groups' && '👥'}
                              {stage.kind === 'knockout' && '🏆'}
                              {stage.kind === 'mixed' && '🎯'}
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
      </div>
    </div>
  );
};

export default TournamentClient;






