// src/app/paiktes/PlayersFilterHeader.tsx (OPTIMIZED - React.memo)
"use client";

import { memo, useCallback } from "react";

type Tournament = { id: number; name: string; season: string | null };

type Props = {
  selectedSort: string;
  selectedTournamentId: number | null;
  topN: number | null;
  tournaments: Tournament[];
  searchQuery: string;
  playerCount: number;
  onSortChange: (sort: string) => void;
  onTournamentChange: (tournamentId: string) => void;
  onTopChange: (top: string) => void;
  onSearchChange: (query: string) => void;
  onReset: () => void;
};

// ✅ Move sortOptions outside to prevent recreation
const SORT_OPTIONS = [
  { value: "matches", label: "Αγώνες", column: "matches" },
  { value: "wins", label: "Νίκες", column: "wins" },
  { value: "goals", label: "Γκολ", column: "goals" },
  { value: "assists", label: "Ασίστ", column: "assists" },
  { value: "mvp", label: "MVP", column: "mvp" },
  { value: "bestgk", label: "Best GK", column: "bestgk" },
] as const;

function PlayersFilterHeaderComponent({
  selectedSort,
  selectedTournamentId,
  topN,
  tournaments,
  searchQuery,
  playerCount,
  onSortChange,
  onTournamentChange,
  onTopChange,
  onSearchChange,
  onReset,
}: Props) {
  // ✅ Wrap event handlers in useCallback
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  const handleTournamentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val) {
        onSortChange("tournament_goals");
        onTournamentChange(val);
      } else {
        onTournamentChange("");
      }
    },
    [onSortChange, onTournamentChange]
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

  return (
    <div className="sticky top-0 z-20 bg-zinc-950 border-b border-white/10">
      {/* Search & Count Row */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-white/5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Αναζήτηση παίκτη ή ομάδας..."
              className="w-full bg-white/5 border border-white/10 px-4 py-2.5 md:py-3 pl-10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all md:rounded-none rounded-md"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
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
          </div>
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 md:py-3 bg-white/5 border border-white/10 md:rounded-none rounded-md whitespace-nowrap">
            <span className="text-white/50 text-sm">Σύνολο:</span>
            <span className="text-white font-mono font-semibold">{playerCount}</span>
          </div>
        </div>
      </div>

      {/* Tournament & Top Filters */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-white/5 bg-zinc-950/50">
        {/* Mobile: Stacked layout */}
        <div className="flex flex-col gap-3 md:hidden">
          {/* Tournament Filter - Full width on mobile */}
          <div className="w-full">
            <label className="block text-xs text-white/50 font-medium mb-2 uppercase tracking-wider">
              Φίλτρο Τουρνουά
            </label>
            <select
              value={selectedTournamentId ?? ""}
              onChange={handleTournamentChange}
              className="w-full appearance-none bg-white/5 text-white border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all hover:bg-white/[0.07] rounded-md"
            >
              <option value="">— Όλα τα τουρνουά —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.season ? ` (${t.season})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Top N and Reset - Side by side on mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 font-medium mb-2 uppercase tracking-wider">
                Εμφάνιση Top
              </label>
              <input
                type="number"
                min={1}
                placeholder="π.χ. 20"
                defaultValue={topN ?? ""}
                onBlur={handleTopBlur}
                onKeyDown={handleTopKeyDown}
                className="w-full bg-white/5 text-white border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all hover:bg-white/[0.07] rounded-md"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={onReset}
                className="w-full px-3 py-2.5 bg-white/5 text-white/70 text-sm font-medium border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all rounded-md"
              >
                Επαναφορά
              </button>
            </div>
          </div>
        </div>

        {/* Desktop: Original grid layout */}
        <div className="hidden md:grid md:grid-cols-12 gap-3 items-end">
          {/* Tournament Filter */}
          <div className="md:col-span-5">
            <label className="block text-xs text-white/50 font-medium mb-2 uppercase tracking-wider">
              Φίλτρο Τουρνουά
            </label>
            <select
              value={selectedTournamentId ?? ""}
              onChange={handleTournamentChange}
              className="w-full appearance-none bg-white/5 text-white border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all hover:bg-white/[0.07]"
            >
              <option value="">— Όλα τα τουρνουά —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.season ? ` (${t.season})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Top N Input */}
          <div className="md:col-span-3">
            <label className="block text-xs text-white/50 font-medium mb-2 uppercase tracking-wider">
              Εμφάνιση Top
            </label>
            <input
              type="number"
              min={1}
              placeholder="π.χ. 20"
              defaultValue={topN ?? ""}
              onBlur={handleTopBlur}
              onKeyDown={handleTopKeyDown}
              className="w-full bg-white/5 text-white border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all hover:bg-white/[0.07]"
            />
          </div>

          {/* Reset Button */}
          <div className="md:col-span-4">
            <button
              onClick={onReset}
              className="w-full px-4 py-2.5 bg-white/5 text-white/70 text-sm font-medium border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              Επαναφορά Φίλτρων
            </button>
          </div>
        </div>
      </div>

      {/* Sort Buttons Row */}
      <div className="border-b border-white/5">
        {/* Mobile: Horizontal scroll */}
        <div className="md:hidden overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max gap-0 px-4">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`
                  flex-shrink-0 px-4 py-3 text-xs font-semibold uppercase tracking-wider
                  transition-all duration-200
                  border-b-2
                  text-center
                  ${
                    selectedSort === opt.value
                      ? "text-cyan-400 border-cyan-400 bg-cyan-400/10"
                      : "text-white/50 border-transparent hover:text-white/80 hover:bg-white/5"
                  }
                `}
              >
                {opt.label}
                {selectedSort === opt.value && (
                  <span className="ml-1 text-cyan-400">▼</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: Grid aligned with table columns */}
        <div className="hidden md:block px-6 py-3">
          <div className="grid grid-cols-[80px_1fr_80px_80px_80px_80px_80px_80px] gap-4">
            {/* Photo column - empty */}
            <div></div>

            {/* Player name column - empty */}
            <div></div>

            {/* Sortable columns */}
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`
                  px-2 py-2 text-xs font-semibold uppercase tracking-wider
                  transition-all duration-200
                  border-b-2
                  text-center
                  ${
                    selectedSort === opt.value
                      ? "text-cyan-400 border-cyan-400 bg-cyan-400/10"
                      : "text-white/50 border-transparent hover:text-white/80 hover:bg-white/5"
                  }
                `}
              >
                {opt.label}
                {selectedSort === opt.value && (
                  <span className="ml-1 text-cyan-400">▼</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Export memoized component
const PlayersFilterHeader = memo(PlayersFilterHeaderComponent);
export default PlayersFilterHeader;