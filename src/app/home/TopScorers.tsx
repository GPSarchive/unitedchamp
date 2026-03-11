'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import CardSwap from '@/components/CardSwap';
import { ScorerCard, AssisterCard, MvpCard, BestGkCard } from '@/components/cards';
import type { TopPlayerData } from '@/components/cards/types';

export type { TopPlayerData };

const CARD_WIDTH = 700;
const CARD_HEIGHT = 390;

/* ─── hook: compute scale & cardDistance so cards fit but stay tappable ─── */
function useCardLayout(
  containerRef: React.RefObject<HTMLDivElement | null>,
  numCards: number
) {
  const [layout, setLayout] = useState({ scale: 0.35, cardDistance: 100 });

  const recalc = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const vw = window.innerWidth;

    let cardDistance: number;
    let padding: number;
    let maxScale: number;

    if (vw < 480) {
      // Small phones — tighter stacking → bigger cards
      cardDistance = 80;
      padding = 2;
      maxScale = 0.48;
    } else if (vw < 640) {
      // Larger phones
      cardDistance = 85;
      padding = 4;
      maxScale = 0.55;
    } else if (vw < 768) {
      // Small tablets
      cardDistance = 75;
      padding = 24;
      maxScale = 0.65;
    } else if (vw < 1024) {
      // Tablets
      cardDistance = 65;
      padding = 32;
      maxScale = 0.75;
    } else if (vw < 1280) {
      // Small desktop
      cardDistance = 60;
      padding = 32;
      maxScale = 0.85;
    } else {
      // Large desktop
      cardDistance = 60;
      padding = 32;
      maxScale = 0.9;
    }

    const totalWidth = CARD_WIDTH + cardDistance * numCards;
    const available = Math.min(el.clientWidth, vw) - padding * 2;
    let scale = available / totalWidth;
    scale = Math.min(Math.max(scale, 0.15), maxScale);

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

  const nativeWidth = CARD_WIDTH + cardDistance * players.length;
  const nativeHeight = CARD_HEIGHT;
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
          pl-17
          text-[11px] font-semibold tracking-[0.25em] text-white uppercase
          mb-2
          sm:pl-0 sm:text-center sm:mb-4 sm:text-2xl sm:font-bold sm:tracking-wide
          md:text-3xl
        "
      >
        {firstWord}{' '}
        <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
          {restOfTitle}
        </span>
      </motion.h3>

      {/* Decorative line under category label */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={isVisible ? { opacity: 1, scaleX: 1 } : {}}
        transition={{ duration: 0.6, delay: animateFrom === 'left' ? 0.4 : 0.5 }}
        className="
          ml-17 h-px w-8 mb-4
          bg-gradient-to-r from-orange-400/60 to-amber-300/20
          origin-left
          sm:ml-auto sm:mr-auto sm:w-16 sm:h-[2px] sm:mb-8 sm:origin-center
          sm:from-transparent sm:via-white/20 sm:to-transparent
        "
      />

      {/* Outer wrapper — shifted left on mobile, centered on sm+ */}
      <div
        ref={wrapperRef}
        className="
          relative w-full flex items-center
          justify-start -translate-x-[3%]
          sm:justify-center sm:translate-x-0
        "
        style={{ height: scaledHeight + 20 }}
      >
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            position: 'relative',
          }}
        >
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
      className="relative py-8 sm:py-20 lg:py-32 overflow-hidden"
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