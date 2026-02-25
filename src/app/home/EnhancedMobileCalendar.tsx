'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X } from 'lucide-react';
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

  return (
    <>
      <div className={`bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl ${className}`}>
        <div className={`bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800 p-4 ${isMinimized ? 'rounded-xl border-b-0' : 'rounded-t-xl'}`}>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Προηγούμενος μήνας"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>

            <h2 className="text-lg font-bold text-white uppercase tracking-wide">
              {monthName}
            </h2>

            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Επόμενος μήνας"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="flex-1 py-2 px-4 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 rounded-lg text-sm font-bold text-orange-300 transition-colors"
            >
              Σήμερα
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
              aria-label={isMinimized ? 'Ανάπτυξη ημερολογίου' : 'Σύμπτυξη ημερολογίου'}
            >
              {isMinimized
                ? <ChevronDown className="h-5 w-5 text-white/70" />
                : <ChevronUp className="h-5 w-5 text-white/70" />
              }
            </button>
          </div>

        </div>

        <AnimatePresence initial={false}>
          {!isMinimized && (
            <motion.div
              key="calendar-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="grid grid-cols-7 gap-1 p-2 bg-zinc-900/50">
                {['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ'].map((day, i) => (
                  <div
                    key={i}
                    className="text-center text-xs font-bold text-white/50 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

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
          )}
        </AnimatePresence>
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