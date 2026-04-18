"use client";

/**
 * EditorialCalendar — sandbox redesign of the month calendar.
 * Same behavior as EnhancedMobileCalendar: month grid, tap day → modal,
 * minimize/expand, Σήμερα jump. Styling swapped to the editorial language:
 * hard edges, mono-caps chrome, Fraunces italic, Archivo Black numerals.
 */

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, X, MapPin, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";

// ===================== Types =====================
type Match = {
  id: string;
  title: string;
  start: string;
  end: string;
  teams?: [string, string];
  logos?: [string, string];
  status?: "scheduled" | "live" | "finished";
  score?: [number, number];
  tournament_name?: string | null;
  tournament_logo?: string | null;
  matchday?: number | null;
  round?: number | null;
  venue?: string;
};

type DayData = {
  date: Date;
  dayNum: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  matches: Match[];
};

type Props = {
  initialEvents?: Match[];
  className?: string;
  highlightTeams?: string[];
};

// ===================== Constants =====================
const GR_WEEKDAYS_SHORT = ["ΚΥΡ", "ΔΕΥ", "ΤΡΙ", "ΤΕΤ", "ΠΕΜ", "ΠΑΡ", "ΣΑΒ"];
const GR_WEEKDAY_HEADERS = ["ΔΕΥ", "ΤΡΙ", "ΤΕΤ", "ΠΕΜ", "ΠΑΡ", "ΣΑΒ", "ΚΥΡ"];
const GR_MONTHS_LONG = [
  "Ιανουάριος",
  "Φεβρουάριος",
  "Μάρτιος",
  "Απρίλιος",
  "Μάιος",
  "Ιούνιος",
  "Ιούλιος",
  "Αύγουστος",
  "Σεπτέμβριος",
  "Οκτώβριος",
  "Νοέμβριος",
  "Δεκέμβριος",
];

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
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
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
  matches.forEach((m) => {
    const key = m.start.slice(0, 10);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  });
  return grouped;
}

function formatTime(iso: string) {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ===================== Day Cell =====================
const MAX_VISIBLE_MATCHES = 3;

function DayCell({
  day,
  onClick,
  highlightTeams = [],
}: {
  day: DayData;
  onClick: () => void;
  highlightTeams?: string[];
}) {
  const hasMatches = day.matches.length > 0;
  const isClickable = hasMatches && day.isCurrentMonth;

  const visibleMatches = day.matches.slice(0, MAX_VISIBLE_MATCHES);
  const extraMatches = Math.max(0, day.matches.length - MAX_VISIBLE_MATCHES);

  const hasHighlightedTeam = day.matches.some((m) =>
    m.teams?.some((t) => highlightTeams.includes(t))
  );

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`
        group relative flex flex-col items-stretch p-1.5 md:p-2 text-left
        min-h-[72px] md:min-h-[120px]
        border border-[#F3EFE6]/10
        transition-all duration-200
        ${
          day.isToday
            ? "bg-[#fb923c]/[0.08] border-[#fb923c]/80"
            : day.isCurrentMonth
            ? "bg-[#0a0a14]"
            : "bg-[#08080f] opacity-40"
        }
        ${isClickable ? "cursor-pointer hover:bg-[#fb923c]/[0.08] hover:border-[#fb923c]/60 active:scale-[0.98]" : ""}
        ${hasHighlightedTeam && day.isCurrentMonth ? "outline outline-2 outline-offset-[-2px] outline-[#60a5fa]/70" : ""}
      `}
    >
      {/* Day number — Archivo Black */}
      <span
        className={`
          font-[var(--f-brutal)] leading-none text-left
          ${day.isToday ? "text-[#fb923c]" : day.isCurrentMonth ? "text-[#F3EFE6]" : "text-[#F3EFE6]/30"}
        `}
        style={{ fontSize: "clamp(0.85rem, 2vw, 1.15rem)" }}
      >
        {pad2(day.dayNum)}
      </span>

      {/* "Σήμερα" mono strip on today */}
      {day.isToday && (
        <span className="mt-0.5 font-mono text-[7px] md:text-[8px] uppercase tracking-[0.3em] text-[#fb923c]/90 leading-none">
          ΣΗΜΕΡΑ
        </span>
      )}

      {/* Match pairs — up to 3 per cell. Logos scale up when fewer pairs. */}
      {hasMatches && day.isCurrentMonth && (() => {
        const count = visibleMatches.length;
        // bigger logos when there are fewer pairs — fills the cell
        const logoBox =
          count === 1
            ? "h-9 w-9 md:h-14 md:w-14"
            : count === 2
            ? "h-7 w-7 md:h-11 md:w-11"
            : "h-6 w-6 md:h-9 md:w-9";
        const imgSizes =
          count === 1
            ? "(max-width: 768px) 36px, 56px"
            : count === 2
            ? "(max-width: 768px) 28px, 44px"
            : "(max-width: 768px) 24px, 36px";
        const rowGap =
          count === 1
            ? "gap-[3px] md:gap-1.5"
            : count === 2
            ? "gap-[2px] md:gap-1"
            : "gap-[2px] md:gap-[3px]";

        return (
          <div className="my-auto flex flex-col items-center justify-center gap-[3px] md:gap-1.5 pt-1">
            {visibleMatches.map((m, i) => {
              const [logoA, logoB] = m.logos ?? [null, null];
              const isLive = m.status === "live";
              return (
                <div
                  key={m.id ?? i}
                  className={`flex items-center ${rowGap} ${isLive ? "outline outline-1 outline-[#fb923c]/60" : ""}`}
                >
                  {logoA && (
                    <div className={`relative ${logoBox} bg-[#13131d] border border-[#F3EFE6]/15 overflow-hidden`}>
                      <Image
                        src={logoA}
                        alt=""
                        fill
                        className="object-contain p-[1px]"
                        sizes={imgSizes}
                      />
                    </div>
                  )}
                  {logoB && (
                    <div className={`relative ${logoBox} bg-[#13131d] border border-[#F3EFE6]/15 overflow-hidden`}>
                      <Image
                        src={logoB}
                        alt=""
                        fill
                        className="object-contain p-[1px]"
                        sizes={imgSizes}
                      />
                    </div>
                  )}
                </div>
              );
            })}

          {/* +N overflow chip */}
          {extraMatches > 0 && (
            <span
              className="font-[var(--f-brutal)] text-[9px] md:text-[10px] text-[#fb923c] border border-[#fb923c]/60 px-1 leading-none py-[3px]"
              title={`${day.matches.length} αγώνες συνολικά`}
            >
              +{extraMatches}
            </span>
          )}
          </div>
        );
      })()}

      {/* Corner pip — total match count */}
      {hasMatches && day.isCurrentMonth && day.matches.length > 0 && (
        <span
          className="absolute top-0.5 right-0.5 md:top-1 md:right-1 font-mono text-[8px] md:text-[9px] leading-none tracking-[0.15em] text-[#fb923c]/80 font-bold"
          aria-hidden
        >
          ·{pad2(day.matches.length)}
        </span>
      )}

      {/* Highlighted team dot */}
      {hasHighlightedTeam && (
        <span className="absolute top-0 left-0 h-1.5 w-1.5 bg-[#60a5fa] animate-pulse" />
      )}
    </button>
  );
}

// ===================== Modal Match Card =====================
function ModalMatchRow({ match, isHighlighted }: { match: Match; isHighlighted: boolean }) {
  const [teamA, teamB] = match.teams ?? ["Ομάδα Α", "Ομάδα Β"];
  const [logoA, logoB] = match.logos ?? ["/placeholder.png", "/placeholder.png"];
  const time = formatTime(match.start);
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const score =
    isFinished && match.score ? `${match.score[0]} — ${match.score[1]}` : null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`
        group block relative border-2 transition-all duration-300
        ${
          isHighlighted
            ? "border-[#60a5fa]/60 bg-[#13131d]"
            : "border-[#F3EFE6]/20 bg-[#0a0a14] hover:border-[#fb923c]/60"
        }
      `}
      style={
        isHighlighted
          ? { boxShadow: "6px 6px 0 0 #60a5fa" }
          : { boxShadow: "6px 6px 0 0 #fb923c" }
      }
    >
      {/* Top strip */}
      <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em]">
        {isHighlighted ? (
          <span className="flex items-center gap-2 text-[#60a5fa] font-bold">
            <span className="h-1.5 w-1.5 bg-[#60a5fa] rounded-full animate-pulse" />
            Η ομάδα σου
          </span>
        ) : isLive ? (
          <span className="flex items-center gap-2 text-[#fb923c] font-bold">
            <span className="h-1.5 w-1.5 bg-[#fb923c] rounded-full animate-pulse" />
            Ζωντανά
          </span>
        ) : isFinished ? (
          <span className="text-[#E8B931] font-bold">Έληξε</span>
        ) : (
          <span className="flex items-center gap-2 text-[#F3EFE6]/70 font-bold">
            <span className="h-[2px] w-4 bg-[#F3EFE6]/60" />
            {time}
          </span>
        )}
        {score ? (
          <span className="font-[var(--f-brutal)] text-sm text-[#F3EFE6]">{score}</span>
        ) : (
          <span className="text-[#F3EFE6]/55">{time}</span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-4 md:px-5 md:py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-5">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="relative h-12 w-12 md:h-14 md:w-14">
              <Image src={logoA} alt={teamA} fill className="object-contain" sizes="56px" />
            </div>
            <span className="font-[var(--f-display)] italic font-black text-[#F3EFE6] leading-tight text-sm md:text-base truncate w-full">
              {teamA}
            </span>
          </div>

          <span className="font-[var(--f-brutal)] italic text-[#F3EFE6]/25 text-xl md:text-2xl leading-none select-none">
            VS
          </span>

          <div className="flex flex-col items-center text-center gap-2">
            <div className="relative h-12 w-12 md:h-14 md:w-14">
              <Image src={logoB} alt={teamB} fill className="object-contain" sizes="56px" />
            </div>
            <span className="font-[var(--f-display)] italic font-black text-[#F3EFE6] leading-tight text-sm md:text-base truncate w-full">
              {teamB}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      {(match.tournament_name || match.matchday || match.round || match.venue) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#F3EFE6]/10 bg-[#0d0d18] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/65">
          {match.tournament_name && (
            <span className="flex items-center gap-1.5">
              {match.tournament_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    resolveImageUrl(match.tournament_logo, ImageType.TOURNAMENT) ||
                    match.tournament_logo
                  }
                  alt=""
                  className="h-3.5 w-3.5 object-contain"
                />
              ) : (
                <Trophy className="h-3 w-3" />
              )}
              <span className="text-[#F3EFE6]/80 truncate max-w-[180px]">
                {match.tournament_name}
              </span>
            </span>
          )}
          {(match.round || match.matchday) && (
            <span>{match.round ? `R${match.round}` : `Αγ. ${match.matchday}`}</span>
          )}
          {match.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {match.venue}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

// ===================== Day Modal =====================
function DayModal({
  day,
  onClose,
  highlightTeams = [],
}: {
  day: DayData | null;
  onClose: () => void;
  highlightTeams?: string[];
}) {
  useEffect(() => {
    if (!day) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const origBO = body.style.overflow;
    const origBP = body.style.position;
    const origBT = body.style.top;
    const origBW = body.style.width;
    const origHO = html.style.overflow;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overflow = "hidden";

    const preventTouchMove = (e: TouchEvent) => {
      if (e.target === e.currentTarget) e.preventDefault();
    };
    body.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      body.style.overflow = origBO;
      body.style.position = origBP;
      body.style.top = origBT;
      body.style.width = origBW;
      html.style.overflow = origHO;
      window.scrollTo(0, scrollY);
      body.removeEventListener("touchmove", preventTouchMove);
    };
  }, [day]);

  if (!day) return null;

  const sortedMatches = [...day.matches].sort((a, b) => {
    const aH = a.teams?.some((t) => highlightTeams.includes(t));
    const bH = b.teams?.some((t) => highlightTeams.includes(t));
    if (aH && !bH) return -1;
    if (!aH && bH) return 1;
    return a.start.localeCompare(b.start);
  });

  const weekdayLabel = GR_WEEKDAYS_SHORT[day.date.getDay()];
  const monthLabel = GR_MONTHS_LONG[day.date.getMonth()];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ touchAction: "none" } as React.CSSProperties}
        onClick={onClose}
      >
        <div
          className="absolute inset-0 bg-[#08080f]/85 backdrop-blur-sm"
          style={{ touchAction: "none" } as React.CSSProperties}
        />

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-[#0a0a14] border-2 border-[#F3EFE6]/25 flex flex-col"
          style={{
            maxHeight: "min(85vh, 85dvh)",
            boxShadow: "12px 12px 0 0 #fb923c",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Orange top strip */}
          <div className="h-[3px] w-full bg-[#fb923c]" />

          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#13131d] border-b-2 border-[#F3EFE6]/15 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] mb-2">
                  <span className="h-[2px] w-6 bg-[#fb923c]" />
                  {weekdayLabel} · {monthLabel}
                </div>
                <h2 className="font-[var(--f-display)] italic font-black text-[#F3EFE6] leading-none flex items-baseline gap-3">
                  <span style={{ fontSize: "clamp(2.25rem, 6vw, 3.5rem)" }}>
                    {pad2(day.dayNum)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/55 not-italic font-normal">
                    {pad2(day.matches.length)}{" "}
                    {day.matches.length === 1 ? "αγώνας" : "αγώνες"}
                  </span>
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Κλείσιμο"
                className="shrink-0 border-2 border-[#F3EFE6]/25 bg-[#0a0a14] p-2 hover:border-[#fb923c] hover:text-[#fb923c] text-[#F3EFE6]/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            className="flex-1 overflow-y-auto p-6 space-y-5"
            style={
              {
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                touchAction: "pan-y",
              } as React.CSSProperties
            }
          >
            {sortedMatches.length === 0 ? (
              <div
                className="relative border-2 border-dashed border-[#F3EFE6]/25 p-8 text-center"
                style={{ background: "rgba(19,19,29,0.4)" }}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                  / 00 · Κενή ημέρα
                </span>
                <p className="mt-3 font-[var(--f-display)] italic text-xl font-black text-[#F3EFE6]">
                  Δεν υπάρχουν αγώνες
                </p>
              </div>
            ) : (
              sortedMatches.map((m) => {
                const isH = m.teams?.some((t) => highlightTeams.includes(t)) || false;
                return <ModalMatchRow key={m.id} match={m} isHighlighted={isH} />;
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===================== Main Component =====================
export default function EditorialCalendar({
  initialEvents = [],
  className = "",
  highlightTeams = [],
}: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);

  const matchesByDate = useMemo(() => groupMatchesByDate(initialEvents), [initialEvents]);

  const days = useMemo(() => {
    const monthDays = getMonthDays(currentYear, currentMonth);
    monthDays.forEach((day) => {
      const key =
        `${day.date.getFullYear()}-` +
        String(day.date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(day.date.getDate()).padStart(2, "0");
      day.matches = matchesByDate.get(key) ?? [];
    });
    return monthDays;
  }, [currentYear, currentMonth, matchesByDate]);

  const monthLabel = GR_MONTHS_LONG[currentMonth];

  const goPrev = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };
  const goNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };
  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const totalMatchesThisMonth = useMemo(
    () => days.filter((d) => d.isCurrentMonth).reduce((n, d) => n + d.matches.length, 0),
    [days]
  );

  const PEEK_HEIGHT = 172;

  return (
    <>
      <div
        className={`relative border-2 border-[#F3EFE6]/20 bg-[#0a0a14] ${className}`}
        style={{ boxShadow: "8px 8px 0 0 #fb923c" }}
      >
        {/* Top accent strip */}
        <div className="h-[3px] w-full bg-[#fb923c]" />

        {/* Masthead row */}
        <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-3 select-none">
          <button
            onClick={goPrev}
            className="shrink-0 border border-[#F3EFE6]/20 bg-[#0a0a14] p-1.5 hover:border-[#fb923c] hover:text-[#fb923c] text-[#F3EFE6]/70 transition-colors"
            aria-label="Προηγούμενος μήνας"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="font-mono text-[11px] md:text-[12px] uppercase tracking-[0.35em] text-[#fb923c]/90">
              Ημερολόγιο
            </span>
            <div className="flex items-baseline gap-2.5 min-w-0">
              <h3
                className="font-[var(--f-display)] italic font-black text-[#F3EFE6] leading-none truncate"
                style={{ fontSize: "clamp(1.35rem, 3.6vw, 2rem)" }}
              >
                {monthLabel}
              </h3>
              <span className="font-mono text-[11px] md:text-[12px] uppercase tracking-[0.28em] text-[#F3EFE6]/65">
                {currentYear}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <AnimatePresence>
              {!isMinimized && (
                <motion.button
                  key="collapse"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ opacity: { duration: 0.18 } }}
                  onClick={() => setIsMinimized(true)}
                  aria-label="Σύμπτυξη"
                  className="shrink-0 border border-[#F3EFE6]/20 bg-[#0a0a14] p-1.5 hover:border-[#fb923c] hover:text-[#fb923c] text-[#F3EFE6]/60 transition-colors"
                >
                  <ChevronsUp className="h-3.5 w-3.5" strokeWidth={2} />
                </motion.button>
              )}
            </AnimatePresence>
            <button
              onClick={goNext}
              className="shrink-0 border border-[#F3EFE6]/20 bg-[#0a0a14] p-1.5 hover:border-[#fb923c] hover:text-[#fb923c] text-[#F3EFE6]/70 transition-colors"
              aria-label="Επόμενος μήνας"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Sub-toolbar — stats + Σήμερα */}
        <div className="flex items-center justify-between gap-3 border-b border-[#F3EFE6]/10 bg-[#0d0d18] px-4 py-2.5">
          <div className="flex items-center gap-4 font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/55">
            <span>
              Αγώνες ·{" "}
              <span className="text-[#F3EFE6]">{pad2(totalMatchesThisMonth)}</span>
            </span>
            <span className="hidden sm:inline">
              Ημέρες ·{" "}
              <span className="text-[#F3EFE6]">
                {pad2(
                  days.filter((d) => d.isCurrentMonth && d.matches.length > 0).length
                )}
              </span>
            </span>
          </div>
          <button
            onClick={goToday}
            className="border-2 border-[#fb923c] bg-[#fb923c]/10 px-4 py-1.5 font-mono text-[12px] md:text-[13px] uppercase tracking-[0.3em] text-[#fb923c] hover:bg-[#fb923c] hover:text-[#08080f] transition-colors"
          >
            Σήμερα
          </button>
        </div>

        {/* Content — height-clipped when minimized */}
        <div className="relative">
          <motion.div
            animate={{ height: isMinimized ? PEEK_HEIGHT : "auto" }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b-2 border-[#F3EFE6]/15 bg-[#0d0d18]">
              {GR_WEEKDAY_HEADERS.map((d, i) => (
                <div
                  key={i}
                  className={`
                    text-center font-mono text-[9px] uppercase tracking-[0.3em] py-2
                    ${i >= 5 ? "text-[#fb923c]/80" : "text-[#F3EFE6]/55"}
                  `}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
              {days.map((day, i) => (
                <DayCell
                  key={i}
                  day={day}
                  onClick={() => setSelectedDay(day)}
                  highlightTeams={highlightTeams}
                />
              ))}
            </div>

            {/* Footer / legend */}
            <div className="border-t-2 border-[#F3EFE6]/15 bg-[#0d0d18] px-4 py-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/55">
              <span>Πατήστε σε ημέρα για λεπτομέρειες</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-[#fb923c]/80 inline-block" />
                  Σήμερα
                </span>
                {highlightTeams.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-[#60a5fa] inline-block" />
                    Η ομάδα σου
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Minimized state — fade + expand pill */}
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
                  background: "linear-gradient(to bottom, transparent 0%, #0a0a14 65%)",
                }}
              >
                <motion.button
                  onClick={() => setIsMinimized(false)}
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  aria-label="Ανάπτυξη ημερολογίου"
                  className="pointer-events-auto flex items-center gap-2 border-2 border-[#F3EFE6]/30 bg-[#0a0a14] px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c] transition-colors"
                >
                  <ChevronsDown className="h-3 w-3" strokeWidth={2} />
                  Ανάπτυξη
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
