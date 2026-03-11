// components/TopScorers.tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import CardSwap, { Card } from '@/components/CardSwap';

interface TopPlayerData {
  id: number;
  firstName: string;
  lastName: string;
  photo: string;
  goals: number;
  assists: number;
  matches: number;
  teamName?: string;
  teamLogo?: string;
}

interface TopScorersProps {
  scorers: TopPlayerData[];
  assistLeaders: TopPlayerData[];
}

// --- Rank Configuration for Scorers (Orange/Amber) ---
const scorerRankStyles = [
  {
    border: 'border-amber-400/40',
    text: 'text-amber-400',
    badge: 'bg-gradient-to-br from-amber-400 to-yellow-300',
    divider: 'from-amber-400/50',
    label: 'LEAGUE LEADER',
    rankColor: 'text-black/80',
  },
  {
    border: 'border-slate-300/40',
    text: 'text-slate-300',
    badge: 'bg-gradient-to-br from-slate-300 to-gray-200',
    divider: 'from-slate-300/50',
    label: '2η Θέση',
    rankColor: 'text-black/70',
  },
  {
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    badge: 'bg-gradient-to-br from-orange-500 to-orange-400',
    divider: 'from-orange-500/50',
    label: '3η Θέση',
    rankColor: 'text-black/80',
  },
  {
    border: 'border-white/10',
    text: 'text-white/40',
    badge: 'bg-white/10',
    divider: 'from-white/20',
    label: 'CONTENDER',
    rankColor: 'text-white',
  }
];

// --- Rank Configuration for Assists (Cyan/Blue) ---
const assistRankStyles = [
  {
    border: 'border-cyan-400/40',
    text: 'text-cyan-400',
    badge: 'bg-gradient-to-br from-cyan-400 to-blue-300',
    divider: 'from-cyan-400/50',
    label: 'LEAGUE LEADER',
    rankColor: 'text-black/80',
  },
  {
    border: 'border-slate-300/40',
    text: 'text-slate-300',
    badge: 'bg-gradient-to-br from-slate-300 to-gray-200',
    divider: 'from-slate-300/50',
    label: '2η Θέση',
    rankColor: 'text-black/70',
  },
  {
    border: 'border-blue-500/40',
    text: 'text-blue-400',
    badge: 'bg-gradient-to-br from-blue-500 to-blue-400',
    divider: 'from-blue-500/50',
    label: '3η Θέση',
    rankColor: 'text-black/80',
  },
  {
    border: 'border-white/10',
    text: 'text-white/40',
    badge: 'bg-white/10',
    divider: 'from-white/20',
    label: 'CONTENDER',
    rankColor: 'text-white',
  }
];

function PlayerCard({
  player,
  index,
  rankStyles,
  heroStat,
  heroLabel,
  secondaryStat,
  secondaryLabel,
  perGameStat,
}: {
  player: TopPlayerData;
  index: number;
  rankStyles: typeof scorerRankStyles;
  heroStat: number;
  heroLabel: string;
  secondaryStat: number;
  secondaryLabel: string;
  perGameStat: string;
}) {
  const style = rankStyles[index] || rankStyles[3];

  return (
    <Card
      key={player.id}
      customClass={`
        border ${style.border}
        bg-[#0c0d10]
        transition-all duration-500
      `}
    >
      <div className="absolute inset-0 bg-[#0c0d10]" />

      <div className="relative flex h-full w-full z-10">
        {/* ─── Left: Player Image ─── */}
        <div className="relative w-[42%] h-full overflow-hidden flex-shrink-0 group border-r border-white/5">
          <Image
            src={player.photo || '/images/default-player.png'}
            alt={`${player.firstName} ${player.lastName}`}
            fill
            className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0c0d10]/40 to-[#0c0d10]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d10] via-transparent to-transparent opacity-60" />
          {player.teamLogo && (
            <div className="absolute bottom-5 left-5">
              <div className="w-10 h-10 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-1.5 flex items-center justify-center">
                <Image
                  src={player.teamLogo}
                  alt={player.teamName || ''}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: Stats & Info ─── */}
        <div className="flex-1 flex flex-col justify-between py-8 pr-8 pl-6">
          <div className="flex items-start justify-between w-full">
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-white/40 tracking-[0.2em] mb-1 uppercase">
                {player.firstName}
              </p>
              <h3 className="text-4xl lg:text-5xl font-black text-white uppercase tracking-tight leading-[0.9]">
                {player.lastName}
              </h3>
            </div>
            <div className="relative mt-1">
              <div className={`
                relative w-12 h-14 transform skew-x-[-12deg]
                flex flex-col items-center justify-center
                ${style.badge}
                shadow-sm
              `}>
                <span className={`text-2xl font-black ${style.rankColor} leading-none skew-x-[12deg]`}>
                  {index + 1}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full flex items-center gap-4 my-2">
            <div className={`h-[2px] w-12 bg-gradient-to-r ${style.divider} to-transparent`} />
            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${style.text}`}>
              {style.label}
            </span>
          </div>

          <div className="relative mt-2">
            <div className="flex items-end gap-3">
              <span className={`
                text-7xl font-black leading-none tracking-tighter
                ${style.text}
              `}>
                {heroStat}
              </span>
              <span className="text-sm font-bold text-white/30 uppercase tracking-[0.15em] mb-2">
                {heroLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-5 mt-4">
            <div>
              <div className="text-2xl font-bold text-white tabular-nums">
                {secondaryStat}
              </div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mt-1">
                {secondaryLabel}
              </div>
            </div>

            <div className="w-px h-8 bg-white/[0.08]" />

            <div>
              <div className="text-2xl font-bold text-white tabular-nums">
                {player.matches}
              </div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mt-1">
                Matches
              </div>
            </div>

            <div className="w-px h-8 bg-white/[0.08]" />

            <div>
              <div className={`text-2xl font-bold tabular-nums ${style.text}`}>
                {perGameStat}
              </div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mt-1">
                Per Game
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function TopScorers({ scorers, assistLeaders }: TopScorersProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-20 sm:py-32 overflow-hidden bg-[#08090c]"
    >
      {/* --- Ambient Background Effects --- */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-orange-600/[0.04] blur-[200px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/[0.04] blur-[200px] rounded-full" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* --- Header --- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl sm:text-7xl font-black text-white mb-6 tracking-tight uppercase">
            ΤΟΠ{' '}
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              Παίκτες
            </span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto" />
        </motion.div>

        {/* --- Two columns: Scorers & Assists --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-4">
          {/* Top Scorers Column */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center mb-8"
            >
              <h3 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-wide flex items-center justify-center gap-3">
                <span className="w-8 h-[2px] bg-gradient-to-r from-transparent to-amber-400/60" />
                <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                  Top Scorers
                </span>
                <span className="w-8 h-[2px] bg-gradient-to-l from-transparent to-amber-400/60" />
              </h3>
            </motion.div>

            <div
              className="relative mx-auto flex items-center justify-center"
              style={{ height: '420px' }}
            >
              <CardSwap
                width={700}
                height={390}
                cardDistance={60}
                verticalDistance={0}
                delay={10000}
                skewAmount={0}
                easing="elastic"
                containerClassName="
                  relative
                  [perspective:1400px]
                  overflow-visible
                  flex items-center justify-center
                  max-[1024px]:scale-[0.7]
                  max-[768px]:scale-[0.5]
                  max-[480px]:scale-[0.38]
                "
              >
                {scorers.map((scorer, index) => {
                  const gpm =
                    scorer.matches > 0
                      ? (scorer.goals / scorer.matches).toFixed(2)
                      : '0.00';

                  return (
                    <PlayerCard
                      key={scorer.id}
                      player={scorer}
                      index={index}
                      rankStyles={scorerRankStyles}
                      heroStat={scorer.goals}
                      heroLabel="Goals"
                      secondaryStat={scorer.assists}
                      secondaryLabel="Assists"
                      perGameStat={gpm}
                    />
                  );
                })}
              </CardSwap>
            </div>
          </div>

          {/* Top Assists Column */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-center mb-8"
            >
              <h3 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-wide flex items-center justify-center gap-3">
                <span className="w-8 h-[2px] bg-gradient-to-r from-transparent to-cyan-400/60" />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  Top Assists
                </span>
                <span className="w-8 h-[2px] bg-gradient-to-l from-transparent to-cyan-400/60" />
              </h3>
            </motion.div>

            <div
              className="relative mx-auto flex items-center justify-center"
              style={{ height: '420px' }}
            >
              <CardSwap
                width={700}
                height={390}
                cardDistance={60}
                verticalDistance={0}
                delay={10000}
                skewAmount={0}
                easing="elastic"
                containerClassName="
                  relative
                  [perspective:1400px]
                  overflow-visible
                  flex items-center justify-center
                  max-[1024px]:scale-[0.7]
                  max-[768px]:scale-[0.5]
                  max-[480px]:scale-[0.38]
                "
              >
                {assistLeaders.map((player, index) => {
                  const apm =
                    player.matches > 0
                      ? (player.assists / player.matches).toFixed(2)
                      : '0.00';

                  return (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      index={index}
                      rankStyles={assistRankStyles}
                      heroStat={player.assists}
                      heroLabel="Assists"
                      secondaryStat={player.goals}
                      secondaryLabel="Goals"
                      perGameStat={apm}
                    />
                  );
                })}
              </CardSwap>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
