'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Match = {
  id: string;
  title: string;
  start: string;
  end: string;
  teams?: [string, string];
  logos?: [string, string];
  status?: 'scheduled' | 'live' | 'finished';
  score?: [number, number];
};

type MatchDay = {
  dateKey: string;
  date: Date;
  matches: Match[];
  isToday: boolean;
  isPast: boolean;
};

function groupByDate(events: Match[]): MatchDay[] {
  const map = new Map<string, Match[]>();

  for (const ev of events) {
    const key = ev.start.slice(0, 10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: MatchDay[] = [];
  for (const [dateKey, matches] of map) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    days.push({
      dateKey,
      date,
      matches: matches.sort((a, b) => a.start.localeCompare(b.start)),
      isToday: date.getTime() === today.getTime(),
      isPast: date.getTime() < today.getTime(),
    });
  }

  return days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function formatDayLabel(date: Date, isToday: boolean): { weekday: string; day: string; month: string } {
  if (isToday) {
    return {
      weekday: 'Σήμερα',
      day: String(date.getDate()),
      month: date.toLocaleDateString('el-GR', { month: 'short' }),
    };
  }
  return {
    weekday: date.toLocaleDateString('el-GR', { weekday: 'short' }),
    day: String(date.getDate()),
    month: date.toLocaleDateString('el-GR', { month: 'short' }),
  };
}

function MiniMatchCard({ match }: { match: Match }) {
  const teamA = match.teams?.[0] ?? 'TBD';
  const teamB = match.teams?.[1] ?? 'TBD';
  const logoA = match.logos?.[0] ?? '/placeholder-team.png';
  const logoB = match.logos?.[1] ?? '/placeholder-team.png';
  const time = match.start.slice(11, 16);
  const hasScore = match.score && match.status === 'finished';
  const isLive = match.status === 'live';

  return (
    <a
      href={`/matches/${match.id}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
    >
      {/* Team A logo + name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div className="relative h-7 w-7 shrink-0">
          <Image src={logoA} alt={teamA} fill className="object-contain" sizes="28px" />
        </div>
        <span className="text-[11px] font-semibold text-white/90 truncate">{teamA}</span>
      </div>

      {/* Score or time */}
      <div className="shrink-0 px-1.5 text-center min-w-[48px]">
        {hasScore ? (
          <span className="text-sm font-bold text-white">
            {match.score![0]} - {match.score![1]}
          </span>
        ) : isLive ? (
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-white">
              {match.score ? `${match.score[0]} - ${match.score[1]}` : 'VS'}
            </span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase">
              <span className="h-1.5 w-1.5 bg-red-400 rounded-full animate-pulse" />
              Live
            </span>
          </div>
        ) : (
          <span className="text-[11px] font-medium text-white/50">{time}</span>
        )}
      </div>

      {/* Team B logo + name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        <span className="text-[11px] font-semibold text-white/90 truncate text-right">{teamB}</span>
        <div className="relative h-7 w-7 shrink-0">
          <Image src={logoB} alt={teamB} fill className="object-contain" sizes="28px" />
        </div>
      </div>
    </a>
  );
}

export default function MatchDayStrip({
  events = [],
  className = '',
}: {
  events?: Match[];
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const matchDays = useMemo(() => groupByDate(events), [events]);

  // Find the index of today or the nearest future day for initial scroll
  const todayIndex = useMemo(() => {
    const idx = matchDays.findIndex((d) => d.isToday);
    if (idx !== -1) return idx;
    // Find nearest future day
    const futureIdx = matchDays.findIndex((d) => !d.isPast);
    return futureIdx !== -1 ? futureIdx : 0;
  }, [matchDays]);

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const target = todayRef.current;
      const scrollLeft = target.offsetLeft - container.offsetLeft - 16;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [todayIndex]);

  // Track scroll position for arrow visibility
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setCanScrollLeft(el.scrollLeft > 20);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [matchDays]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (matchDays.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Scroll arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900/90 border border-white/10 text-white/70 hover:text-white hover:bg-zinc-800 transition-all shadow-lg backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900/90 border border-white/10 text-white/70 hover:text-white hover:bg-zinc-800 transition-all shadow-lg backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Fade edges */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#08080f] to-transparent z-[5] pointer-events-none" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#08080f] to-transparent z-[5] pointer-events-none" />
      )}

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 px-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {matchDays.map((day, i) => {
          const { weekday, day: dayNum, month } = formatDayLabel(day.date, day.isToday);
          const showCount = Math.min(day.matches.length, 4);
          const extra = day.matches.length - showCount;

          return (
            <div
              key={day.dateKey}
              ref={i === todayIndex ? todayRef : undefined}
              className={`
                shrink-0 snap-start flex flex-col rounded-xl border transition-all
                w-[280px] sm:w-[320px]
                ${day.isToday
                  ? 'border-orange-400/60 bg-orange-500/5 shadow-[0_0_20px_rgba(251,146,60,0.08)]'
                  : day.isPast
                    ? 'border-white/5 bg-white/[0.02] opacity-60'
                    : 'border-white/10 bg-white/[0.03]'
                }
              `}
            >
              {/* Date header */}
              <div className={`
                flex items-center gap-3 px-4 py-3 border-b
                ${day.isToday ? 'border-orange-400/20' : 'border-white/5'}
              `}>
                <div className={`
                  flex flex-col items-center justify-center h-12 w-12 rounded-lg
                  ${day.isToday
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-white/5 text-white/70'
                  }
                `}>
                  <span className="text-lg font-bold leading-none">{dayNum}</span>
                  <span className="text-[10px] font-medium uppercase leading-none mt-0.5">{month}</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${day.isToday ? 'text-orange-400' : 'text-white/90'}`}>
                    {weekday}
                  </span>
                  <span className="text-[11px] text-white/40">
                    {day.matches.length} {day.matches.length === 1 ? 'αγώνας' : 'αγώνες'}
                  </span>
                </div>
              </div>

              {/* Match list */}
              <div className="flex flex-col gap-1.5 p-3">
                {day.matches.slice(0, showCount).map((match) => (
                  <MiniMatchCard key={match.id} match={match} />
                ))}
                {extra > 0 && (
                  <div className="text-center text-[11px] text-white/40 pt-1">
                    +{extra} ακόμα {extra === 1 ? 'αγώνας' : 'αγώνες'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
