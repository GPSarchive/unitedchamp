'use client';

import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, ChevronLeft, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MultiMatchCluster from './MultiMatchCluster';

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
  single: 'bg-gradient-to-br from-red-950/80 via-black-900/85 to-black-800/80',
  singleCollapsed: 'bg-gradient-to-br from-red-950/60 via-black-900/65 to-black-800/60',
} as const;

// ===================== Types =====================
export type ClusterItem = {
  id: string;
  title: string;
  start: string; // naive 'YYYY-MM-DDTHH:mm:ss'
  end: string;   // naive 'YYYY-MM-DDTHH:mm:ss'
  teams?: [string, string];
  logos?: [string, string];
  status?: 'scheduled' | 'postponed' | 'live' | 'finished';
  score?: [number, number] | null;
  home_score?: number;
  away_score?: number;
  tournament_name?: string | null;
  tournament_logo?: string | null;
  matchday?: number | null;
  round?: number | null;
};

export type EventPillShrimpProps = {
  items: ClusterItem[];
};

// ===================== Utils =====================
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
/** Short date like DD/MM from naive ISO */
function shortDate(naiveIso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(naiveIso);
  if (!m) return '';
  const [, , mo, d] = m;
  return `${d}/${mo}`;
}

/** Mobile detection (matches Tailwind md breakpoint at 768px) */
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

// ===================== Auto-fit text helper =====================
function AutoFitText({
  text, maxPx = 13, minPx = 9, stepPx = 0.5, className, title,
}: {
  text: string; maxPx?: number; minPx?: number; stepPx?: number; className?: string; title?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement as HTMLElement | null;
    if (!parent) return;

    const fit = () => {
      let size = maxPx;
      el.style.whiteSpace = 'nowrap';
      el.style.display = 'block';
      el.style.overflow = 'hidden';
      el.style.textOverflow = 'ellipsis';

      el.style.fontSize = `${size}px`;
      let i = 0;
      while (i < 100 && size > minPx && el.scrollWidth > parent.clientWidth) {
        size -= stepPx;
        el.style.fontSize = `${size}px`;
        i++;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [text, maxPx, minPx, stepPx]);

  return (
    <span ref={ref} className={className} title={title ?? text}>
      {text}
    </span>
  );
}

// ===================== Team name with long-word handling =====================
export function TeamName({ name, className }: { name: string; className?: string }) {
  const isLongSingleWord = !/\s/.test(name) && name.length > 14;

  return (
    <div className={`w-full max-w-[9rem] min-w-0 px-1 overflow-hidden ${className ?? ''}`}>
      {isLongSingleWord ? (
        <span
          className="block font-extrabold text-white uppercase tracking-wide text-center opacity-80 group-hover:opacity-100 leading-tight [overflow-wrap:anywhere] [word-break:break-word] [hyphens:auto]"
          title={name}
          style={{ fontSize: 'clamp(9px, 2.6vw, 11px)' }}
        >
          {name}
        </span>
      ) : (
        <AutoFitText
          text={name}
          maxPx={11}
          minPx={8}
          className="font-extrabold text-white uppercase tracking-wide text-center opacity-80 group-hover:opacity-100"
        />
      )}
    </div>
  );
}

// ===================== Logo =====================
function Logo({ src, alt, className, size = 'default' }: {
  src: string;
  alt: string;
  className?: string;
  size?: 'compact' | 'default' | 'large';
}) {
  const sizeClasses = {
    compact: 'h-10 w-10 md:h-14 md:w-14',
    default: 'h-14 w-14 md:h-28 md:w-28',
    large: 'h-14 w-14 md:h-24 md:w-24',
  };

  return (
    <div className={`relative shrink-0 ${sizeClasses[size]} rounded-full overflow-hidden p-1 ${className ?? ''}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain scale-[0.9] origin-center logo-container"
        sizes="(max-width: 768px) 56px, 112px"
        priority={false}
      />
    </div>
  );
}

// ===================== Center mark =====================
export function CenterMark({
  text, className, inline = false, maxPx = 30, minPx = 16,
}: {
  text: string; className?: string; inline?: boolean; maxPx?: number; minPx?: number;
}) {
  if (inline) {
    return (
      <AutoFitText
        text={text}
        maxPx={maxPx}
        minPx={minPx}
        className={`text-white font-extrabold leading-none uppercase ${className ?? ''}`}
      />
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center ${className ?? ''}`}
      aria-hidden
    >
      <div className="w-[90%] max-w-[12rem] min-w-0 px-2">
        <AutoFitText
          text={text}
          maxPx={maxPx}
          minPx={minPx}
          className="text-white font-extrabold leading-none uppercase"
        />
      </div>
    </div>
  );
}

// ===================== Desktop Single Match (Original - uses Link) =====================
function DesktopSingleMatch({ item }: { item: ClusterItem }) {
  const a = item.teams?.[0] ?? 'Team A';
  const b = item.teams?.[1] ?? 'Team B';
  const la = item.logos?.[0] ?? '/placeholder.png';
  const lb = item.logos?.[1] ?? '/placeholder.png';
  const timeText = `${hhmm(item.start)} – ${hhmm(item.end)}`;
  const maybeScore = scoreText(item);
  const accent = accentFor(`${a}-${b}`);

  // Tournament and matchday/round info
  const matchdayRound = item.round
    ? `Round ${item.round}`
    : item.matchday
    ? `Αγωνιστική ${item.matchday}`
    : null;

  return (
    <Link
      href={`/matches/${item.id}`}
      className="group relative block h-full w-full"
      aria-label={`${a} vs ${b} — ${maybeScore ?? timeText}`}
      title={`${a} vs ${b}`}
    >
      <div
        className={`relative h-full w-full ml-[2.5px] px-2 py-2 md:px-4 md:py-3 flex flex-col items-center justify-between ${BG.single} transition-all duration-200 group-hover:-translate-y-0.5 overflow-hidden`}
        style={{
          boxSizing: 'border-box',
          border: `1px solid ${accent.solid}`,
          boxShadow: `0 0 0 1px ${accent.ring} inset, 0 14px 26px -16px ${accent.glow}`,
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.5))',
          borderRadius: 0,
        }}
      >
        {/* Top time bar */}
        <div className="relative z-10 w-full flex items-center justify-center px-1 min-w-0">
          <AutoFitText
            text={timeText}
            maxPx={16}
            minPx={11}
            className="font-extrabold leading-tight tracking-wide text-white"
          />
        </div>

        {/* Tournament and matchday/round */}
        {(item.tournament_name || matchdayRound) && (
          <div className="relative z-10 w-full flex flex-col items-center justify-center px-1 min-w-0 mt-0.5 gap-0.5">
            {item.tournament_name && (
              <div className="flex items-center gap-1 w-full justify-center min-w-0">
                {item.tournament_logo ? (
                  <img src={item.tournament_logo} alt={item.tournament_name} className="h-4 w-4 object-contain flex-shrink-0" />
                ) : (
                  <Trophy className="h-4 w-4 flex-shrink-0" />
                )}
                <AutoFitText
                  text={item.tournament_name}
                  maxPx={11}
                  minPx={8}
                  className="font-semibold leading-tight text-white/60"
                />
              </div>
            )}
            {matchdayRound && (
              <AutoFitText
                text={matchdayRound}
                maxPx={10}
                minPx={7}
                className="font-medium leading-tight text-white/50"
              />
            )}
          </div>
        )}

        {/* Logos + VS/Score */}
        <div className="relative z-10 mt-1 md:mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 px-1 md:px-2 w-full max-w-[92%] mx-auto">
          {/* LEFT TEAM */}
          <div className="relative min-w-0 justify-self-end">
            <div className="flex flex-col items-center justify-center">
              <Logo src={la} alt={a} />
              <TeamName name={a} className="mt-1" />
            </div>
          </div>

        {/* VS / Score */}
          <div className="flex items-center justify-center px-2 md:px-4 min-w-0">
            <CenterMark text={maybeScore ?? 'VS'} inline maxPx={18} minPx={11} />
          </div>

          {/* RIGHT TEAM */}
          <div className="relative min-w-0 justify-self-start">
            <div className="flex flex-col items-center justify-center">
              <Logo src={lb} alt={b} />
              <TeamName name={b} className="mt-1" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ===================== Mobile Single Match (Vertical layout, names under logos) =====================
function MobileSingleMatch({ item }: { item: ClusterItem }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const a = item.teams?.[0] ?? 'Team A';
  const b = item.teams?.[1] ?? 'Team B';
  const la = item.logos?.[0] ?? '/placeholder.png';
  const lb = item.logos?.[1] ?? '/placeholder.png';
  const timeText = `${hhmm(item.start)} – ${hhmm(item.end)}`;
  const maybeScore = scoreText(item);
  const centerText = maybeScore ?? shortDate(item.start); // score if finished, else date
  const accent = accentFor(`${a}-${b}`);

  // Tournament and matchday/round info
  const matchdayRound = item.round
    ? `Round ${item.round}`
    : item.matchday
    ? `Αγωνιστική ${item.matchday}`
    : null;

  const handleContainerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (!expanded) setExpanded(true);
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/matches/${item.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!expanded) setExpanded(true);
    }
    if (e.key === 'Escape' && expanded) {
      e.preventDefault();
      setExpanded(false);
    }
  };

  return (
    <div
      className="group relative block h-full w-full"
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${a} vs ${b} — ${maybeScore ?? timeText}`}
      aria-expanded={expanded}
      title={`${a} vs ${b}`}
    >
      <motion.div
        layout
        className={`relative h-full w-full ml-[2.5px] px-2 py-1.5 flex flex-col items-center justify-between transition-all duration-300 overflow-hidden ${
          expanded ? BG.single : BG.singleCollapsed
        }`}
        style={{
          boxSizing: 'border-box',
          border: `1px solid ${accent.solid}`,
          boxShadow: `0 0 0 1px ${accent.ring} inset, 0 14px 26px -16px ${accent.glow}`,
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.5))',
          borderRadius: 0,
        }}
        animate={{
          scale: expanded ? 1.01 : 1,
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Collapsed view — vertical stack: A (logo+name) -> center -> B (logo+name) */}
        <AnimatePresence mode="wait">
          {!expanded && (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex flex-col items-center justify-center gap-2"
            >
              {/* Team A logo + name */}
              <div className="flex flex-col items-center">
                <Logo src={la} alt={a} size="compact" />
                <TeamName name={a} className="mt-0.5" />
              </div>

              {/* Center content */}
              <AutoFitText
                text={centerText}
                maxPx={16}
                minPx={12}
                className="text-white font-extrabold leading-none uppercase"
              />

              {/* Team B logo + name */}
              <div className="flex flex-col items-center">
                <Logo src={lb} alt={b} size="compact" />
                <TeamName name={b} className="mt-0.5" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded view — keep vertical stack, place names under logos */}
        <AnimatePresence mode="wait">
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex flex-col items-center justify-between py-1"
            >
              {/* Close button */}
              <div className="absolute top-1 left-1 z-40">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(false);
                  }}
                  className="bg-black/70 hover:bg-black/85 active:bg-black/95 p-1.5 text-white/90 transition-colors border border-white/10"
                  style={{ borderRadius: 0 }}
                  aria-label="Κλείσιμο"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              {/* Time bar */}
              <div className="relative z-10 w-full flex items-center justify-center px-1 min-w-0 mb-1">
                <AutoFitText
                  text={timeText}
                  maxPx={14}
                  minPx={11}
                  className="font-extrabold leading-tight tracking-wide text-white"
                />
              </div>

              {/* Tournament and matchday/round */}
              {(item.tournament_name || matchdayRound) && (
                <div className="relative z-10 w-full flex flex-col items-center justify-center px-1 min-w-0 mb-1 gap-0.5">
                  {item.tournament_name && (
                    <div className="flex items-center gap-1 w-full justify-center min-w-0">
                      {item.tournament_logo ? (
                        <img src={item.tournament_logo} alt={item.tournament_name} className="h-3.5 w-3.5 object-contain flex-shrink-0" />
                      ) : (
                        <Trophy className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <AutoFitText
                        text={item.tournament_name}
                        maxPx={10}
                        minPx={7}
                        className="font-semibold leading-tight text-white/60"
                      />
                    </div>
                  )}
                  {matchdayRound && (
                    <AutoFitText
                      text={matchdayRound}
                      maxPx={9}
                      minPx={7}
                      className="font-medium leading-tight text-white/50"
                    />
                  )}
                </div>
              )}

              {/* A logo + name */}
              <div className="flex flex-col items-center">
                <Logo src={la} alt={a} size="default" />
                <TeamName name={a} className="mt-1" />
              </div>

              {/* Center: score or date */}
              <AutoFitText
                text={centerText}
                maxPx={22}
                minPx={14}
                className="text-white font-extrabold leading-none uppercase"
              />

              {/* B logo + name */}
              <div className="flex flex-col items-center">
                <Logo src={lb} alt={b} size="default" />
                <TeamName name={b} className="mt-1" />
              </div>

              {/* Navigation button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative z-30 w-full flex justify-center mt-1"
              >
                <button
                  onClick={handleNavigate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/15 text-white text-xs font-bold uppercase tracking-wide transition-colors border border-white/20"
                  style={{ borderRadius: 0 }}
                  aria-label={`Προβολή αγώνα ${a} vs ${b}`}
                >
                  <span>Προβολή Αγώνα</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ===================== Single Match Wrapper =====================
function SingleMatch({ item }: { item: ClusterItem }) {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileSingleMatch item={item} />;
  return <DesktopSingleMatch item={item} />;
}

// ===================== Public component =====================
export default function EventPillShrimp({ items }: EventPillShrimpProps) {
  if (!items?.length) return null;
  if (items.length === 1) {
    return <SingleMatch item={items[0]} />;
  }
  return <MultiMatchCluster items={items} />;
}

/* Optional helpers you referenced */
export const marqueeClass = `
.marquee{display:inline-block;white-space:nowrap;overflow:hidden;animation:marquee 8s linear infinite}
.marquee:hover{animation-play-state:paused}
@keyframes marquee{0%,10%{transform:translateX(0)}50%,60%{transform:translateX(calc(-100% + 10rem))}100%{transform:translateX(0)}}
`;
