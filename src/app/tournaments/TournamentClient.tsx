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
    <div className="min-h-screen bg-zinc-950">
      {/* Tournament Header - Contained */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
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
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-900/40 border border-orange-500/50 text-orange-200 text-sm font-medium">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  {tournament.status === 'running' ? 'Σε Εξέλιξη' :
                   tournament.status === 'completed' ? 'Ολοκληρωμένο' :
                   'Προγραμματισμένο'}
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-300">
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
                  <div className="text-3xl md:text-4xl font-bold text-amber-400">
                    {initialData.teams.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Ομάδες
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-amber-400">
                    {sortedStages.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Στάδια
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-amber-400">
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
      </div>

      {/* Individual Stage Sections - Each as a full-width section */}
      {sortedStages.length === 0 ? (
        <div className="container mx-auto max-w-7xl px-4 py-12">
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
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {sortedStages.map((stage, index) => {
            const Renderer = getRendererForStage(stage);

            return (
              <motion.section
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="w-full bg-gradient-to-b from-zinc-900/50 via-zinc-900/30 to-zinc-950 border-y border-orange-500/10 py-12 mt-8"
              >
                <div className="container mx-auto max-w-7xl px-4">
                  <div className="rounded-2xl border border-orange-500/20 bg-zinc-950/60 hover:bg-zinc-950/80 shadow-lg hover:shadow-xl hover:shadow-orange-500/10 transition-all overflow-hidden">
                    {/* Stage Header */}
                    <header className="px-6 py-5 border-b border-orange-500/20 bg-gradient-to-r from-black via-zinc-950 to-black">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_0_1px_rgba(249,115,22,0.3)_inset]">
                            {index + 1}
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-white">
                              {stage.name}
                            </h2>
                            <p className="text-sm text-orange-200/70">
                              {stage.kind === 'league' && 'Πρωτάθλημα'}
                              {stage.kind === 'groups' && 'Όμιλοι'}
                              {stage.kind === 'knockout' && 'Νοκ-άουτ'}
                              {stage.kind === 'mixed' && 'Μικτό'}
                            </p>
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-orange-500/20 text-white text-sm font-medium">
                          {stage.kind === 'league' && '👥'}
                          {stage.kind === 'groups' && '👥'}
                          {stage.kind === 'knockout' && '🏆'}

                          <span className="capitalize">{stage.kind}</span>
                        </div>
                      </div>
                    </header>

                    {/* Stage Content */}
                    <div className="p-6">
                      <Renderer stage={stage} />
                    </div>
                  </div>
                </div>
              </motion.section>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
};

export default TournamentClient;






