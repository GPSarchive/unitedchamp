'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { CenterMark, TeamName, type ClusterItem } from './EventPillShrimp';

// ===================== Accent palette (curated) =====================
const PALETTE = [{ h: 14, s: 90, l: 55 }] as const; // orange
const hsl = (h: number, s: number, l: number, a?: number) =>
  a == null ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`;

function paletteIndexFromString(str: string) {
  let h = 0 >>> 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}
function accentFor(key: string) {
  const sw = PALETTE[paletteIndexFromString(key)];
  return {
    solid: hsl(sw.h, 80, 55),
    ring: hsl(sw.h, 80, 55, 0.25),
    glow: hsl(sw.h, 90, 50, 0.45),
  };
}

/** Background presets */
const BG = {
  clusterPane: 'bg-gradient-to-br from-red-950/80 via-black-900/85 to-black-800/80',
  clusterCollapsed: 'bg-gradient-to-br from-red-950/40 via-black-900/50 to-black-800/45',
} as const;

type MultiMatchClusterProps = { items: ClusterItem[] };

/** Bottom CTA height for mobile */
const MOBILE_CTA_H = 68; // px

function hhmm(naiveIso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):/.exec(naiveIso);
  return m ? `${m[4]}:${m[5]}` : '';
}
function scoreText(item: ClusterItem) {
  if (item.status === 'finished' && item.score && item.score.length === 2) {
    const [a, b] = item.score;
    if (Number.isFinite(a) && Number.isFinite(b)) return `${a}–${b}`;
  }
  return null;
}

/** flex weight for expansion */
function paneWeight(index: number, total: number, active: number | null) {
  if (total <= 1) return 1;
  if (active == null) return 1;
  return active === index ? 4 : 1;
}

/** Mobile detection at runtime (matches Tailwind md breakpoint) */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

const MultiMatchCluster = ({ items }: MultiMatchClusterProps) => {
  const [active, setActive] = useState<number | null>(null);
  const router = useRouter();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  // Mobile swipe gestures
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const el = containerRef.current;
    let startY = 0;
    let startX = 0;
    let isSwiping = false;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      isSwiping = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const moveY = e.touches[0].clientY;
      const moveX = e.touches[0].clientX;
      const deltaY = Math.abs(moveY - startY);
      const deltaX = Math.abs(moveX - startX);
      if (deltaY > 30 && deltaY > deltaX) {
        isSwiping = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping) return;
      const endY = e.changedTouches[0].clientY;
      const delta = endY - startY;

      setActive((prev) => {
        if (prev == null) return delta > 0 ? 0 : items.length - 1;
        if (delta > 0) {
          return prev > 0 ? prev - 1 : 0;
        } else {
          return prev < items.length - 1 ? prev + 1 : items.length - 1;
        }
      });
    };

    el.addEventListener('touchstart', handleTouchStart);
    el.addEventListener('touchmove', handleTouchMove);
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, items.length]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onMouseLeave={() => !isMobile && setActive(null)}
      style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.5))' }}
    >
      <div ref={containerRef} className="flex flex-col h-full gap-1">
        {items.map((item, i) => {
          const a = item.teams?.[0] ?? 'Team A';
          const b = item.teams?.[1] ?? 'Team B';
          const la = item.logos?.[0] ?? '/placeholder.png';
          const lb = item.logos?.[1] ?? '/placeholder.png';
          const timeText = `${hhmm(item.start)} – ${hhmm(item.end)}`;
          const accent = accentFor(`${a}-${b}`);
          const expanded = active === i;
          const score = scoreText(item);
          const isOtherExpanded = active !== null && active !== i;

          const goToMatch = () => router.push(`/matches/${item.id}`);

          const handlePaneClick = (e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest('button')) return;

            if (isMobile) {
              if (!expanded) setActive(i);
            } else {
              goToMatch();
            }
          };

          const handlePaneHover = () => {
            if (!isMobile) setActive(i);
          };

          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (isMobile) {
                setActive(expanded ? null : i);
              } else {
                goToMatch();
              }
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i + 1) % items.length);
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i - 1 + items.length) % items.length);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setActive(null);
            }
          };

          // Shared IDs for FLIP animations
          const lidA = `logoA-${item.id}`;
          const lidB = `logoB-${item.id}`;
          const lidT = `time-${item.id}`;

          return (
            <LayoutGroup id={item.id} key={item.id}>
              <motion.div
                layout="size"
                className={`relative border overflow-hidden cursor-pointer transition-all duration-300 ${
                  expanded ? BG.clusterPane : isOtherExpanded ? BG.clusterCollapsed : 'bg-black/90'
                }`}
                style={{
                  boxSizing: 'border-box',
                  borderColor: accent.solid,
                  flex: `${paneWeight(i, items.length, active)} 1 0%`,
                  transition:
                    'flex-grow 400ms cubic-bezier(0.4, 0, 0.2, 1), background-color 400ms ease',
                  willChange: 'flex-grow, background-color',
                  opacity: 1,
                }}
                onClick={handlePaneClick}
                onMouseEnter={handlePaneHover}
                onFocus={handlePaneHover}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                aria-label={`${a} vs ${b} — ${score ?? timeText}`}
                aria-expanded={expanded}
              >
                {/* Absolute positioning stage */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {/* Collapsed state */}
                  <AnimatePresence initial={false} mode="wait">
                    {!expanded && (
                      <motion.div
                        key="collapsed-stage"
                        className="absolute inset-0 flex items-center justify-center px-2 min-w-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center gap-2 md:gap-3 w-full justify-center min-w-0">
                          {/* LOGO A */}
                          <motion.img
                            layoutId={lidA}
                            src={la}
                            alt={a}
                            className={[
                              'shrink aspect-square rounded-full object-contain',
                              // Mobile: tie size to pane height with safe clamp; desktop keeps previous sizes
                              'h-[clamp(24px,70%,56px)] w-[clamp(24px,70%,56px)] md:h-14 md:w-14',
                            ].join(' ')}
                            style={{ willChange: 'transform', transformOrigin: '50% 50%' }}
                          />
                          {/* TIME (does not crowd logos) */}
                          <motion.span
                            layoutId={lidT}
                            className="text-[11px] md:text-[13px] font-bold tracking-wide text-white/90
                                       max-w-[40%] overflow-hidden text-ellipsis whitespace-nowrap md:max-w-none"
                          >
                            {timeText}
                          </motion.span>
                          {/* LOGO B */}
                          <motion.img
                            layoutId={lidB}
                            src={lb}
                            alt={b}
                            className={[
                              'shrink aspect-square rounded-full object-contain',
                              'h-[clamp(18px,60%,40px)] w-[clamp(18px,60%,40px)] md:h-10 md:w-10',
                            ].join(' ')}
                            style={{ willChange: 'transform', transformOrigin: '50% 50%' }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded state */}
                  <AnimatePresence initial={false} mode="wait">
                    {expanded && (
                      <motion.div
                        key="expanded-stage"
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {/* MOBILE: Vertical stacking */}
                        <div
                          className="md:hidden flex flex-col items-center justify-center gap-1.5 px-2 w-full max-w-[85%] h-full py-2
                                     pb-[calc(env(safe-area-inset-bottom)+var(--cta-h)+6px)]"
                          style={{ ['--cta-h' as any]: `${MOBILE_CTA_H}px` }}
                        >
                          {/* Time */}
                          <motion.span
                            layoutId={lidT}
                            className="text-[11px] font-semibold tracking-wide text-white text-center block mb-0.5"
                          >
                            {timeText}
                          </motion.span>

                          {/* TEAM A */}
                          <div className="flex flex-col items-center justify-center">
                            <motion.img
                              layoutId={lidA}
                              src={la}
                              alt={a}
                               className="block h-[min(72px,22vh)] w-[min(72px,22vh)] rounded-full object-contain"
                              style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
                            />
                            <span className="mt-0.5 text-[9px] font-extrabold text-white uppercase tracking-wide text-center max-w-[7rem] truncate px-1">
                              {a}
                            </span>
                          </div>

                          {/* VS / Score */}
                          <div className="py-0.5">
                            <span className="text-[16px] font-extrabold text-white uppercase">
                              {score ?? 'VS'}
                            </span>
                          </div>

                          {/* TEAM B */}
                          <div className="flex flex-col items-center justify-center">
                            <motion.img
                              layoutId={lidB}
                              src={lb}
                              alt={b}
                              className="block h-[min(48px,18vh)] w-[min(48px,18vh)] rounded-full object-contain"
                              style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
                            />
                            <span className="mt-0.5 text-[9px] font-extrabold text-white uppercase tracking-wide text-center max-w-[7rem] truncate px-1">
                              {b}
                            </span>
                          </div>
                        </div>

                        {/* DESKTOP: Horizontal layout (original) */}
                        <div className="hidden md:grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] place-items-center px-2 md:px-4 w-full max-w-[95%]">
                          {/* Row 1: time */}
                          <div className="row-start-1 col-start-1 col-end-4 mb-2">
                            <motion.span
                              layoutId={lidT}
                              className="text-[13px] md:text-[15px] font-semibold tracking-wide text-white text-center block"
                            >
                              {timeText}
                            </motion.span>
                          </div>

                          {/* Row 2: logos + VS/Score */}
                          <div className="row-start-2 col-start-1 justify-self-center">
                            <motion.img
                              layoutId={lidA}
                              src={la}
                              alt={a}
                              className="block h-30 w-30 md:h-24 md:w-24 rounded-full object-contain"

                              style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
                            />
                          </div>
                          <div className="row-start-2 col-start-2 px-3">
                            <CenterMark
                              text={score ?? 'VS'}
                              inline
                              maxPx={24}
                              minPx={16}
                              className="text-[20px] md:text-[26px]"
                            />
                          </div>
                          <div className="row-start-2 col-start-3 justify-self-center">
                            <motion.img
                              layoutId={lidB}
                              src={lb}
                              alt={b}
                              className="block h-14 w-14 md:h-18 md:w-18 rounded-full object-contain"
                              style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
                            />
                          </div>

                          {/* Row 3: team names */}
                          <div className="row-start-3 col-start-1 justify-self-center mt-1 w-full max-w-[10rem]">
                            <div className="text-center">
                              <TeamName name={a} />
                            </div>
                          </div>
                          <div className="row-start-3 col-start-3 justify-self-center mt-1 w-full max-w-[10rem]">
                            <div className="text-center">
                              <TeamName name={b} />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Interactive controls when expanded */}
                <AnimatePresence initial={false} mode="wait">
                  {expanded && (
                    <motion.div
                      key="expanded-controls"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative z-30 h-full pointer-events-none"
                    >
                      {/* Back/Close button - MOBILE ONLY */}
                      {isMobile && (
                        <div className="absolute top-1 left-1 pointer-events-auto">
                          <button
                            className="bg-black/70 hover:bg-black/85 active:bg-black/95 p-1.5 text-white/90 transition-colors border border-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActive(null);
                            }}
                            aria-label="Κλείσιμο"
                            style={{ borderRadius: 0 }}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Navigate control - MOBILE ONLY: thin bottom arrow */}
                      {isMobile && (
                        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToMatch();
                            }}
                            className="w-full h-[var(--cta-h)] flex items-center justify-center bg-white/5 hover:bg-white/10 active:bg-white/15 border-t border-white/15 pb-[env(safe-area-inset-bottom)]"
                            style={{ borderRadius: 0, ['--cta-h' as any]: `${MOBILE_CTA_H}px` }}
                            aria-label={`Προβολή αγώνα ${a} vs ${b}`}
                          >
                            <ChevronRight className="h-3.5 w-3.5 text-white/80" />
                          </button>
                        </div>
                      )}

                      {/* Swipe hint (mobile only) */}
                      {isMobile && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="absolute top-1 right-1 text-[8px] text-white/40 font-medium uppercase tracking-wider"
                        >
                          Σύρετε ↕
                        </motion.div>
                      )}

                      {/* Desktop click indicator */}
                      {!isMobile && (
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <ChevronRight className="h-5 w-5 text-white/60" />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tap hint when collapsed (mobile only) */}
                {!expanded && isMobile && isOtherExpanded && (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                    aria-hidden="true"
                  >
                    <span className="text-[10px] mt-2 text-white/50 font-semibold tracking-wider">
                      {score ?? timeText}
                    </span>
                  </div>
                )}
              </motion.div>
            </LayoutGroup>
          );
        })}
      </div>
    </div>
  );
};

export default MultiMatchCluster;

/* Optional marquee helper if needed somewhere in cluster UI */
export const marqueeClass = `
.marquee{display:inline-block;white-space:nowrap;overflow:hidden;animation:marquee 8s linear infinite}
.marquee:hover{animation-play-state:paused}
@keyframes marquee{0%,10%{transform:translateX(0)}50%,60%{transform:translateX(calc(-100% + 10rem))}100%{transform:translateX(0)}}
`;
