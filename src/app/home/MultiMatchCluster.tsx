'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CenterMark, TeamName } from './EventPillShrimp';
import styles from './MultiMatchCluster.module.css';

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
  const EXPANDED_PCT = 90;
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
              if (isMobile) {
                setActive(expanded ? null : i);
              } else {
                goToMatch();
              }
            }
            if (e.key === 'ArrowDown') setActive((i + 1) % items.length);
            if (e.key === 'ArrowUp') setActive((i - 1 + items.length) % items.length);
          };

          const isCollapsed = active !== i && active !== null;

          /** Click behavior:
           * - Desktop: click container navigates (unchanged).
           * - Mobile: first tap expands. CTA handles navigation.
           */
          const onContainerClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
            if (isMobile) {
              if (!expanded) {
                setActive(i);
              }
              // do not navigate on mobile container click
              return;
            }
            goToMatch();
          };

          return (
            <div
              key={item.id}
              className={`relative border ${isCollapsed ? 'bg-black' : BG.clusterPane} overflow-hidden group cursor-pointer`}
              style={{
                borderColor: accent.solid,
                height: paneHeight(i, items.length, active),
                transition: 'height 450ms ease, background-color 450ms ease',
                minHeight: 0,
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
              {/* Collapsed summary */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(expanded ? null : i);
                }}
                className={`${expanded ? 'hidden' : 'flex'} relative group/row flex-col items-center justify-center gap-2 w-full p-3 text-center cursor-pointer select-none`}
                aria-label={`Expand ${a} vs ${b}`}
              >
                <span className="text-[14px] md:text-[15px] font-bold tracking-wide text-white relative z-10">
                  {timeText}
                </span>

                {/* Fixed-height logo lanes */}
                <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] px-2 max-w-[92%] mx-auto mt-1">
                  <div className="relative min-w-0 justify-self-end w-full max-w-[10rem]">
                    <div className="flex h-14 md:h-16 w-full items-center justify-end">
                      <img
                        src={la}
                        alt={a}
                        className="max-h-12 md:max-h-14 w-auto rounded-full object-contain"
                        title={a}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center px-3">
                    <CenterMark text={score ?? 'VS'} inline />
                  </div>

                  <div className="relative min-w-0 justify-self-start w-full max-w-[10rem]">
                    <div className="flex h-14 md:h-16 w-full items-center justify-start">
                      <img
                        src={lb}
                        alt={b}
                        className="max-h-12 md:max-h-14 w-auto rounded-full object-contain"
                        title={b}
                      />
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key="expanded"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`relative ${BG.clusterPane}`}
                    style={{
                      boxShadow: `0 0 0 1px ${accent.ring} inset, 0 12px 24px -16px ${accent.glow}`,
                      height: '100%',
                    }}
                  >
                    {/* Back button (shown on all, required for mobile) */}
                    <div className="absolute top-1 left-1 z-30">
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

                    <div className="relative z-10 p-3 flex flex-col items-center justify-between gap-3 h-full">
                      <span className="text-[15px] md:text-[16px] leading-tight font-semibold tracking-wide text-white select-none">
                        {timeText}
                      </span>

                      {/* Teams row: fixed lanes, absolute names */}
                      <div className="grid grid-cols-[1fr_auto_1fr] px-2 w-full max-w-[92%] mx-auto">
                        {/* LEFT TEAM */}
                        <div className="relative min-w-0 justify-self-end w-full max-w-[12rem]">
                          <div className="relative h-24 md:h-28 w-full">
                            <div className="flex h-full w-full items-center justify-center pt-2 pb-7">
                              <img
                                src={la}
                                alt={a}
                                className="h-16 w-16 md:h-20 md:w-20 rounded-full object-contain"
                                title={a}
                              />
                            </div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full px-1">
                              <TeamName name={a} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-center px-4">
                          <CenterMark text={score ?? 'VS'} inline className="text-[28px] md:text-[32px]" />
                        </div>

                        {/* RIGHT TEAM */}
                        <div className="relative min-w-0 justify-self-start w-full max-w-[12rem]">
                          <div className="relative h-24 md:h-28 w-full">
                            <div className="flex h-full w-full items-center justify-center pt-2 pb-7">
                              <img
                                src={lb}
                                alt={b}
                                className="h-16 w-16 md:h-20 md:w-20 rounded-full object-contain"
                                title={b}
                              />
                            </div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full px-1">
                              <TeamName name={b} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mobile-only CTA to open match page */}
                      {isMobile && (
                        <div className="mt-2 mb-1 w-full flex justify-center">
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultiMatchCluster;
