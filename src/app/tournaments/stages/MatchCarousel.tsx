"use client";

import React, { useState, useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import { Search, X, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "swiper/css";
import "swiper/css/navigation";

import type { DraftMatch } from "../useTournamentData";
import MatchCard from "./MatchCard";

interface MatchCarouselProps {
  stageIdx: number;
  groupIdx?: number;
  matches: DraftMatch[];
  getTeamName: (id: number) => string;
  getTeamLogo: (id: number) => string | null;
  className?: string;
}

// Helper to highlight query matches
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

// Team Filter Component (adapted from TeamDashboard)
type TeamFilterProps = {
  options: string[];
  logosByTeam: Record<string, string | null>;
  value: string | null;
  onChange: (team: string | null) => void;
  placeholder?: string;
  className?: string;
};

function TeamFilter({
  options,
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
  const listRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
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
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
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
            <img src={selectedLogo} alt={value!} className="h-6 w-6 object-contain" />
          ) : (
            <Search className="h-4 w-4 text-white/50" />
          )}
          <span className={`truncate ${value ? "text-white" : "text-white/50"}`}>
            {value ?? "Αναζήτηση match ομάδας ..."}
          </span>
        </div>
        <ChevronDown className="h-5 w-5 text-white/50" />
      </button>

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
                        <img src={logo} alt={team} className="h-8 w-8 object-contain" />
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

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

const MatchCarousel: React.FC<MatchCarouselProps> = ({
  stageIdx,
  groupIdx,
  matches,
  getTeamName,
  getTeamLogo,
  className = "",
}) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Filter matches by stage and optional group
  const stageMatches = useMemo(() => {
    return matches.filter(
      (m) => m.stageIdx === stageIdx && (groupIdx === undefined || m.groupIdx === groupIdx)
    );
  }, [matches, stageIdx, groupIdx]);

  // Build team list and logo map from matches
  const { allTeams, teamLogos } = useMemo(() => {
    const teams = new Set<string>();
    const logos: Record<string, string | null> = {};

    stageMatches.forEach((match) => {
      if (match.team_a_id) {
        const teamAName = getTeamName(match.team_a_id);
        teams.add(teamAName);
        if (!logos[teamAName]) {
          logos[teamAName] = getTeamLogo(match.team_a_id);
        }
      }
      if (match.team_b_id) {
        const teamBName = getTeamName(match.team_b_id);
        teams.add(teamBName);
        if (!logos[teamBName]) {
          logos[teamBName] = getTeamLogo(match.team_b_id);
        }
      }
    });

    return { allTeams: Array.from(teams).sort(), teamLogos: logos };
  }, [stageMatches, getTeamName, getTeamLogo]);

  // Split into finished and scheduled matches
  const { finishedMatches, scheduledMatches } = useMemo(() => {
    const today = new Date();
    const todayISO = today.toISOString();

    // Finished matches: most recent to oldest
    const finished = stageMatches
      .filter((m) => m.status === "finished")
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return dateB - dateA; // Descending (most recent first)
      });

    // Scheduled matches: closest to today to furthest away
    const scheduled = stageMatches
      .filter((m) => m.status === "scheduled" && (m.match_date ?? "") >= todayISO)
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return dateA - dateB; // Ascending (closest first)
      });

    return { finishedMatches: finished, scheduledMatches: scheduled };
  }, [stageMatches]);

  // Filter matches based on selected team
  const filterMatchesByTeam = (matchList: DraftMatch[]) => {
    if (!selectedTeam) return matchList;

    return matchList.filter((match) => {
      const teamAName = getTeamName(match.team_a_id ?? 0);
      const teamBName = getTeamName(match.team_b_id ?? 0);
      return teamAName === selectedTeam || teamBName === selectedTeam;
    });
  };

  const filteredFinished = filterMatchesByTeam(finishedMatches);
  const filteredScheduled = filterMatchesByTeam(scheduledMatches);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Team Filter */}
      <div className="max-w-2xl mx-auto">
        <TeamFilter
          options={allTeams}
          logosByTeam={teamLogos}
          value={selectedTeam}
          onChange={setSelectedTeam}
          placeholder="Αναζήτηση ομάδας..."
        />
      </div>

      {/* Scheduled Matches Carousel */}
      {filteredScheduled.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-bold text-white">
              Επερχόμενοι Αγώνες
            </h3>
            <span className="text-sm text-gray-400">
              {filteredScheduled.length} {filteredScheduled.length === 1 ? "αγώνας" : "αγώνες"}
            </span>
          </div>

          <Swiper
            modules={[Navigation, Autoplay]}
            spaceBetween={20}
            slidesPerView={1}
            navigation
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 3 },
              1280: { slidesPerView: 4 },
            }}
            className="match-carousel"
          >
            {filteredScheduled.map((match) => (
              <SwiperSlide key={match.db_id ?? `scheduled-${match.team_a_id}-${match.team_b_id}`}>
                <MatchCard
                  match={match}
                  getTeamName={getTeamName}
                  getTeamLogo={getTeamLogo}
                  isFinished={false}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      {/* Finished Matches Carousel */}
      {filteredFinished.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-bold text-white">
              Ολοκληρωμένοι Αγώνες
            </h3>
            <span className="text-sm text-gray-400">
              {filteredFinished.length} {filteredFinished.length === 1 ? "αγώνας" : "αγώνες"}
            </span>
          </div>

          <Swiper
            modules={[Navigation, Autoplay]}
            spaceBetween={20}
            slidesPerView={1}
            navigation
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 3 },
              1280: { slidesPerView: 4 },
            }}
            className="match-carousel"
          >
            {filteredFinished.map((match) => (
              <SwiperSlide key={match.db_id ?? `finished-${match.team_a_id}-${match.team_b_id}`}>
                <MatchCard
                  match={match}
                  getTeamName={getTeamName}
                  getTeamLogo={getTeamLogo}
                  isFinished={true}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      {/* Empty State */}
      {filteredScheduled.length === 0 && filteredFinished.length === 0 && (
        <div className="text-center py-12 bg-black rounded-lg border border-gray-800">
          <p className="text-gray-400 text-lg">
            {selectedTeam
              ? `Η ομάδα ${selectedTeam} δεν έχει αγώνες σε αυτό το στάδιο.`
              : "Δεν υπάρχουν αγώνες για αυτό το στάδιο."}
          </p>
        </div>
      )}
    </div>
  );
};

export default MatchCarousel;
