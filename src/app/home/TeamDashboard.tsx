"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, MapPin, ChevronRight, Trophy, Search, X, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// =========================================================
// Types
// =========================================================
export type Match = {
  id: string;
  title: string;
  start: string; // 'YYYY-MM-DDTHH:mm:ss'
  end: string;
  teams?: [string, string];
  logos?: [string, string];
  status?: "scheduled" | "live" | "finished";
  score?: [number, number];
  venue?: string;
};

export type TeamDashboardProps = {
  allMatches: Match[];
  userTeams?: string[]; // e.g., ["Dolphins", "Eagles"]
  className?: string;
};

// =========================================================
// Utilities
// =========================================================
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(isoString: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(isoString);
  return match ? `${match[1]}:${match[2]}` : "";
}

function formatRelativeTime(isoString: string): string {
  const matchDate = new Date(isoString);
  const now = new Date();
  const diffMs = matchDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 0) return "Ολοκληρώθηκε";
  if (diffMins < 60) return `Σε ${diffMins} λεπτά`;
  if (diffHours < 24) return `Σε ${diffHours} ώρες`;
  if (diffDays === 0) return "Σήμερα";
  if (diffDays === 1) return "Αύριο";
  if (diffDays < 7) return `Σε ${diffDays} ημέρες`;
  return formatDate(isoString).split(" ").slice(0, 2).join(" "); // "Τετάρτη 3"
}

function isUpcoming(isoString: string): boolean {
  return new Date(isoString) > new Date();
}

// Small helper to highlight query matches
function highlight(text: string, query: string) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  const before = text.slice(0, i);
  const match = text.slice(i, i + query.length);
  const after = text.slice(i + query.length);
  return (
    <>
      {before}
      <mark className="bg-orange-500/30 text-orange-200 rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}

// =========================================================
// Modern Team Filter (Combobox-style with search + keyboard nav)
// =========================================================
type TeamFilterProps = {
  options: string[];
  pinned?: string[];
  logosByTeam?: Record<string, string>;
  value: string | null;
  onChange: (team: string | null) => void;
  placeholder?: string;
  className?: string;
};

function TeamFilter({
  options,
  pinned = [],
  logosByTeam = {},
  value,
  onChange,
  placeholder = "Αναζήτηση ομάδας...",
  className = "",
}: TeamFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const uniqueOptions = useMemo(() => Array.from(new Set(options)).sort(), [options]);
  const filtered = useMemo(() => {
    if (!query) return uniqueOptions;
    return uniqueOptions.filter((t) => t.toLowerCase().includes(query.toLowerCase()));
  }, [uniqueOptions, query]);

  // For keyboard navigation
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-option]");
    const item = el?.[activeIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered.length, open]);

  function select(team: string | null) {
    onChange(team);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIndex];
      if (pick) select(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // click outside to close
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selectedLogo = value ? logosByTeam?.[value] : undefined;

  return (
    <div ref={containerRef} className={className}>
      {/* Control */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls="team-filter-popover"
        onClick={() => setOpen((v) => !v)}
        className="w-full inline-flex items-center justify-between gap-2 rounded-2xl border border-orange-400/40 bg-zinc-900/70 px-4 py-3 text-left shadow-inner hover:border-orange-400/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {selectedLogo ? (
            <div className="relative h-6 w-6 flex-shrink-0">
              <Image src={selectedLogo} alt={value!} fill className="object-contain" sizes="24px" />
            </div>
          ) : (
            <Search className="h-4 w-4 text-white/50" />
          )}
          <span className={`truncate ${value ? "text-white" : "text-white/50"}`}>
            {value ?? "Αναζήτηση match ομάδας ..."}
          </span>
        </div>
        <ChevronDown className="h-5 w-5 text-white/50" />
      </button>

      {/* Quick actions */}
      <div className="mt-2 flex items-center gap-2 overflow-x-auto hide-scrollbar">
        
        {pinned?.length > 0 && (
          <div className="flex items-center gap-2">
            {pinned.slice(0, 12).map((t) => {
              const logo = logosByTeam?.[t];
              return (
                <button
                  key={t}
                  onClick={() => select(t)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border flex items-center gap-2 ${
                    value === t
                      ? "bg-orange-500 text-white border-orange-400"
                      : "bg-zinc-800/60 text-white/80 border-zinc-700 hover:bg-zinc-700/60"
                  }`}
                >
                  {logo ? (
                    <span className="relative inline-block h-5 w-5">
                      <Image src={logo} alt={t} fill className="object-contain" sizes="20px" />
                    </span>
                  ) : null}
                  <span className="truncate max-w-[140px]">{t}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="team-filter-popover"
            role="listbox"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
            className="relative z-50 mt-2"
            onKeyDown={onKeyDown}
          >
            <div className="absolute left-0 right-0 rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl shadow-2xl">
              {/* Search input */}
              <div className="flex items-center gap-2 px-3 pt-3">
                <div className="flex items-center gap-2 flex-1 rounded-xl bg-zinc-800/60 px-3">
                  <Search className="h-4 w-4 text-white/50" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder={placeholder}
                    className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="p-1 text-white/50 hover:text-white"
                      aria-label="Καθαρισμός"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {value && (
                  <button
                    onClick={() => select(null)}
                    className="h-9 px-3 rounded-xl text-sm font-semibold bg-zinc-800/60 text-white/80 hover:bg-zinc-700/60 border border-zinc-700"
                  >
                    Καμία επιλογή
                  </button>
                )}
              </div>

              {/* Results list */}
              <div
                ref={listRef}
                className="max-h-[320px] overflow-auto py-2 px-2 mt-1 hide-scrollbar"
              >
                {filtered.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-white/50">
                    Δεν βρέθηκαν αποτελέσματα
                  </div>
                )}

                {filtered.map((team, i) => {
                  const logo = logosByTeam?.[team];
                  return (
                    <button
                      key={team}
                      data-option
                      role="option"
                      aria-selected={value === team}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => select(team)}
                      className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        i === activeIndex
                          ? "bg-zinc-800/80"
                          : "hover:bg-zinc-800/60"
                      }`}
                    >
                      {/* Logo avatar or initials fallback */}
                      {logo ? (
                        <div className="relative h-8 w-8 flex-shrink-0">
                          <Image src={logo} alt={team} fill className="object-contain" sizes="32px" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white/80 text-xs font-bold">
                          {team
                            .split(" ")
                            .slice(0, 2)
                            .map((s) => s[0])
                            .join("")}
                        </div>
                      )}
                      <div className="flex-1 text-sm text-white">
                        {highlight(team, query)}
                      </div>
                      {value === team && (
                        <Check className="h-4 w-4 text-orange-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =========================================================
// Next Match Hero Card
// =========================================================
function NextMatchHero({ match }: { match: Match }) {
  const [teamA, teamB] = match.teams ?? ["Team A", "Team B"];
  const [logoA, logoB] = match.logos ?? ["/placeholder.png", "/placeholder.png"];

  const relativeTime = formatRelativeTime(match.start);
  const dateText = formatDate(match.start);
  const timeText = formatTime(match.start);

  const isLive = match.status === "live";
  const scoreDisplay =
    match.status === "finished" && match.score
      ? `${match.score[0]} — ${match.score[1]}`
      : null;

  return (
    <Link href={`/matches/${match.id}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/20 via-red-900/30 to-black border-2 border-orange-400/40 shadow-2xl"
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-red-500/10" />

        <div className="relative p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-orange-300 uppercase tracking-wider mb-1">
                {isLive ? "🔴 Ζωντανά τώρα" : "Επόμενος Αγώνας"}
              </h2>
              <p className="text-2xl md:text-3xl font-extrabold text-white">{relativeTime}</p>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <Calendar className="h-5 w-5" />
              <Clock className="h-5 w-5" />
            </div>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-center mb-6">
            {/* Team A */}
            <div className="flex flex-col items-center">
              <div className="relative h-20 w-20 md:h-32 md:w-32 mb-3">
                <Image src={logoA} alt={teamA} fill className="object-contain drop-shadow-2xl" sizes="(max-width: 768px) 80px, 128px" priority />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white text-center">{teamA}</h3>
            </div>

            {/* VS / Score */}
            <div className="flex flex-col items-center px-4">
              {scoreDisplay ? (
                <span className="text-3xl md:text-4xl font-extrabold text-white">{scoreDisplay}</span>
              ) : (
                <span className="text-2xl md:text-3xl font-extrabold text-white/70">VS</span>
              )}
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center">
              <div className="relative h-20 w-20 md:h-32 md:w-32 mb-3">
                <Image src={logoB} alt={teamB} fill className="object-contain drop-shadow-2xl" sizes="(max-width: 768px) 80px, 128px" priority />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white text-center">{teamB}</h3>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/80 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{dateText}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{timeText}</span>
            </div>
            {match.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{match.venue}</span>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-6 flex justify-center">
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full transition-colors">
              <span>Προβολή Λεπτομερειών</span>
              <ChevronRight className="h-5 w-5" />
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// =========================================================
// Compact Match Row
// =========================================================
function CompactMatchRow({ match }: { match: Match }) {
  const [teamA, teamB] = match.teams ?? ["Team A", "Team B"];
  const [logoA, logoB] = match.logos ?? ["/placeholder.png", "/placeholder.png"];

  const dateText = formatDate(match.start).split(" ").slice(0, 2).join(" "); // "Τετάρτη 3"
  const timeText = formatTime(match.start);

  return (
    <Link href={`/matches/${match.id}`}>
      <motion.div whileHover={{ x: 4 }} className="flex items-center gap-3 p-4 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-orange-400/30 rounded-xl transition-all group">
        {/* Date/Time */}
        <div className="flex-shrink-0 text-center min-w-[70px]">
          <div className="text-xs font-semibold text-white/50 uppercase">{dateText}</div>
          <div className="text-lg font-bold text-white group-hover:text-orange-400">{timeText}</div>
        </div>

        {/* Teams */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Team A */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative h-10 w-10 flex-shrink-0">
              <Image src={logoA} alt={teamA} fill className="object-contain" sizes="40px" />
            </div>
            <span className="text-sm font-semibold text-white truncate">{teamA}</span>
          </div>

          <span className="text-xs text-white/40 flex-shrink-0">vs</span>

          {/* Team B */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-white truncate">{teamB}</span>
            <div className="relative h-10 w-10 flex-shrink-0">
              <Image src={logoB} alt={teamB} fill className="object-contain" sizes="40px" />
            </div>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-orange-400 flex-shrink-0" />
      </motion.div>
    </Link>
  );
}

// =========================================================
// Main Component
// =========================================================
export default function TeamDashboard({ allMatches = [], userTeams = [], className = "" }: TeamDashboardProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(userTeams.length > 0 ? userTeams[0] : null);

  // Only upcoming matches, sorted by start date
  const upcomingMatches = useMemo(() => {
    return allMatches.filter((m) => isUpcoming(m.start)).sort((a, b) => a.start.localeCompare(b.start));
  }, [allMatches]);

  // Teams from upcoming matches only
  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    upcomingMatches.forEach((match) => {
      if (match.teams) {
        teams.add(match.teams[0]);
        teams.add(match.teams[1]);
      }
    });
    return Array.from(teams).sort();
  }, [upcomingMatches]);

  // Map team -> logo (best-effort from matches)
  const teamLogos = useMemo(() => {
    const map = new Map<string, string>();
    const source = upcomingMatches.length ? upcomingMatches : allMatches;
    source.forEach((m) => {
      if (m.teams && m.logos) {
        const [a, b] = m.teams;
        const [la, lb] = m.logos;
        if (a && la && !map.has(a)) map.set(a, la);
        if (b && lb && !map.has(b)) map.set(b, lb);
      }
    });
    return Object.fromEntries(map);
  }, [upcomingMatches, allMatches]);

  // Filter by selected team (over upcoming only)
  const filteredMatches = useMemo(() => {
    if (!selectedTeam) return upcomingMatches;
    return upcomingMatches.filter((m) => m.teams?.includes(selectedTeam));
  }, [upcomingMatches, selectedTeam]);

  // Next match (soonest)
  const nextMatch = filteredMatches[0] || null;

  // Always show hero when there's at least one match
  const showHero = filteredMatches.length >= 1;

  // Show list INCLUDING the first match (so both hero + list even if only one)
  const listMatches = useMemo(() => {
    return filteredMatches.slice(0, 6);
  }, [filteredMatches]);

  const totalShown = (showHero ? 1 : 0) + listMatches.length;
  const hasMore = filteredMatches.length > totalShown;

  return (
    <div className={className}>
      {/* Team Filter — modern searchable combobox + quick pins */}
      <div className="mb-6">
        <TeamFilter options={allTeams} pinned={userTeams} logosByTeam={teamLogos} value={selectedTeam} onChange={setSelectedTeam} />
      </div>

      {/* No matches state */}
      {filteredMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <Trophy className="h-16 w-16 text-white/20 mb-4" />
          <h3 className="text-xl font-bold text-white/80 mb-2">Δεν υπάρχουν προσεχείς αγώνες</h3>
          <p className="text-white/50">{selectedTeam ? `Η ομάδα ${selectedTeam} δεν έχει προγραμματισμένους αγώνες` : "Δεν υπάρχουν προγραμματισμένοι αγώνες"}</p>
        </div>
      )}

      {/* Next Match Hero — always show if we have at least one */}
      {showHero && nextMatch && (
        <div className="mb-8">
          <NextMatchHero match={nextMatch} />
        </div>
      )}

      {/* Upcoming Matches List — includes the first one too */}
      {listMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              
              Επόμενοι Αγώνες
            </h3>
            {selectedTeam && (
              <button onClick={() => setSelectedTeam(null)} className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                Προβολή όλων →
              </button>
            )}
          </div>

          <div className="space-y-3">
            {listMatches.map((match) => (
              <CompactMatchRow key={match.id} match={match} />
            ))}
          </div>

          {/* View All Link */}
          {hasMore && (
            <div className="mt-4 text-center">
              <Link href="/matches" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                <span>Προβολή Όλων των Αγώνων ({filteredMatches.length})</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
