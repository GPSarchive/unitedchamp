'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ===================== Accent palette (curated) =====================
const PALETTE = [
  { h: 14, s: 90, l: 55 }, // orange
] as const;

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
    solid: hsl(sw.h, 80, 55), // border
    ring: hsl(sw.h, 80, 55, 0.25), // subtle inner ring
    glow: hsl(sw.h, 90, 50, 0.45), // soft outer glow
  };
}

// ===== Types coming from EventCalendar's extendedProps.items =====
export type ClusterItem = {
  id: string;
  title: string;
  start: string; // naive 'YYYY-MM-DDTHH:mm:ss'
  end: string; // naive 'YYYY-MM-DDTHH:mm:ss'
  teams?: [string, string];
  logos?: [string, string];
};

export type EventPillShrimpProps = {
  items: ClusterItem[]; // if length > 1 => render vertical "rude shrimp" panes
};

function hhmm(naiveIso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):/.exec(naiveIso);
  return m ? `${m[4]}:${m[5]}` : '';
}

// ===================== Public component =====================
export default function EventPillShrimp({ items }: EventPillShrimpProps) {
  const [active, setActive] = useState<number | null>(null);
  const router = useRouter();

  if (!items?.length) return null;

  // Single-match pill (already entirely clickable via <Link/>)
  if (items.length === 1) {
    const item = items[0];
    const a = item.teams?.[0] ?? 'Team A';
    const b = item.teams?.[1] ?? 'Team B';
    const la = item.logos?.[0] ?? '/placeholder.png';
    const lb = item.logos?.[1] ?? '/placeholder.png';
    const timeText = `${hhmm(item.start)} – ${hhmm(item.end)}`;
    const accent = accentFor(`${a}-${b}`);

    return (
      <Link
        href={`/matches/${item.id}`}
        className="group relative h-[100%] pt-1 w-full overflow-shown"
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') (e.currentTarget as HTMLAnchorElement).click();
        }}
        aria-label={`${a} vs ${b} — ${timeText}`}
      >
        <div
          className="relative w-full ml-[2.5px] border px-3 py-2 flex flex-col items-center justify-center gap-2 transition-all duration-200 group-hover:-translate-y-0.5 bg-gradient-to-br from-red-950/80 via-black-900/85 to-black-800/80"
          style={{
            height: '100%',
            borderColor: accent.solid,
            boxShadow: `0 0 0 1px ${accent.ring} inset, 0 12px 24px -16px ${accent.glow}`,
            zIndex: 1,
            overflow: 'hidden',
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.5))',
          }}
        >
          <span className="text-[16px] md:text-[18px] leading-tight pb-2 font-extrabold tracking-wide text-white/90">
            {timeText}
          </span>
          <div className="flex items-center justify-center gap-4 px-2 w-full max-w-[92%] mx-auto">
            {/* Team A */}
            <div className="flex flex-col items-center min-w-0">
              <img src={la} alt={a} className="h-12 w-12 md:h-10 md:w-10 rounded-full object-contain ring-3 ring-white/20" />
              <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                {a}
              </span>
            </div>
            <span className="mx-3 text-white/80 font-extrabold text-[20px] md:text-[22px] leading-none uppercase shrink-0">VS</span>
            {/* Team B */}
            <div className="flex flex-col items-center min-w-0">
              <img src={lb} alt={b} className="h-12 w-12 rounded-full object-contain ring-3 ring-white/20" />
              <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                {b}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ===================== Multi-match cluster: Rude-Shrimp style =====================
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

          const goToMatch = () => router.push(`/matches/${item.id}`);
          const onKeyGoToMatch: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goToMatch();
            }
          };

          return (
            <div
              key={item.id}
              className="relative border rounded-md bg-gradient-to-br from-red-950 via-zinc to-zinc-900 overflow-hidden group focus-within:ring-2 cursor-pointer"
              style={{
                borderColor: accent.solid,
                /* animate flex-grow for the smooth vertical accordion effect */
                flexGrow: expanded ? 4 : 1,
                transition: 'flex-grow 450ms ease',
                minHeight: 0, // allow panes to compress without overflowing
              }}
              onMouseEnter={() => setActive(i)}
              onClick={goToMatch}
              onKeyDown={onKeyGoToMatch}
              role="link"
              tabIndex={0}
              aria-label={`${a} vs ${b} — ${timeText}`}
            >
              {/* subtle overlay shine */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
                style={{ transition: 'opacity 450ms ease', background: 'rgba(255,255,255,0.08)' }}
              />

              {/* Collapsed summary layer (visible when not expanded) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(expanded ? null : i);
                }}
                /* match expanded typography/tint but keep compact height */
                className={`${expanded ? 'hidden' : 'flex flex-col items-center justify-center gap-1 w/full p-3 text-center cursor-pointer select-none'}`.replace('w/full', 'w-full')}
                aria-label={`Expand ${a} vs ${b}`}
              >
                {/* time */}
                <span className="text-[12px] md:text-[13px] font-semibold tracking-wide text-white/80">{timeText}</span>

                {/* logos row centered */}
                <div className="flex items-center justify-center gap-3 px-2 max-w-[92%] mx-auto">
                  <img src={la} alt={a} className="h-12 w-12 md:h-7 md:w-7 rounded-full object-contain ring-3 ring-white/20" />
                  <span className="mx-2 text-white/80 font-extrabold text-[16px] md:text-[18px] leading-none uppercase">VS</span>
                  <img src={lb} alt={b} className="h-12 w-12 md:h-7 md:w-7 rounded-full object-contain ring-3 ring-white/20" />
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
                    className="relative h-full"
                    style={{
                      boxShadow: `0 0 0 1px ${accent.ring} inset, 0 12px 24px -16px ${accent.glow}`,
                    }}
                  >
                    <div className="absolute top-1 left-1 z-10">
                      <button
                        className="bg-red/50 rounded-full p-1 text-white hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActive(null);
                        }}
                        aria-label="Back to list"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Entire expanded card is clickable; removed the top-right CTA */}

                    <div className="p-3 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-950/60 via-black-900/85 to-black-800/80 h-full">
                      <span className="text-[14px] md:text-[16px] leading-tight font-semibold tracking-wide text-white/80 select-none">
                        {timeText}
                      </span>
                      <div className="flex items-center justify-center gap-4 px-2 w-full max-w-[92%] mx-auto">
                        {/* Team A */}
                        <div className="flex flex-col items-center min-w-0">
                          <img
                            src={la}
                            alt={a}
                            className="h-12 w-12 rounded-full object-contain ring-3 ring-white/20"
                          />
                          <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                            {a}
                          </span>
                        </div>
                        <span className="mx-3 text-white/80 font-extrabold text-[20px] md:text-[22px] leading-none uppercase shrink-0">VS</span>
                        {/* Team B */}
                        <div className="flex flex-col items-center min-w-0">
                          <img
                            src={lb}
                            alt={b}
                            className="h-12 w-12 rounded-full object-contain ring-3 ring-white/20"
                          />
                          <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                            {b}
                          </span>
                        </div>
                      </div>
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
}
