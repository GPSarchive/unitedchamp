"use client";

/**
 * EditorialTopPlayers — sandbox client wrapper that renders the 4 top-player
 * columns using editorial cards. Mirrors TopScorers (same CardSwap, same
 * layout math), but with the new card component + editorial section header.
 */

import { motion } from "framer-motion";
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import CardSwap from "@/components/CardSwap";
import type { TopPlayerData } from "@/components/cards/types";
import {
  EditorialScorerCard,
  EditorialAssisterCard,
  EditorialMvpCard,
  EditorialBestGkCard,
} from "./cards/EditorialPlayerCard";

const CARD_WIDTH = 700;
const CARD_HEIGHT = 390;

// ───────────────────────────────────────────────────────────────────────
// Layout math — same as TopScorers
// ───────────────────────────────────────────────────────────────────────
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
      cardDistance = 80;
      padding = 2;
      maxScale = 0.48;
    } else if (vw < 640) {
      cardDistance = 85;
      padding = 4;
      maxScale = 0.55;
    } else if (vw < 768) {
      cardDistance = 75;
      padding = 24;
      maxScale = 0.65;
    } else if (vw < 1024) {
      cardDistance = 65;
      padding = 32;
      maxScale = 0.75;
    } else if (vw < 1280) {
      cardDistance = 60;
      padding = 32;
      maxScale = 0.85;
    } else {
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
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  return layout;
}

// ───────────────────────────────────────────────────────────────────────
// CategoryColumn — editorial variant of TopScorers' CategoryColumn
// ───────────────────────────────────────────────────────────────────────
interface CategoryColumnProps {
  eyebrow: string;
  title: string;
  players: TopPlayerData[];
  renderCard: (player: TopPlayerData, index: number) => ReactNode;
  isVisible: boolean;
  swapOffset?: number;
}

function CategoryColumn({
  eyebrow,
  title,
  players,
  renderCard,
  isVisible,
  swapOffset = 0,
}: CategoryColumnProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { scale, cardDistance } = useCardLayout(wrapperRef, players.length);

  if (players.length === 0) return null;

  const nativeWidth = CARD_WIDTH + cardDistance * players.length;
  const nativeHeight = CARD_HEIGHT;
  const scaledWidth = nativeWidth * scale;
  const scaledHeight = nativeHeight * scale;

  return (
    <div className="relative flex flex-col w-full mb-4 sm:mb-8 xl:mb-0">
      {/* Editorial column heading */}
      <div className="px-4 sm:px-0 sm:text-center mb-5 sm:mb-7">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.32em] text-[#fb923c] mb-2 sm:justify-center"
        >
          <span className="h-[2px] w-6 bg-[#fb923c]" />
          {eyebrow}
        </motion.div>
        <motion.h3
          initial={{ opacity: 0, y: 12 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-[var(--f-display)] italic font-black leading-[0.95] tracking-[-0.02em] text-[#F3EFE6] uppercase"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)" }}
        >
          {title}
        </motion.h3>
      </div>

      {/* Card stage — same math as TopScorers */}
      <div
        ref={wrapperRef}
        className="relative w-full flex items-center justify-start -translate-x-[3%] sm:justify-center sm:translate-x-0"
        style={{ height: scaledHeight + 20 }}
      >
        <div style={{ width: scaledWidth, height: scaledHeight, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: nativeWidth,
              height: nativeHeight,
              transform: `translate(-50%, -50%) scale(${scale})`,
              transformOrigin: "center center",
            }}
          >
            <CardSwap
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              cardDistance={cardDistance}
              verticalDistance={0}
              delay={10000}
              initialDelay={10000 + swapOffset}
              skewAmount={0}
              easing="elastic"
              containerClassName="relative [perspective:1400px] overflow-visible flex items-center justify-center"
            >
              {players.map((p, i) => renderCard(p, i))}
            </CardSwap>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// EditorialTopPlayers — main component
// ───────────────────────────────────────────────────────────────────────
interface EditorialTopPlayersProps {
  scorers: TopPlayerData[];
  assisters?: TopPlayerData[];
  mvps?: TopPlayerData[];
  bestGks?: TopPlayerData[];
}

export default function EditorialTopPlayers({
  scorers,
  assisters = [],
  mvps = [],
  bestGks = [],
}: EditorialTopPlayersProps) {
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
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Grid columns — same break structure as TopScorers */}
      <div
        className="
          flex flex-col gap-14
          sm:grid sm:grid-cols-1 sm:gap-14
          xl:grid-cols-2 xl:gap-x-24 xl:gap-y-32
        "
      >
        <CategoryColumn
          eyebrow="Goals"
          title="Top Σκόρερς"
          players={scorers}
          renderCard={(player, index) => (
            <EditorialScorerCard key={player.id} player={player} index={index} />
          )}
          isVisible={isVisible}
          swapOffset={0}
        />
        <CategoryColumn
          eyebrow="Assists"
          title="Top Ασίστ"
          players={assisters}
          renderCard={(player, index) => (
            <EditorialAssisterCard key={player.id} player={player} index={index} />
          )}
          isVisible={isVisible}
          swapOffset={2500}
        />
        <CategoryColumn
          eyebrow="Most Valuable"
          title="Top MVP"
          players={mvps}
          renderCard={(player, index) => (
            <EditorialMvpCard key={player.id} player={player} index={index} />
          )}
          isVisible={isVisible}
          swapOffset={5000}
        />
        <CategoryColumn
          eyebrow="Between the posts"
          title="Top Best GK"
          players={bestGks}
          renderCard={(player, index) => (
            <EditorialBestGkCard key={player.id} player={player} index={index} />
          )}
          isVisible={isVisible}
          swapOffset={7500}
        />
      </div>
    </section>
  );
}
