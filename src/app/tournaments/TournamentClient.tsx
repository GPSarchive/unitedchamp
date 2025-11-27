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
import GridBgSection from "@/app/home/GridBgSection";
import LightRays from "@/app/OMADA/[id]/react-bits/LightRays";

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
  <GridBgSection className="min-h-screen bg-zinc-950 text-white">
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
  </GridBgSection>
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
    <div className="relative min-h-screen bg-zinc-950">
      {/* Fixed GridBg background that fits screen */}
      <div className="fixed inset-0 -z-10">
        <GridBgSection
          className="h-screen w-screen"
          baseColor="#1F1B2E"
          activeColor="#F59E0B"
        />
      </div>

      {/* Scrollable content */}
      <div className="relative z-10">
        <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
          {/* Tournament Header - Centered with Logo */}
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

            <div className="relative px-8 py-12 md:px-12 md:py-16">
              {/* Centered Content */}
              <div className="flex flex-col items-center text-center space-y-6">
                {/* Status Badge */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
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

                {/* Tournament Logo with Light Rays */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6, type: "spring", stiffness: 150 }}
                  className="relative"
                >
                  <div className="relative h-40 w-40 sm:h-48 sm:w-48 md:h-56 md:w-56 lg:h-64 lg:w-64">
                    <div className="absolute inset-0 rounded-full bg-black/70 border-2 border-white/15 shadow-[0_0_40px_rgba(0,0,0,0.9)] overflow-hidden">
                      {tournament.logo ? (
                        <LightRays
                          className="h-full w-full rounded-full"
                          raysOrigin="top-center"
                          raysColor="#ffffff"
                          raysSpeed={1.2}
                          lightSpread={0.9}
                          rayLength={1.5}
                          followMouse
                          mouseInfluence={0.16}
                          noiseAmount={0.08}
                          distortion={0.03}
                          logoSrc={tournament.logo}
                          logoStrength={4}
                          logoFit="cover"
                          logoScale={1.0}
                          popIn
                          popDuration={800}
                          popDelay={100}
                          popScaleFrom={0.85}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-red-600 to-amber-600">
                          <GiLaurelCrown className="h-24 w-24 text-white/90" />
                        </div>
                      )}
                    </div>
                    {/* Outer glow ring */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500/20 via-amber-500/20 to-transparent opacity-100 blur-xl -z-10 animate-pulse" />
                  </div>
                </motion.div>

                {/* Tournament Title with Shiny Effect */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="space-y-3"
                >
                  <h1
                    className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight"
                    style={{
                      color: "#b5b5b5a4",
                      background: "linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)",
                      backgroundSize: "200% 100%",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      animation: "shine 5s linear infinite",
                      textShadow: "2px 2px 8px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                    }}
                  >
                    {tournament.name}
                  </h1>

                  {tournament.season && (
                    <p
                      className="text-xl md:text-2xl text-white/80 font-bold uppercase tracking-wide"
                      style={{
                        textShadow: "1px 1px 3px rgba(0,0,0,0.85)",
                      }}
                    >
                      Σεζόν {tournament.season}
                    </p>
                  )}
                </motion.div>

                {/* Stats Row */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="flex flex-wrap justify-center gap-4 md:gap-6 mt-6"
                >
                  <div className="flex flex-col items-center justify-center rounded-2xl px-6 py-4 bg-black/45 border border-white/10 hover:border-red-400/40 hover:bg-black/60 hover:scale-105 transition-all duration-300">
                    <Users className="h-6 w-6 text-red-400 mb-2" />
                    <div className="text-4xl md:text-5xl font-black text-white tabular-nums">
                      {initialData.teams.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/55 font-semibold mt-2">
                      Ομάδες
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-2xl px-6 py-4 bg-black/45 border border-white/10 hover:border-amber-400/40 hover:bg-black/60 hover:scale-105 transition-all duration-300">
                    <Target className="h-6 w-6 text-amber-400 mb-2" />
                    <div className="text-4xl md:text-5xl font-black text-white tabular-nums">
                      {sortedStages.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/55 font-semibold mt-2">
                      Στάδια
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-2xl px-6 py-4 bg-black/45 border border-white/10 hover:border-red-400/40 hover:bg-black/60 hover:scale-105 transition-all duration-300">
                    <GiSoccerBall className="h-6 w-6 text-red-400 mb-2" />
                    <div className="text-4xl md:text-5xl font-black text-white tabular-nums">
                      {initialData.matches.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/55 font-semibold mt-2">
                      Αγώνες
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.header>

          {/* Add keyframes for shine animation */}
          <style jsx global>{`
            @keyframes shine {
              0% { background-position: 100%; }
              100% { background-position: -100%; }
            }
          `}</style>

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
    </div>
  );
};

export default TournamentClient;






