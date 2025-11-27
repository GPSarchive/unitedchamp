"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Calendar, Target, Award, Flame } from "lucide-react";
import { GiTrophy, GiLaurelCrown, GiSoccerBall } from "react-icons/gi";
import { MdEmojiEvents } from "react-icons/md";
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
import VantaBg from "@/app/lib/VantaBg";

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
  <div className="min-h-screen bg-zinc-950 text-white">
    <VantaBg className="fixed inset-0 -z-10" mode="eco" />
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="h-12 w-2/3 rounded-xl bg-white/10 animate-pulse" />
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-2xl bg-white/10 border border-white/20 animate-pulse"
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
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      {/* Page content */}
      <div className="relative z-10">
        <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
          {/* Tournament Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-white/12 bg-black/55 shadow-[0_24px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            {/* Subtle glow at the top */}
            <div className="pointer-events-none absolute inset-x-8 -top-8 h-12 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.7),transparent_60%)] opacity-50" />

            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(248,250,252,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(239,68,68,0.33),transparent_55%)]" />

            {/* Decorative corner accents */}
            <div className="pointer-events-none absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-transparent rounded-tl-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-amber-500/10 to-transparent rounded-br-3xl" />
          
            <div className="relative px-8 py-10 md:px-12 md:py-14">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left side - Title */}
                <div className="space-y-3">
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-4 py-1.5"
                  >
                    <GiTrophy className="h-4 w-4 text-red-400" />
                    <span className="text-[10px] tracking-[0.18em] uppercase text-white/70 font-semibold">
                      {tournament.status === 'running' ? 'Σε Εξέλιξη' :
                       tournament.status === 'completed' ? 'Ολοκληρωμένο' :
                       'Προγραμματισμένο'}
                    </span>
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  </motion.div>

                  <motion.h1
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white"
                    style={{
                      textShadow:
                        "2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                    }}
                  >
                    {tournament.name}
                  </motion.h1>

                  {tournament.season && (
                    <motion.p
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      className="text-lg text-white/80 font-medium"
                      style={{
                        textShadow: "1px 1px 3px rgba(0,0,0,0.85)",
                      }}
                    >
                      Σεζόν {tournament.season}
                    </motion.p>
                  )}
                </div>

                {/* Right side - Stats */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="flex gap-4 md:gap-6"
                >
                  <div className="flex flex-col items-center justify-center rounded-2xl px-4 py-3 bg-black/45 border border-white/10 hover:border-red-400/40 hover:bg-black/60 transition-all duration-300">
                    <Users className="h-5 w-5 text-red-400 mb-1" />
                    <div className="text-3xl md:text-4xl font-black text-white tabular-nums">
                      {initialData.teams.length}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.16em] text-white/55 font-semibold mt-1">
                      Ομάδες
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-2xl px-4 py-3 bg-black/45 border border-white/10 hover:border-amber-400/40 hover:bg-black/60 transition-all duration-300">
                    <Target className="h-5 w-5 text-amber-400 mb-1" />
                    <div className="text-3xl md:text-4xl font-black text-white tabular-nums">
                      {sortedStages.length}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.16em] text-white/55 font-semibold mt-1">
                      Στάδια
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-2xl px-4 py-3 bg-black/45 border border-white/10 hover:border-red-400/40 hover:bg-black/60 transition-all duration-300">
                    <GiSoccerBall className="h-5 w-5 text-red-400 mb-1" />
                    <div className="text-3xl md:text-4xl font-black text-white tabular-nums">
                      {initialData.matches.length}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.16em] text-white/55 font-semibold mt-1">
                      Αγώνες
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.header>

          {/* Stages Section */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Trophy className="h-7 w-7 text-amber-400" />
                <h2
                  className="text-3xl font-black text-white"
                  style={{
                    textShadow:
                      "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000",
                  }}
                >
                  Στάδια Τουρνουά
                </h2>
              </div>
              {sortedStages.length > 0 && (
                <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <span className="text-xs font-bold text-white">
                    {sortedStages.length} {sortedStages.length === 1 ? 'στάδιο' : 'στάδια'}
                  </span>
                </div>
              )}
            </motion.div>

            {sortedStages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="rounded-2xl border-2 border-dashed border-white/20 bg-black/30 backdrop-blur-sm p-12 text-center"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center mb-4">
                  <Trophy className="w-8 h-8 text-white/40" />
                </div>
                <p className="text-lg font-bold text-white mb-2"
                  style={{
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
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
                        transition={{
                          duration: 0.5,
                          delay: 0.8 + index * 0.1,
                          type: "spring",
                          stiffness: 150,
                        }}
                        whileHover={{
                          scale: 1.01,
                          transition: { duration: 0.2 }
                        }}
                      >
                        <div className="rounded-3xl border border-white/20 bg-black/70 backdrop-blur-xl shadow-2xl hover:shadow-[0_0_40px_rgba(239,68,68,0.2)] hover:border-red-400/40 transition-all duration-300 overflow-hidden group">
                          {/* Stage Header */}
                          <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-black/50 to-transparent relative overflow-hidden">
                            {/* Animated glow overlay on hover */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-red-500/10 via-transparent to-amber-500/10 pointer-events-none" />

                            <div className="relative flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                                  {index + 1}
                                </div>
                                <div>
                                  <h3
                                    className="text-xl font-black text-white group-hover:text-amber-400 transition-colors duration-300"
                                    style={{
                                      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                                    }}
                                  >
                                    {stage.name}
                                  </h3>
                                  <p className="text-sm text-white/70 font-medium">
                                    {stage.kind === 'league' && 'Πρωτάθλημα'}
                                    {stage.kind === 'groups' && 'Όμιλοι'}
                                    {stage.kind === 'knockout' && 'Νοκ-άουτ'}
                                    {stage.kind === 'mixed' && 'Μικτό'}
                                  </p>
                                </div>
                              </div>

                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/20 text-white text-sm font-semibold">
                                {stage.kind === 'league' && <Users className="h-4 w-4 text-red-400" />}
                                {stage.kind === 'groups' && <Users className="h-4 w-4 text-red-400" />}
                                {stage.kind === 'knockout' && <GiLaurelCrown className="h-4 w-4 text-amber-400" />}
                                {stage.kind === 'mixed' && <Flame className="h-4 w-4 text-red-400" />}
                                <span className="capitalize text-xs tracking-wider">{stage.kind}</span>
                              </div>
                            </div>
                          </div>

                          {/* Stage Content */}
                          <div className="p-6 bg-gradient-to-br from-black/40 via-black/30 to-black/40">
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
    </section>
  );
};

export default TournamentClient;






