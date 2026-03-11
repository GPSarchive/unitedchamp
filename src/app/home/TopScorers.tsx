'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import CardSwap from '@/components/CardSwap';
import { ScorerCard, AssisterCard, MvpCard } from '@/components/cards';
import type { TopPlayerData } from '@/components/cards/types';

// Re-export for page.tsx compatibility
export type { TopPlayerData };

/* ─── CategoryColumn ─── */
/* Generic column: pass data + a renderCard function. Drop in any card. */
interface CategoryColumnProps {
  title: string;
  players: TopPlayerData[];
  renderCard: (player: TopPlayerData, index: number) => ReactNode;
  animateFrom?: 'left' | 'right';
  isVisible: boolean;
}

function CategoryColumn({ title, players, renderCard, animateFrom = 'left', isVisible }: CategoryColumnProps) {
  if (players.length === 0) return null;

  return (
    <div>
      <motion.h3
        initial={{ opacity: 0, x: animateFrom === 'left' ? -20 : 20 }}
        animate={isVisible ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: animateFrom === 'left' ? 0.2 : 0.3 }}
        className="text-2xl sm:text-3xl font-bold text-center mb-10 uppercase tracking-wide"
      >
        <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
          {title}
        </span>
      </motion.h3>
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
}

export default function TopScorers({ scorers, assisters = [], mvps = [] }: TopScorersProps) {
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
      {/* Ambient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-orange-600/[0.04] blur-[200px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] blur-[200px] rounded-full" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
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

        {/* Category columns — add more by dropping another CategoryColumn */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-16 xl:gap-6">

          <CategoryColumn
            title="Top Scorers"
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
            animateFrom="right"
            isVisible={isVisible}
          />

        </div>
      </div>
    </section>
  );
}
