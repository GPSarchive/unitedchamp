// src/app/paiktes/PlayersFilterHeader.tsx (OPTIMIZED - React.memo)
"use client";

import { memo, useCallback, useState } from "react";

type Tournament = { id: number; name: string; season: string | null };

type Props = {
  selectedSort: string;
  selectedTournamentId: number | null;
  topInputValue: string;
  tournaments: Tournament[];
  searchQuery: string;
  playerCount: number;
  onSortChange: (sort: string) => void;
  onTournamentChange: (tournamentId: string) => void;
  onTopChange: (top: string) => void;
  onTopInputChange: (value: string) => void;
  onSearchChange: (query: string) => void;
  onReset: () => void;
};

const SORT_OPTIONS = [
  { value: "matches", label: "Αγώνες", icon: "⚽" },
  { value: "wins", label: "Νίκες", icon: "🏆" },
  { value: "goals", label: "Γκολ", icon: "🥅" },
  { value: "assists", label: "Ασίστ", icon: "🤝" },
  { value: "mvp", label: "MVP", icon: "⭐" },
  { value: "bestgk", label: "Best GK", icon: "🧤" },
] as const;

const TOP_PRESETS = [10, 20, 50] as const;

const EXTRA_SORT_LABELS: Record<string, string> = {
  alpha: "Αλφαβητικά",
  tournament_goals: "Γκολ Τουρνουά",
};

function resolveSortLabel(value: string) {
  const known = SORT_OPTIONS.find((opt) => opt.value === value)?.label;
  if (known) return known;
  return EXTRA_SORT_LABELS[value] ?? value;
}

function PlayersFilterHeaderComponent({
  selectedSort,
  selectedTournamentId,
  topInputValue,
  tournaments,
  searchQuery,
  playerCount,
  onSortChange,
  onTournamentChange,
  onTopChange,
  onTopInputChange,
  onSearchChange,
  onReset,
}: Props) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  const handleTournamentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onTournamentChange(e.target.value);
    },
    [onTournamentChange]
  );

  const handleTopBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      onTopChange(e.target.value);
    },
    [onTopChange]
  );

  const handleTopKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        onTopChange((e.target as HTMLInputElement).value);
      }
    },
    [onTopChange]
  );

  const handleTopInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onTopInputChange(e.target.value);
    },
    [onTopInputChange]
  );

  const handleTopPreset = useCallback(
    (n: number) => {
      const val = String(n);
      onTopInputChange(val);
      onTopChange(val);
    },
    [onTopInputChange, onTopChange]
  );

  const handleClearTop = useCallback(() => {
    onTopInputChange("");
    onTopChange("");
  }, [onTopInputChange, onTopChange]);

  // Collect active filter chips
  const activeFilters: { label: string; onClear: () => void }[] = [];

  if (searchQuery.trim()) {
    activeFilters.push({
      label: `"${searchQuery.trim()}"`,
      onClear: () => onSearchChange(""),
    });
  }

  const tournamentName = selectedTournamentId
    ? tournaments.find((t) => t.id === selectedTournamentId)?.name
    : null;
  if (tournamentName) {
    activeFilters.push({
      label: tournamentName,
      onClear: () => onTournamentChange(""),
    });
  }

  if (topInputValue) {
    activeFilters.push({
      label: `Top ${topInputValue}`,
      onClear: handleClearTop,
    });
  }

  if (selectedSort !== "alpha") {
    activeFilters.push({
      label: `Ταξ: ${resolveSortLabel(selectedSort)}`,
      onClear: () => onSortChange("alpha"),
    });
  }

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="z-20 bg-zinc-950">
      {/* ── Search Bar ── */}
      <div className="px-3 md:px-6 pt-3 md:pt-4 pb-2 md:pb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Αναζήτηση παίκτη..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pl-10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 focus:bg-white/[0.07] transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Player count badge */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg whitespace-nowrap">
            <span className="text-white font-mono font-semibold text-sm">{playerCount}</span>
            <span className="text-white/40 text-xs hidden sm:inline">παίκτες</span>
          </div>

          {/* Filter toggle button */}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              filtersExpanded || hasActiveFilters
                ? "bg-cyan-500/10 border-cyan-400/40 text-cyan-300"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white/80 hover:border-white/20"
            }`}
            aria-label="Toggle filters"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="hidden sm:inline">Φίλτρα</span>
            {hasActiveFilters && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500 text-[10px] font-bold text-white">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Active Filter Chips ── */}
      {hasActiveFilters && (
        <div className="px-3 md:px-6 pb-2 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.08] text-white/80 border border-white/10"
            >
              {f.label}
              <button
                onClick={f.onClear}
                className="ml-0.5 text-white/40 hover:text-white/80 transition-colors"
                aria-label={`Remove filter: ${f.label}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={onReset}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors ml-1"
          >
            Καθαρισμός όλων
          </button>
        </div>
      )}

      {/* ── Expandable Filters Panel ── */}
      {filtersExpanded && (
        <div className="px-3 md:px-6 pb-3 border-t border-white/5 pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Tournament Filter */}
            <div>
              <label className="block text-[11px] text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                Τουρνουά
              </label>
              <select
                value={selectedTournamentId ?? ""}
                onChange={handleTournamentChange}
                className="w-full appearance-none bg-white/5 text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all hover:bg-white/[0.07]"
              >
                <option value="">Όλα τα τουρνουά</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.season ? ` (${t.season})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Top N Filter with presets */}
            <div>
              <label className="block text-[11px] text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                Εμφάνιση κορυφαίων
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Αριθμός"
                  value={topInputValue}
                  onChange={handleTopInputChange}
                  onBlur={handleTopBlur}
                  onKeyDown={handleTopKeyDown}
                  className="flex-1 min-w-0 bg-white/5 text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all hover:bg-white/[0.07]"
                />
                <div className="flex gap-1">
                  {TOP_PRESETS.map((n) => (
                    <button
                      key={n}
                      onClick={() => handleTopPreset(n)}
                      className={`px-2 py-2 text-xs font-medium rounded-md border transition-all ${
                        topInputValue === String(n)
                          ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-300"
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reset */}
            <div className="flex items-end">
              <button
                onClick={onReset}
                className="w-full px-4 py-2 bg-white/5 text-white/60 text-sm font-medium border border-white/10 rounded-lg hover:bg-white/10 hover:text-white/80 hover:border-white/20 transition-all"
              >
                Επαναφορά Φίλτρων
              </button>
            </div>
          </div>

          {/* Sort by stat buttons */}
          <div>
            <label className="block text-[11px] text-white/50 font-medium mb-1.5 uppercase tracking-wider">
              Ταξινόμηση κατά
            </label>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className={`
                    px-3 py-1.5 text-xs font-semibold uppercase tracking-wider
                    transition-all duration-200 rounded-full border
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400/80
                    ${
                      selectedSort === opt.value
                        ? "text-orange-200 border-orange-400/60 bg-gradient-to-r from-orange-500/25 to-amber-400/15 shadow-sm shadow-orange-500/20"
                        : "text-white/60 border-white/10 bg-white/5 hover:text-white hover:border-orange-400/50 hover:bg-orange-500/10"
                    }
                  `}
                >
                  {opt.label}
                  {selectedSort === opt.value && (
                    <span className="ml-1 text-orange-300">▼</span>
                  )}
                </button>
              ))}
              {selectedSort !== "alpha" && (
                <button
                  onClick={() => onSortChange("alpha")}
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full border text-white/40 border-white/10 bg-white/5 hover:text-white/60 hover:border-white/20 transition-all"
                >
                  Αλφαβητικά
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PlayersFilterHeader = memo(PlayersFilterHeaderComponent);
export default PlayersFilterHeader;
