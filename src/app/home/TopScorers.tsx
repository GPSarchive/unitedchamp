'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import CardSwap from '@/components/CardSwap';
import { ScorerCard, AssisterCard, MvpCard, BestGkCard } from '@/components/cards';
import type { TopPlayerData } from '@/components/cards/types';

export type { TopPlayerData };

/* ─── CategoryColumn ─── */
interface CategoryColumnProps {
  title: string;
  players: TopPlayerData[];
  renderCard: (player: TopPlayerData, index: number) => ReactNode;
  animateFrom?: 'left' | 'right';
  isVisible: boolean;
}

function CategoryColumn({
  title,
  players,
  renderCard,
  animateFrom = 'left',
  isVisible,
}: CategoryColumnProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (players.length === 0) return null;

  // Split the title into the first word ("Top") and the rest of the string
  const titleParts = title.split(' ');
  const firstWord = titleParts[0];
  const restOfTitle = titleParts.slice(1).join(' ');

  return (
    <div className="flex flex-col relative w-full mb-4 sm:mb-8 xl:mb-0">
      <motion.h3
        initial={{ opacity: 0, x: animateFrom === 'left' ? -20 : 20 }}
        animate={isVisible ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: animateFrom === 'left' ? 0.2 : 0.3 }}
        className="
          relative z-20 text-left 
          pl-24
          text-[11px] font-semibold tracking-[0.25em] text-white uppercase
          mb-4
          sm:pl-0 sm:text-center sm:mb-10 sm:text-2xl sm:font-bold sm:tracking-wide
          md:text-3xl
        "
      >
        {firstWord}{' '}
        <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
          {restOfTitle}
        </span>
      </motion.h3>

      <div
        className="
          relative flex items-center
          justify-start
          sm:justify-center
          h-[180px]
          sm:h-[320px] md:h-[380px] lg:h-[420px]
        "
      >
        <CardSwap
          width={700}
          height={390}
          /* 1. Reduced mobile distance from 120 to 85 so the total width isn't massive */
          cardDistance={isMobile ? 85 : 60} 
          verticalDistance={0}
          delay={10000}
          skewAmount={0}
          easing="elastic"
          containerClassName="
            relative
            [perspective:1400px]
            overflow-visible
            flex items-center justify-center
            
            /* 2. DYNAMIC MOBILE SCALE: 0.36 for small phones, 0.42 for larger phones (390px+) */
            scale-[0.36] min-[390px]:scale-[0.42] -translate-x-[5%] origin-center
            
            /* 3. PC Scales remain exactly the same */
            sm:scale-[0.6] sm:translate-x-0
            md:scale-[0.75]
            lg:scale-[0.85]
            xl:scale-[0.8]
            2xl:scale-100
          "
        >
          {players.map((player, index) => renderCard(player, index))}
        </CardSwap>
      </div>
    </div>
  );
}


/* ─── TopScorers Section ─── */
interface TopScorersProps {
  scorers: TopPlayerData[];
  assisters?: TopPlayerData[];
  mvps?: TopPlayerData[];
  bestGks?: TopPlayerData[];
}

export default function TopScorers({
  scorers,
  assisters = [],
  mvps = [],
  bestGks = [],
}: TopScorersProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-8 sm:py-20 lg:py-32 overflow-hidden bg-[#08090c]"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-orange-600/[0.04] blur-[200px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] blur-[200px] rounded-full" />
      </div>

      <div className="container mx-auto px-0 sm:px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-4 sm:mb-16 lg:mb-20 px-4"
        >
          <h2 className="text-2xl sm:text-5xl lg:text-7xl font-black text-white mb-2 sm:mb-6 tracking-tight uppercase">
            ΤΟP{' '}
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              Παίκτες
            </span>
          </h2>
          <div className="w-12 sm:w-24 h-px sm:h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto" />
        </motion.div>

            {/* Category columns */}
    <div
      className="
        flex flex-col gap-10 /* <-- INCREASED spacing between categories on mobile */
        sm:grid sm:grid-cols-1 sm:gap-10
        xl:grid-cols-2 xl:gap-32 xl:gap-y-48
      "
    >

          <CategoryColumn
            title="Τop Σκόρερς"
            players={scorers}
            renderCard={(player, index) => (
              <ScorerCard key={player.id} player={player} index={index} />
            )}
            animateFrom="left"
            isVisible={isVisible}
          />

          <CategoryColumn
            title="Top Assists"
            players={assisters}
            renderCard={(player, index) => (
              <AssisterCard key={player.id} player={player} index={index} />
            )}
            animateFrom="left"
            isVisible={isVisible}
          />

          <CategoryColumn
            title="Top MVPs"
            players={mvps}
            renderCard={(player, index) => (
              <MvpCard key={player.id} player={player} index={index} />
            )}
            animateFrom="left"
            isVisible={isVisible}
          />

          <CategoryColumn
            title="Top Best GK"
            players={bestGks}
            renderCard={(player, index) => (
              <BestGkCard key={player.id} player={player} index={index} />
            )}
            animateFrom="left"
            isVisible={isVisible}
          />
        </div>
      </div>
    </section>
  );
}