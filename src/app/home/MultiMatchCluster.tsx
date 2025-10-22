'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { CenterMark, TeamName } from './EventPillShrimp';

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

/** ✅ Background presets */
const BG = {
  clusterPane: 'bg-gradient-to-br from-red-950/80 via-black-900/85 to-black-800/80',
} as const;

// ===================== Types =====================
export type ClusterItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  teams?: [string, string];
  logos?: [string, string];
  status?: 'scheduled' | 'live' | 'finished';
  score?: [number, number] | null;
  home_score?: number;
  away_score?: number;
};

type MultiMatchClusterProps = {
  items: ClusterItem[];
};

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
function paneHeight(index: number, total: number, active: number | null) {
  const EXPANDED_PCT = 75;
  const REST_PCT = 100 - EXPANDED_PCT;
  if (total <= 1) return '100%';
  if (active == null) return `${100 / total}%`;
  return active === index ? `${EXPANDED_PCT}%` : `${REST_PCT / (total - 1)}%`;
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

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onMouseLeave={() => setActive(null)}
      style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.5))' }}
    >
      <div className="flex flex-col gap-1 h-full">
        {items.map((item, i) => {
          const a = item.teams?.[0] ?? 'Team A';
          const b = item.teams?.[1] ?? 'Team B';
          const la = item.logos?.[0] ?? '/placeholder.png';
          const lb = item.logos?.[1] ?? '/placeholder.png';
          const timeText = `${hhmm(item.start)} – ${hhmm(item.end)}`;
          const accent = accentFor(`${a}-${b}`);
          const expanded = active === i;
          const score = scoreText(item);

          const goToMatch = () => router.push(`/matches/${item.id}`);
          const onKeyGoToMatch: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (isMobile) setActive(expanded ? null : i);
              else goToMatch();
            }
            if (e.key === 'ArrowDown') setActive((i + 1) % items.length);
            if (e.key === 'ArrowUp') setActive((i - 1 + items.length) % items.length);
          };

          const isCollapsed = active !== i && active !== null;

          const onContainerClick: React.MouseEventHandler<HTMLDivElement> = () => {
            if (isMobile) {
              if (!expanded) setActive(i);
              return;
            }
            goToMatch();
          };

          // Shared IDs for FLIP
          const lidA = `logoA-${item.id}`;
          const lidB = `logoB-${item.id}`;
          const lidT = `time-${item.id}`;

          return (
            <LayoutGroup id={item.id} key={item.id}>
              <motion.div
                layout="size"
                className={`relative border ${isCollapsed ? 'bg-black' : BG.clusterPane} overflow-hidden group cursor-pointer`}
                style={{
                  borderColor: accent.solid,
                  height: paneHeight(i, items.length, active),
                  minHeight: 0,
                  transition: 'height 450ms ease, background-color 450ms ease',
                  willChange: 'height, background-color',
                }}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={onContainerClick}
                onKeyDown={onKeyGoToMatch}
                role="link"
                tabIndex={0}
                aria-label={`${a} vs ${b} — ${score ?? timeText}`}
                title={`${a} vs ${b}`}
              >
                {/* Absolute stage: keeps trio independent of reflow and perfectly centered */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {/* Collapsed placement: centered row */}
                  <AnimatePresence initial={false} mode="wait">
                    {!expanded && (
                      <motion.div
                        key="collapsed-stage"
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="flex items-center gap-3">
                          <motion.img
                            layoutId={lidA}
                            src={la}
                            alt={a}
                            className="h-10 w-10 md:h-12 md:w-12 rounded-full object-contain"
                          />
                          <motion.span
                            layoutId={lidT}
                            className="text-[14px] md:text-[15px] font-bold tracking-wide text-white"
                          >
                            {timeText}
                          </motion.span>
                          <motion.img
                            layoutId={lidB}
                            src={lb}
                            alt={b}
                            className="h-10 w-10 md:h-12 md:w-12 rounded-full object-contain"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>


                  {/* Expanded placement: centered grid in full card */}
                  <AnimatePresence initial={false} mode="wait">
                    {expanded && (
                      <motion.div
                        key="expanded-stage"
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] place-items-center px-4 w-full max-w-[92%]">
                          {/* Row 1: time */}
                          <div className="row-start-1 col-start-1 col-end-4">
                            <motion.span
                              layoutId={lidT}
                              className="text-[15px] md:text-[16px] font-semibold tracking-wide text-white text-center block"
                            >
                              {timeText}
                            </motion.span>
                          </div>

                          {/* Row 2: logos + VS */}
                          <div className="row-start-2 col-start-1 justify-self-center">
                            <motion.img
                              layoutId={lidA}
                              src={la}
                              alt={a}
                              className="block h-16 w-16 md:h-20 md:w-20 rounded-full object-contain"
                              style={{ transformOrigin: '50% 50%' }}
                            />
                          </div>
                          <div className="row-start-2 col-start-2">
                            <CenterMark text={score ?? 'VS'} inline className="text-[28px] md:text-[32px]" />
                          </div>
                          <div className="row-start-2 col-start-3 justify-self-center">
                            <motion.img
                              layoutId={lidB}
                              src={lb}
                              alt={b}
                              className="block h-16 w-16 md:h-20 md:w-20 rounded-full object-contain"
                              style={{ transformOrigin: '50% 50%' }}
                            />
                          </div>

                          {/* Row 3: team names centered under each logo */}
                          <div className="row-start-3 col-start-1 justify-self-center mt-1 w-full max-w-[12rem]">
                            <div className="text-center">
                              <TeamName name={a} />
                            </div>
                          </div>
                          <div className="row-start-3 col-start-3 justify-self-center mt-1 w-full max-w-[12rem]">
                            <div className="text-center">
                              <TeamName name={b} />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Click catcher when collapsed */}
                {!expanded && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(i);
                    }}
                    className="relative z-10 w-full h-full"
                    aria-label={`Expand ${a} vs ${b}`}
                  />
                )}

                {/* Expanded static UI: back button, names, CTA */}
                <AnimatePresence initial={false} mode="wait">
                  {expanded && (
                    <motion.div
                      key="expanded-ui"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="relative z-10 h-full"
                    >
                      <div className="absolute top-1 left-1">
                        <button
                          className="bg-black/60 p-1 text-white/90 hover:bg-black/70 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActive(null);
                          }}
                          aria-label="Back"
                          style={{ borderRadius: 0 }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      </div>

                      
                      {isMobile && (
                        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToMatch();
                            }}
                            className="px-3 py-1 text-[13px] uppercase tracking-wide bg-white/10 hover:bg-white/15 text-white"
                            style={{ borderRadius: 0 }}
                            aria-label="προβολη ματσ"
                          >
                            προβολη ματσ
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>
          );
        })}
      </div>
    </div>
  );
};

export default MultiMatchCluster;
