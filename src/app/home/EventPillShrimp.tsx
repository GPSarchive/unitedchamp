'use client';

import React, { useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

/** ✅ Background presets (single source of truth) */
const BG = {
  single: 'bg-gradient-to-br from-red-950/80 via-black-900/85 to-black-800/80',
} as const;

// ===================== Types coming from EventCalendar's extendedProps.items =====================
export type ClusterItem = {
  id: string;
  title: string;
  start: string; // naive 'YYYY-MM-DDTHH:mm:ss'
  end: string;   // naive 'YYYY-MM-DDTHH:mm:ss'
  teams?: [string, string];
  logos?: [string, string];
  status?: 'scheduled' | 'live' | 'finished';
  score?: [number, number] | null;
  home_score?: number;
  away_score?: number;
};

export type EventPillShrimpProps = {
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

// ===================== Auto-fit text helper =====================
function AutoFitText({
  text,
  maxPx = 13,
  minPx = 9,
  stepPx = 0.5,
  className,
  title,
}: {
  text: string;
  maxPx?: number;
  minPx?: number;
  stepPx?: number;
  className?: string;
  title?: string;
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

// ===================== Logo (compact on mobile) =====================
function Logo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 h-14 w-14 md:h-28 md:w-28 rounded-full overflow-hidden ${className ?? ''}`}
      aria-hidden={false}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 56px, 112px"
        priority={false}
      />
    </div>
  );
}

// ===================== Center mark =====================
export function CenterMark({
  text,
  className,
  inline = false,
  maxPx = 30,
  minPx = 16,
}: {
  text: string;
  className?: string;
  inline?: boolean;
  maxPx?: number;
  minPx?: number;
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

// ===================== Public component =====================
export default function EventPillShrimp({ items }: EventPillShrimpProps) {
  if (!items?.length) return null;

  if (items.length === 1) {
    const item = items[0];
    const a = item.teams?.[0] ?? 'Team A';
    const b = item.teams?.[1] ?? 'Team B';
    const la = item.logos?.[0] ?? '/placeholder.png';
    const lb = item.logos?.[1] ?? '/placeholder.png';
    const timeText = `${hhmm(item.start)} – ${hhmm(item.end)}`;
    const maybeScore = scoreText(item);
    const accent = accentFor(`${a}-${b}`);

    return (
      <Link
        href={`/matches/${item.id}`}
        className="group relative block h-full w-full"
        aria-label={`${a} vs ${b} — ${maybeScore ?? timeText}`}
        title={`${a} vs ${b}`}
      >
        <div
          className={`relative h-full w-full ml-[2.5px] border px-2 py-2 md:px-4 md:py-3 flex flex-col items-center justify-between ${BG.single} transition-all duration-200 group-hover:-translate-y-0.5 overflow-hidden`}
          style={{
            borderColor: accent.solid,
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

          {/* Logos + VS/Score */}
          <div className="relative z-10 mt-1 md:mt-2 grid grid-cols-1 grid-rows-[auto_auto_auto] md:grid-cols-[1fr_auto_1fr] md:grid-rows-1 gap-y-1 md:gap-y-2 px-1 md:px-2 w-full max-w-[92%] mx-auto">
            {/* LEFT TEAM */}
            <div className="relative min-w-0 justify-self-center md:justify-self-end w-full max-w-[10rem]">
              <div className="flex flex-col items-center justify-center">
                <Logo src={la} alt={a} />
                <TeamName name={a} className="mt-1" />
              </div>
            </div>

            {/* VS / Score */}
            <div className="flex items-center justify-center px-2 md:px-4 min-w-0 max-w-[10rem]">
              <CenterMark
                text={maybeScore ?? 'VS'}
                inline
                maxPx={18}   // smaller on mobile
                minPx={11}
              />
            </div>

            {/* RIGHT TEAM */}
            <div className="relative min-w-0 justify-self-center md:justify-self-start w-full max-w-[10rem]">
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

  return <MultiMatchCluster items={items} />;
}
