'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ===================== Accent palette (curated) =====================
const PALETTE = [
  { h: 14, s: 90, l: 55 },  // orange
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
type ClusterItem = {
  id: string;
  title: string;
  start: string; // naive 'YYYY-MM-DDTHH:mm:ss'
  end: string; // naive 'YYYY-MM-DDTHH:mm:ss'
  teams?: [string, string];
  logos?: [string, string];
};

type EventPillProps = {
  items: ClusterItem[]; // if length > 1 => show accordion-like with exclusive expand over
};

function hhmm(naiveIso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):/.exec(naiveIso);
  return m ? `${m[4]}:${m[5]}` : '';
}

export default function EventPill({ items }: EventPillProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  // ===================== Single-match pill: entire pill is a link =====================
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
          <span className="text-[13px] pb-3 md:text-[15px] font-extrabold tracking-wide text-white/90">
            {timeText}
          </span>
          <div className="flex items-center justify-between w-full">
            {/* Team A */}
            <div className="flex flex-col items-center min-w-0">
              <img src={la} alt={a} className="h-8 w-8 rounded-full object-contain ring-1 ring-white/20" />
              <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                {a}
              </span>
            </div>
            <span className="mx-2 text-white/60 font-black text-[12px] shrink-0">vs</span>
            {/* Team B */}
            <div className="flex flex-col items-center min-w-0">
              <img src={lb} alt={b} className="h-8 w-8 rounded-full object-contain ring-1 ring-white/20" />
              <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                {b}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ===================== Multi-match cluster =====================
  return (
    <div
      className="group relative h-[100%] pb-1 ml-0.5 w-full overflow-hidden"
      style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.5))' }}
    >
      <AnimatePresence>
        {items.map((item, i) => {
          if (expandedIndex !== null && expandedIndex !== i) return null;
          const a = item.teams?.[0] ?? 'Team A';
          const b = item.teams?.[1] ?? 'Team B';
          const la = item.logos?.[0] ?? '/placeholder.png';
          const lb = item.logos?.[1] ?? '/placeholder.png';
          const timeText = `${hhmm(item.start)} – ${hhmm(item.end)}`;
          const accent = accentFor(`${a}-${b}`);
          const isExpanded = expandedIndex === i;

          return (
            <motion.div
              key={item.id}
              layoutId={`event-${item.id}`}
              className={`border overflow-hidden mt-1 ${isExpanded ? 'h-full' : 'flex-shrink-0'}`}
              style={{ borderColor: accent.solid }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <AnimatePresence mode="wait">
                {isExpanded ? (
                  <motion.div
                    key="expanded"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative h-full"
                  >
                    <button
                      className="absolute top-1 left-1 z-10 bg-black/50 rounded-full p-1 text-white hover:bg-black/70"
                      onClick={() => setExpandedIndex(null)}
                      aria-label="Back to list"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {/* View Match CTA */}
                    <Link
                      href={`/matches/${item.id}`}
                      className="absolute top-1 right-1 z-10 bg-white/90 text-black text-xs font-bold rounded-full px-3 py-1 hover:bg-white"
                      aria-label="Προβολή αγώνα"
                    >
                      Προβολή αγώνα
                    </Link>

                    <div
                      className="p-3 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-950/60 via-black-900/85 to-black-800/80 h-full"
                      style={{
                        boxShadow: `0 0 0 1px ${accent.ring} inset, 0 12px 24px -16px ${accent.glow}`,
                      }}
                    >
                      <span className="text-[11px] font-semibold tracking-wide text-white/70 select-none">
                        {timeText}
                      </span>
                      <div className="flex items-center justify-between w-full">
                        {/* Team A */}
                        <div className="flex flex-col items-center min-w-0">
                          <img
                            src={la}
                            alt={a}
                            className="h-8 w-8 rounded-full object-contain ring-1 ring-white/20"
                          />
                          <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                            {a}
                          </span>
                        </div>
                        <span className="mx-2 text-white/60 font-black text-[12px] shrink-0">vs</span>
                        {/* Team B */}
                        <div className="flex flex-col items-center min-w-0">
                          <img
                            src={lb}
                            alt={b}
                            className="h-8 w-8 rounded-full object-contain ring-1 ring-white/20"
                          />
                          <span className="mt-1 max-w-[8rem] truncate font-extrabold text-[12px] text-white uppercase tracking-wide text-center">
                            {b}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    onClick={() => setExpandedIndex(i)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpandedIndex(i)}
                    aria-label={`Expand ${a} vs ${b}`}
                  >
                    <div className="flex justify-between items-center p-5 bg-gradient-to-r from-black/80 to-black/60 text-white text-sm font-semibold">
                      <span>{timeText}</span>
                      <div className="flex items-center gap-2">
                        <img
                          src={la}
                          alt={a}
                          className="h-5 w-5 rounded-full object-contain ring-1 ring-white/20"
                        />
                        <span className="text-white/60 font-black text-sm">vs</span>
                        <img
                          src={lb}
                          alt={b}
                          className="h-5 w-5 rounded-full object-contain ring-1 ring-white/20"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
