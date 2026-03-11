'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import CardSwap from '@/components/CardSwap';
import { ScorerCard, AssisterCard, MvpCard, BestGkCard } from '@/components/cards';
import type { TopPlayerData } from '@/components/cards/types';

export type { TopPlayerData };

const CARD_WIDTH = 700;
const CARD_HEIGHT = 390;

/* ─── hook: compute scale & cardDistance so cards always fit ─── */
function useCardLayout(
  containerRef: React.RefObject<HTMLDivElement | null>,
  numCards: number
) {
  const [layout, setLayout] = useState({ scale: 0.4, cardDistance: 40 });

  const recalc = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const vw = window.innerWidth;
    const isMobile = vw < 640;

    // Tighter stacking on mobile so total width is smaller
    const cardDistance = isMobile ? 40 : 60;

    // ★ This is the actual pixel width CardSwap renders
    const totalWidth = CARD_WIDTH + cardDistance * numCards;

    // Leave small breathing room on each side
    const padding = isMobile ? 4 : 32;
    const available = Math.min(el.clientWidth, vw) - padding * 2;

    // Scale that makes the whole card stack exactly fit
    let scale = available / totalWidth;

    // Clamp to sensible maximums per breakpoint
    let max = 0.55;
    if (vw >= 1280) max = 0.9;
    else if (vw >= 1024) max = 0.85;
    else if (vw >= 768) max = 0.75;
    else if (vw >= 640) max = 0.65;

    scale = Math.min(Math.max(scale, 0.2), max);

    setLayout({ scale, cardDistance });
  }, [containerRef, numCards]);

  useEffect(() => {
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [recalc]);

  return layout;
}

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { scale, cardDistance } = useCardLayout(wrapperRef, players.length);

  if (players.length === 0) return null;

  const titleParts = title.split(' ');
  const firstWord = titleParts[0];
  const restOfTitle = titleParts.slice(1).join(' ');

  // Native (unscaled) size — must match what CardSwap actually renders
  const nativeWidth = CARD_WIDTH + cardDistance * players.length;
  const nativeHeight = CARD_HEIGHT;

  // What the user actually sees after scaling
  const scaledWidth = nativeWidth * scale;
  const scaledHeight = nativeHeight * scale;

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

      {/* ★ Outer wrapper — measures available width */}
      <div
        ref={wrapperRef}
        className="relative w-full flex items-center justify-center"
        style={{ height: scaledHeight + 20 }}
      >
        {/* ★ Layout box — takes up exactly the SCALED dimensions */}
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            position: 'relative',
          }}
        >
          {/* ★ Scaling layer — native size, centered, then scaled down */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: nativeWidth,
              height: nativeHeight,
              transform: `translate(-50%, -50%) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            <CardSwap
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              cardDistance={cardDistance}
              verticalDistance={0}
              delay={10000}
              skewAmount={0}
              easing="elastic"
              containerClassName="
                relative
                [perspective:1400px]
                overflow-visible
                flex items-center justify-center
              "
            >
              {players.map((player, index) => renderCard(player, index))}
            </CardSwap>
          </div>
        </div>
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
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-orange-600/[0.04] blur-[200px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] blur-[200px] rounded-full" />
      </div>

      <div className="container mx-auto px-0 sm:px-4 relative z-10">
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

        <div
          className="
            flex flex-col gap-10
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