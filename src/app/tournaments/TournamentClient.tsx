"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Trophy,
  Users,
  Layers,
  Swords,
  Crown,
  Calendar,
  ChevronRight,
  Star,
  Shield,
} from "lucide-react";
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

/* ─── Animated Number Counter ─── */
function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = value;
    if (end === 0) { setCount(0); return; }
    const stepTime = Math.max(Math.floor((duration * 1000) / end), 16);
    const timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start >= end) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [isInView, value, duration]);

  return <span ref={ref} className="tabular-nums">{count}</span>;
}

/* ─── Skeleton ─── */
const Skeleton: React.FC = () => (
  <div className="min-h-screen bg-black">
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 sm:p-12 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="space-y-3 flex-1">
            <div className="h-5 w-28 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-14 w-96 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-5 w-20 rounded-lg bg-white/[0.06] animate-pulse" />
          </div>
          <div className="flex gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-32 h-28 rounded-2xl bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
      <div className="h-7 w-48 rounded-lg bg-white/[0.06] animate-pulse mb-6" />
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-64 rounded-2xl bg-white/[0.06] animate-pulse mb-6" />
      ))}
    </div>
  </div>
);

/* ─── Status config ─── */
const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }> = {
  scheduled: {
    label: "Προγραμματισμένο",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    dot: "bg-zinc-400",
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
  running: {
    label: "Σε Εξέλιξη",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-400",
    icon: <Swords className="w-3.5 h-3.5" />,
  },
  completed: {
    label: "Ολοκληρώθηκε",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-400",
    icon: <Trophy className="w-3.5 h-3.5" />,
  },
  archived: {
    label: "Αρχειοθετημένο",
    color: "text-zinc-500",
    bg: "bg-zinc-800/50 border-zinc-700/30",
    dot: "bg-zinc-600",
    icon: <Shield className="w-3.5 h-3.5" />,
  },
};

const stageKindConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  league: { label: "Πρωτάθλημα", icon: <Trophy className="w-4 h-4" />, color: "from-emerald-500 to-emerald-600" },
  groups: { label: "Όμιλοι", icon: <Users className="w-4 h-4" />, color: "from-blue-500 to-blue-600" },
  knockout: { label: "Νοκ Άουτ", icon: <Swords className="w-4 h-4" />, color: "from-red-500 to-red-600" },
  mixed: { label: "Μικτό", icon: <Layers className="w-4 h-4" />, color: "from-purple-500 to-purple-600" },
};

const formatConfig: Record<string, string> = {
  league: "Πρωτάθλημα",
  groups: "Ομιλοι",
  knockout: "Νοκ Άουτ",
  mixed: "Μικτό Σύστημα",
};

/* ─── Floating Geometric Shapes ─── */
function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Top-left large ring */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full border border-emerald-500/[0.04] animate-[spin_60s_linear_infinite]" />
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full border border-emerald-500/[0.03] animate-[spin_45s_linear_infinite_reverse]" />
      {/* Bottom-right accent */}
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full border border-emerald-500/[0.03] animate-[spin_80s_linear_infinite]" />
      {/* Small floating diamonds */}
      <motion.div
        className="absolute top-1/4 right-1/4 w-3 h-3 bg-emerald-500/10 rotate-45"
        animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-2/3 left-1/5 w-2 h-2 bg-emerald-400/10 rotate-45"
        animate={{ y: [0, 15, 0], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-1/2 right-1/6 w-2.5 h-2.5 bg-emerald-300/8 rotate-45"
        animate={{ y: [0, -12, 0], opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
    </div>
  );
}

/* ─── Champion Spotlight ─── */
function ChampionSpotlight({ team, tournament }: { team: Team | undefined; tournament: Tournament }) {
  if (!team || tournament.status !== "completed") return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] via-black/40 to-emerald-500/[0.04] backdrop-blur-xl"
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,215,0,0.03)_50%,transparent_75%)] bg-[length:250%_100%] animate-[shimmer_4s_ease-in-out_infinite]" />

      <div className="relative px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          {/* Trophy icon */}
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <Crown className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400" />
            </div>
            <motion.div
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Star className="w-3.5 h-3.5 text-black" fill="currentColor" />
            </motion.div>
          </div>

          <div className="text-center sm:text-left flex-1">
            <p className="text-xs sm:text-sm font-semibold text-amber-400/70 uppercase tracking-[0.2em] mb-2">
              Πρωταθλητής
            </p>
            <h3 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              {team.name}
            </h3>
            <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-sm text-white/40">
              <span>{team.wins}Ν {team.draws}Ι {team.losses}Η</span>
              <span className="text-white/10">|</span>
              <span>{team.goalsFor} γκολ</span>
              <span className="text-white/10">|</span>
              <span>{team.points} βαθμοί</span>
            </div>
          </div>

          {/* Team logo */}
          {team.logo && (
            <div className="flex-shrink-0">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent" />
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-full h-full object-contain rounded-2xl p-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Stage Tab Button ─── */
function StageTab({
  stage,
  index,
  isActive,
  onClick,
}: {
  stage: Stage;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const kind = stageKindConfig[stage.kind] ?? { label: stage.kind, icon: <Layers className="w-4 h-4" />, color: "from-zinc-500 to-zinc-600" };

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
        isActive
          ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-[0_4px_24px_-4px_rgba(16,185,129,0.15)]"
          : "text-white/40 hover:text-white/70 hover:bg-white/[0.03] border border-transparent"
      }`}
    >
      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${kind.color} flex items-center justify-center text-white shadow-lg ${
        isActive ? "shadow-emerald-500/20" : "shadow-none opacity-60"
      } transition-all duration-300`}>
        <span className="text-[11px] font-bold">{index + 1}</span>
      </div>
      <span className="hidden sm:inline">{stage.name}</span>
      <span className="sm:hidden">{kind.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeStageIndicator"
          className="absolute -bottom-px left-4 right-4 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}

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
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const stagesRef = useRef<HTMLDivElement>(null);

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

  const scrollToStages = useCallback(() => {
    stagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!tournament || tournament.id !== initialData.tournament.id) return <Skeleton />;

  const status = statusConfig[tournament.status] ?? statusConfig.scheduled;
  const winnerTeam = tournament.winner_team_id
    ? teams?.find((t) => t.id === tournament.winner_team_id)
    : undefined;

  const finishedMatchCount = initialData.matches.filter((m) => m.status === "finished").length;
  const scheduledMatchCount = initialData.matches.filter((m) => m.status === "scheduled").length;

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* ─── Layered Background ─── */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        {/* Primary emerald glow - top */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent_60%)]" />
        {/* Secondary warm glow - bottom right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_85%_90%,rgba(16,185,129,0.04),transparent_50%)]" />
        {/* Subtle center spotlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.01),transparent_60%)]" />
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }} />
      </div>

      <FloatingShapes />

      <div className="relative container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-18 space-y-8">

        {/* ─── Hero Section ─── */}
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.015]"
        >
          {/* Animated gradient border glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/[0.06] to-emerald-500/0 animate-[shimmer_6s_ease-in-out_infinite] bg-[length:200%_100%]" />

          <div className="relative">
            {/* Top bar with breadcrumb & status */}
            <div className="px-6 py-4 sm:px-10 border-b border-white/[0.04] flex items-center justify-between">
              <nav className="flex items-center gap-2 text-xs text-white/30">
                <span className="hover:text-white/50 transition-colors cursor-pointer">Τουρνουά</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-white/60 font-medium">{tournament.name}</span>
              </nav>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${status.bg} ${status.color}`}>
                <span className={`w-2 h-2 rounded-full ${status.dot} ${tournament.status === "running" ? "animate-pulse" : ""}`} />
                {status.icon}
                {status.label}
              </span>
            </div>

            {/* Main hero content */}
            <div className="px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">
                {/* Left: Logo + Title + Meta */}
                <div className="flex items-start gap-5 sm:gap-7 min-w-0">
                  {/* Tournament Logo */}
                  {tournament.logo ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-2 flex items-center justify-center overflow-hidden"
                    >
                      <img
                        src={tournament.logo}
                        alt={tournament.name}
                        className="w-full h-full object-contain"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/10 flex items-center justify-center"
                    >
                      <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500/40" />
                    </motion.div>
                  )}

                  <div className="space-y-3 min-w-0">
                    <motion.h1
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                      className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1]"
                    >
                      <span className="bg-gradient-to-br from-white via-white to-emerald-200/60 bg-clip-text text-transparent">
                        {tournament.name}
                      </span>
                    </motion.h1>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                      className="flex flex-wrap items-center gap-2.5"
                    >
                      {tournament.season && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/[0.04] text-white/50 border border-white/[0.06]">
                          <Calendar className="w-3 h-3" />
                          Σεζόν {tournament.season}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/[0.06] text-emerald-400/70 border border-emerald-500/[0.1]">
                        {formatConfig[tournament.format] ?? tournament.format}
                      </span>
                    </motion.div>
                  </div>
                </div>

                {/* Right: Stat Cards */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="flex gap-3 sm:gap-4 lg:flex-shrink-0"
                >
                  <HeroStatCard
                    icon={<Users className="w-5 h-5" />}
                    value={initialData.teams.length}
                    label="Ομάδες"
                    color="emerald"
                  />
                  <HeroStatCard
                    icon={<Layers className="w-5 h-5" />}
                    value={sortedStages.length}
                    label="Στάδια"
                    color="blue"
                    onClick={scrollToStages}
                  />
                  <HeroStatCard
                    icon={<Swords className="w-5 h-5" />}
                    value={initialData.matches.length}
                    label="Αγώνες"
                    sublabel={finishedMatchCount > 0 ? `${finishedMatchCount} ολοκ.` : undefined}
                    color="purple"
                  />
                </motion.div>
              </div>
            </div>

            {/* Match progress bar (if running) */}
            {tournament.status === "running" && initialData.matches.length > 0 && (
              <div className="px-6 sm:px-10 lg:px-14 pb-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/30 font-medium whitespace-nowrap">
                    Πρόοδος
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.round((finishedMatchCount / initialData.matches.length) * 100)}%`,
                      }}
                      transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <span className="text-xs text-white/40 font-medium tabular-nums whitespace-nowrap">
                    {finishedMatchCount}/{initialData.matches.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.header>

        {/* ─── Champion Spotlight ─── */}
        <ChampionSpotlight team={winnerTeam} tournament={tournament} />

        {/* ─── Stages Section ─── */}
        <motion.section
          ref={stagesRef}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-5"
        >
          {/* Section header with decorative line */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Στάδια Τουρνουά
              </h2>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
          </div>

          {sortedStages.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-6 h-6 text-white/20" />}
              title="Δεν υπάρχουν στάδια ακόμα"
              description="Τα στάδια του τουρνουά θα εμφανιστούν εδώ όταν δημιουργηθούν."
            />
          ) : (
            <>
              {/* Stage Tabs */}
              {sortedStages.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                  {sortedStages.map((stage, index) => (
                    <StageTab
                      key={stage.id}
                      stage={stage}
                      index={index}
                      isActive={activeStageIndex === index}
                      onClick={() => setActiveStageIndex(index)}
                    />
                  ))}
                </div>
              )}

              {/* Active Stage Content */}
              <AnimatePresence mode="wait">
                {sortedStages.map((stage, index) => {
                  if (index !== activeStageIndex) return null;
                  const Renderer = getRendererForStage(stage);
                  const kind = stageKindConfig[stage.kind] ?? { label: stage.kind, icon: <Layers className="w-4 h-4" />, color: "from-zinc-500 to-zinc-600" };

                  return (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-xl overflow-hidden">
                        {/* Stage Header */}
                        <div className="px-5 py-4 sm:px-7 sm:py-5 border-b border-white/[0.04] bg-white/[0.01]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${kind.color} flex items-center justify-center text-white shadow-lg`}>
                                {kind.icon}
                              </div>
                              <div>
                                <h3 className="text-lg sm:text-xl font-bold text-white">
                                  {stage.name}
                                </h3>
                                <p className="text-xs sm:text-sm text-white/35 font-medium">
                                  {kind.label}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/25 font-medium">
                                Στάδιο {index + 1} από {sortedStages.length}
                              </span>
                            </div>
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

              {/* Stage Navigation (bottom) */}
              {sortedStages.length > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setActiveStageIndex((i) => Math.max(0, i - 1))}
                    disabled={activeStageIndex === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeStageIndex === 0
                        ? "text-white/15 cursor-not-allowed"
                        : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Προηγούμενο
                  </button>
                  <div className="flex items-center gap-1.5">
                    {sortedStages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveStageIndex(i)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          i === activeStageIndex
                            ? "bg-emerald-500 w-6"
                            : "bg-white/[0.1] hover:bg-white/[0.2]"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveStageIndex((i) => Math.min(sortedStages.length - 1, i + 1))}
                    disabled={activeStageIndex === sortedStages.length - 1}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeStageIndex === sortedStages.length - 1
                        ? "text-white/15 cursor-not-allowed"
                        : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    Επόμενο
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </motion.section>

        {/* ─── Player Statistics ─── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          {players && teams ? (
            <PlayerStatistics players={players} teams={teams} />
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3 animate-pulse">
                <Users className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-white/30 text-sm">Φόρτωση στατιστικών παικτών...</p>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
};

/* ─── Hero Stat Card ─── */
function HeroStatCard({
  icon,
  value,
  label,
  sublabel,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  sublabel?: string;
  color: "emerald" | "blue" | "purple";
  onClick?: () => void;
}) {
  const colorMap = {
    emerald: {
      iconBg: "bg-emerald-500/10 text-emerald-400",
      value: "text-emerald-400",
      ring: "ring-emerald-500/10",
    },
    blue: {
      iconBg: "bg-blue-500/10 text-blue-400",
      value: "text-blue-400",
      ring: "ring-blue-500/10",
    },
    purple: {
      iconBg: "bg-purple-500/10 text-purple-400",
      value: "text-purple-400",
      ring: "ring-purple-500/10",
    },
  };

  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex-1 min-w-[100px] rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-center transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.1] hover:shadow-lg ring-1 ${c.ring} ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${c.iconBg} mb-2`}>
        {icon}
      </div>
      <div className={`text-3xl sm:text-4xl font-extrabold ${c.value}`}>
        <AnimatedCounter value={value} />
      </div>
      <div className="text-xs sm:text-sm text-white/35 font-medium mt-0.5">
        {label}
      </div>
      {sublabel && (
        <div className="text-[10px] text-white/20 mt-0.5">{sublabel}</div>
      )}
    </button>
  );
}

/* ─── Empty State ─── */
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-16 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-base font-medium text-white/40 mb-1">{title}</p>
      <p className="text-sm text-white/25">{description}</p>
    </div>
  );
}

export default TournamentClient;
