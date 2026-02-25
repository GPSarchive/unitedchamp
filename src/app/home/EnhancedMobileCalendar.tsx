'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// ===================== Types =====================
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

type DayData = {
  date: Date;
  dayNum: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  matches: Match[];
};

type EnhancedMobileCalendarProps = {
  initialEvents?: Match[];
  className?: string;
  highlightTeams?: string[]; // Teams to highlight with special indicator
};

// ===================== Date Utilities =====================
function getMonthDays(year: number, month: number): DayData[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = (firstDay.getDay() + 6) % 7;
  
  const days: DayData[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonthLastDay = new Date(year, month, 0);
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay.getDate() - i);
    days.push({
      date,
      dayNum: date.getDate(),
      isToday: date.getTime() === today.getTime(),
      isCurrentMonth: false,
      matches: [],
    });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    days.push({
      date,
      dayNum: i,
      isToday: date.getTime() === today.getTime(),
      isCurrentMonth: true,
      matches: [],
    });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date,
      dayNum: i,
      isToday: date.getTime() === today.getTime(),
      isCurrentMonth: false,
      matches: [],
    });
  }

  return days;
}

function groupMatchesByDate(matches: Match[]): Map<string, Match[]> {
  const grouped = new Map<string, Match[]>();
  matches.forEach((match) => {
    const dateKey = match.start.slice(0, 10);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(match);
  });
  return grouped;
}

function formatTime(isoString: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(isoString);
  return match ? `${match[1]}:${match[2]}` : '';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('el-GR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
}

// ===================== Day Cell with Team Logos =====================
function DayCell({ 
  day, 
  onClick,
  highlightTeams = []
}: { 
  day: DayData; 
  onClick: () => void;
  highlightTeams?: string[];
}) {
  const hasMatches = day.matches.length > 0;
  const isClickable = hasMatches && day.isCurrentMonth;
  
  // Get first 3 unique logos to display
  const displayLogos = useMemo(() => {
    const logos: string[] = [];
    const seen = new Set<string>();
    
    for (const match of day.matches) {
      if (match.logos) {
        for (const logo of match.logos) {
          if (!seen.has(logo) && logos.length < 3) {
            logos.push(logo);
            seen.add(logo);
          }
        }
      }
    }
    return logos;
  }, [day.matches]);

  // Check if any match involves highlighted teams
  const hasHighlightedTeam = day.matches.some(match =>
    match.teams?.some(team => highlightTeams.includes(team))
  );

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`
        relative aspect-square p-1 rounded-lg transition-all
        ${day.isToday 
          ? 'bg-orange-500/20 border-2 border-orange-400/60' 
          : day.isCurrentMonth
            ? 'border border-transparent hover:border-white/10'
            : 'opacity-40'
        }
        ${hasMatches && day.isCurrentMonth
          ? 'hover:bg-orange-500/10 cursor-pointer active:scale-95'
          : ''
        }
        ${hasHighlightedTeam && day.isCurrentMonth
          ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-zinc-950'
          : ''
        }
      `}
    >
      {/* Day Number */}
      <div className={`
        text-xs font-semibold mb-1
        ${day.isCurrentMonth ? 'text-white/90' : 'text-white/30'}
      `}>
        {day.dayNum}
      </div>

      {/* Team Logos */}
      {hasMatches && day.isCurrentMonth && (
        <div className="flex flex-wrap justify-center gap-0.5 items-center">
          {displayLogos.map((logo, i) => (
            <div
              key={i}
              className="relative h-12 w-12 rounded-full bg-zinc-800/50 overflow-hidden border border-white/10"
            >
              <Image
                src={logo}
                alt=""
                fill
                className="object-contain p-0.5"
                sizes="32px"
              />
            </div>
          ))}
          {day.matches.length > 3 && (
            <div className="h-8 w-8 rounded-full bg-orange-500/30 border border-orange-400/40 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">
                +{day.matches.length - 3}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Match count indicator */}
      {hasMatches && day.isCurrentMonth && (
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
          <span className="text-[9px] font-bold text-orange-400">
            {day.matches.length}
          </span>
        </div>
      )}

      {/* Highlighted team indicator */}
      {hasHighlightedTeam && (
        <div className="absolute top-0 right-0 h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}

// ===================== Match Card =====================
function MatchCard({ 
  match, 
  isHighlighted 
}: { 
  match: Match;
  isHighlighted: boolean;
}) {
  const [teamA, teamB] = match.teams ?? ['Team A', 'Team B'];
  const [logoA, logoB] = match.logos ?? ['/placeholder.png', '/placeholder.png'];
  const timeRange = `${formatTime(match.start)} - ${formatTime(match.end)}`;
  
  const scoreDisplay = match.status === 'finished' && match.score 
    ? `${match.score[0]} — ${match.score[1]}`
    : null;

  return (
    <a
      href={`/matches/${match.id}`}
      className={`
        block p-4 rounded-lg transition-all active:scale-[0.98]
        ${isHighlighted 
          ? 'bg-gradient-to-br from-blue-900/40 via-black/70 to-blue-800/40 border-2 border-blue-400/50' 
          : 'bg-gradient-to-br from-red-950/60 via-black/70 to-black-800/60 border border-orange-400/30 hover:border-orange-400/50'
        }
      `}
    >
      {isHighlighted && (
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-blue-300 uppercase">Η Ομάδα Σου</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Team A */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="relative h-14 w-14 mb-2">
            <Image
              src={logoA}
              alt={teamA}
              fill
              className="object-contain"
              sizes="56px"
            />
          </div>
          <span className="text-xs font-bold text-white/90 text-center truncate w-full px-1">
            {teamA}
          </span>
        </div>

        {/* VS / Score */}
        <div className="flex flex-col items-center px-2">
          {scoreDisplay ? (
            <span className="text-lg font-extrabold text-white">
              {scoreDisplay}
            </span>
          ) : (
            <span className="text-sm font-bold text-white/70">VS</span>
          )}
          <span className="text-[10px] text-white/50 mt-1 whitespace-nowrap">
            {timeRange}
          </span>
        </div>

        {/* Team B */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="relative h-14 w-14 mb-2">
            <Image
              src={logoB}
              alt={teamB}
              fill
              className="object-contain"
              sizes="56px"
            />
          </div>
          <span className="text-xs font-bold text-white/90 text-center truncate w-full px-1">
            {teamB}
          </span>
        </div>
      </div>

      {/* Status badge */}
      {match.status === 'live' && (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-400/40 rounded-full text-[10px] font-bold text-red-300 uppercase">
            <span className="h-1.5 w-1.5 bg-red-400 rounded-full animate-pulse" />
            Ζωντανά
          </span>
        </div>
      )}
    </a>
  );
}

// ===================== Day Modal =====================
function DayModal({
  day,
  onClose,
  highlightTeams = []
}: {
  day: DayData | null;
  onClose: () => void;
  highlightTeams?: string[];
}) {
  if (!day) return null;

  // Sort matches: highlighted teams first
  const sortedMatches = [...day.matches].sort((a, b) => {
    const aHighlighted = a.teams?.some(t => highlightTeams.includes(t));
    const bHighlighted = b.teams?.some(t => highlightTeams.includes(t));
    if (aHighlighted && !bHighlighted) return -1;
    if (!aHighlighted && bHighlighted) return 1;
    return a.start.localeCompare(b.start);
  });

  // Enhanced iOS-compatible scroll lock
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;

    // Store original styles
    const originalBodyOverflow = body.style.overflow;
    const originalBodyPosition = body.style.position;
    const originalBodyTop = body.style.top;
    const originalBodyWidth = body.style.width;
    const originalHtmlOverflow = html.style.overflow;

    // Apply iOS-compatible scroll lock
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    html.style.overflow = 'hidden';

    // Prevent touch move on background (iOS fix)
    const preventTouchMove = (e: TouchEvent) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
      }
    };

    body.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      // Restore original styles
      body.style.overflow = originalBodyOverflow;
      body.style.position = originalBodyPosition;
      body.style.top = originalBodyTop;
      body.style.width = originalBodyWidth;
      html.style.overflow = originalHtmlOverflow;

      // Restore scroll position
      window.scrollTo(0, scrollY);

      // Remove event listener
      body.removeEventListener('touchmove', preventTouchMove);
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          touchAction: 'none',
          WebkitOverflowScrolling: 'touch'
        } as React.CSSProperties}
        onClick={onClose}
      >
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          style={{ touchAction: 'none' } as React.CSSProperties}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-zinc-900 rounded-2xl shadow-2xl flex flex-col"
          style={{
            touchAction: 'auto',
            maxHeight: 'min(85vh, 85dvh)'
          } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {formatDate(day.date)}
                </h2>
                <p className="text-sm text-white/60 mt-0.5">
                  {day.matches.length} {day.matches.length === 1 ? 'Αγώνας' : 'Αγώνες'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Κλείσιμο"
              >
                <X className="h-6 w-6 text-white/70" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto p-6 space-y-4"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y'
            } as React.CSSProperties}
          >
            {sortedMatches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/50">Δεν υπάρχουν προγραμματισμένοι αγώνες</p>
              </div>
            ) : (
              sortedMatches.map((match) => {
                const isHighlighted = match.teams?.some(t => highlightTeams.includes(t));
                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isHighlighted={isHighlighted || false}
                  />
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===================== Main Component =====================
export default function EnhancedMobileCalendar({ 
  initialEvents = [],
  className = '',
  highlightTeams = []
}: EnhancedMobileCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);

  const matchesByDate = useMemo(
    () => groupMatchesByDate(initialEvents),
    [initialEvents]
  );

  const days = useMemo(() => {
    const monthDays = getMonthDays(currentYear, currentMonth);
    monthDays.forEach((day) => {
      const dateKey =
   `${day.date.getFullYear()}-` +
   String(day.date.getMonth() + 1).padStart(2, "0") + "-" +
   String(day.date.getDate()).padStart(2, "0");
      day.matches = matchesByDate.get(dateKey) ?? [];
    });
    return monthDays;
  }, [currentYear, currentMonth, matchesByDate]);

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('el-GR', {
    month: 'long',
    year: 'numeric',
  });

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const PEEK_HEIGHT = 152; // px — shows Σήμερα + day headers + hint of first row

  return (
    <>
      <div className={`bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden ${className}`}>

        {/* ── Header — compact nav bar, always visible ── */}
        <div className="relative flex items-center gap-2 px-3 py-3 bg-gradient-to-r from-zinc-900 via-zinc-800/60 to-zinc-900 select-none">

          {/* Prev month */}
          <button
            onClick={goToPrevMonth}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors shrink-0"
            aria-label="Προηγούμενος μήνας"
          >
            <ChevronLeft className="h-4 w-4 text-white/60" />
          </button>

          {/* Calendar icon + month name */}
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <svg className="h-4 w-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-bold text-white uppercase tracking-widest truncate">
              {monthName}
            </span>
          </div>

          {/* Next month */}
          <button
            onClick={goToNextMonth}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors shrink-0"
            aria-label="Επόμενος μήνας"
          >
            <ChevronRight className="h-4 w-4 text-white/60" />
          </button>

        </div>

        {/* ── Content: always rendered, height-clipped when minimized ── */}
        <div className="relative">
          <motion.div
            animate={{ height: isMinimized ? PEEK_HEIGHT : 'auto' }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {/* Σήμερα */}
            <div className="px-4 pt-3 pb-1 border-t border-zinc-800/60">
              <button
                onClick={goToToday}
                className="w-full py-2 px-4 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 rounded-lg text-sm font-bold text-orange-300 transition-colors"
              >
                Σήμερα
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 p-2 bg-zinc-900/50">
              {['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ'].map((day, i) => (
                <div key={i} className="text-center text-xs font-bold text-white/50 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1 p-2">
              {days.map((day, index) => (
                <DayCell
                  key={index}
                  day={day}
                  onClick={() => setSelectedDay(day)}
                  highlightTeams={highlightTeams}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-800 p-4 text-xs text-white/50 text-center space-y-1">
              <p>Πατήστε σε ημέρα για να δείτε τους αγώνες</p>
              {highlightTeams.length > 0 && (
                <p className="flex items-center justify-center gap-1.5">
                  <span className="h-2 w-2 bg-blue-400 rounded-full" />
                  <span>= Η ομάδα σου παίζει</span>
                </p>
              )}
            </div>
          </motion.div>

          {/* ── Large white bouncing collapse button — expanded only, top-left ── */}
          <AnimatePresence>
            {!isMinimized && (
              <motion.button
                key="collapse-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, -11, 0] }}
                exit={{ opacity: 0, y: 0 }}
                transition={{
                  opacity: { duration: 0.25 },
                  y: { duration: 1.15, repeat: Infinity, ease: 'easeInOut' },
                }}
                onClick={() => setIsMinimized(true)}
                className="absolute top-3 left-3 z-10 flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-[0_0_32px_6px_rgba(255,255,255,0.18)]"
                aria-label="Σύμπτυξη ημερολογίου"
              >
                <ChevronsUp className="h-8 w-8 text-zinc-900" strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Gradient veil + large bouncing expand button (minimized only) ── */}
          <AnimatePresence>
            {isMinimized && (
              <motion.div
                key="veil"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-3"
                style={{
                  height: 110,
                  background: 'linear-gradient(to bottom, transparent 0%, #09090b 60%)',
                }}
              >
                {/* Large white bouncing button */}
                <motion.button
                  onClick={() => setIsMinimized(false)}
                  animate={{ y: [0, -11, 0] }}
                  transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-[0_0_32px_6px_rgba(255,255,255,0.18)]"
                  aria-label="Ανάπτυξη ημερολογίου"
                  style={{ pointerEvents: 'auto' }}
                >
                  <ChevronsDown className="h-8 w-8 text-zinc-900" strokeWidth={2.5} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {selectedDay && (
        <DayModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          highlightTeams={highlightTeams}
        />
      )}
    </>
  );
}