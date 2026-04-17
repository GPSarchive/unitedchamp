// src/app/paiktes/PlayersFilterHeader.tsx
"use client";

import { memo, useCallback } from "react";

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
  { value: "matches", label: "Αγώνες" },
  { value: "wins", label: "Νίκες" },
  { value: "goals", label: "Γκολ" },
  { value: "assists", label: "Ασίστ" },
  { value: "mvp", label: "MVP" },
  { value: "bestgk", label: "Τερματοφύλακας" },
] as const;

const EXTRA_SORT_LABELS: Record<string, string> = {
  alpha: "Αλφαβητικά",
  tournament_goals: "Γκολ Τουρνουά",
};

function resolveSortLabel(value: string) {
  const known = SORT_OPTIONS.find((opt) => opt.value === value)?.label;
  if (known) return known;
  return EXTRA_SORT_LABELS[value] ?? value;
}

const pad2 = (n: number | string) => String(n).padStart(2, "0");

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

  // Compose active-filter summary
  const summaryParts: string[] = [];
  const sortLabel = resolveSortLabel(selectedSort);
  if (sortLabel) summaryParts.push(`Ταξινόμηση · ${sortLabel}`);
  const tournamentName = selectedTournamentId
    ? tournaments.find((t) => t.id === selectedTournamentId)?.name
    : null;
  if (tournamentName) summaryParts.push(`Τουρνουά · ${tournamentName}`);
  if (topInputValue) summaryParts.push(`Top · ${topInputValue}`);
  if (searchQuery.trim()) summaryParts.push(`Αναζήτηση · «${searchQuery.trim()}»`);

  const hasAnyFilter = summaryParts.length > 0;

  return (
    <div className="z-20 bg-[#0a0a14]/90 backdrop-blur-sm border-b-2 border-[#F3EFE6]/15">
      {/* ── Row 1: Search + Count ─────────────────────────────────── */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F3EFE6]/10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
              ΑΝΑΖ·
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder='π.χ. «Γιώργος» ή team:Παναθηναϊκός goals:>10'
              className="w-full border-2 border-[#F3EFE6]/20 bg-[#0a0a14] pl-16 pr-4 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70 shrink-0">
            <span>Σύνολο</span>
            <span
              className="font-[var(--f-brutal)] text-base text-[#F3EFE6]"
              style={{ letterSpacing: 0 }}
            >
              {pad2(playerCount)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Tournament + Top-N + Reset ─────────────────────── */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F3EFE6]/10">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          {/* Tournament */}
          <div className="md:col-span-6">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Φίλτρο Τουρνουά
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
                ΔΙΟΡΓ·
              </span>
              <select
                value={selectedTournamentId ?? ""}
                onChange={handleTournamentChange}
                className="w-full appearance-none border-2 border-[#F3EFE6]/20 bg-[#13131d] pl-20 pr-10 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
              >
                <option value="">Όλα τα τουρνουά</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.season ? ` (${t.season})` : ""}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#F3EFE6]/55">
                ▾
              </span>
            </div>
          </div>

          {/* Top-N */}
          <div className="md:col-span-3">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Εμφάνιση Top
            </label>
            <input
              type="number"
              min={1}
              placeholder="π.χ. 20"
              value={topInputValue}
              onChange={handleTopInputChange}
              onBlur={handleTopBlur}
              onKeyDown={handleTopKeyDown}
              className="w-full border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
            />
          </div>

          {/* Reset */}
          <div className="md:col-span-3">
            <label className="mb-1.5 hidden md:block font-mono text-[9px] uppercase tracking-[0.3em] text-transparent select-none">
              .
            </label>
            <button
              onClick={onReset}
              disabled={!hasAnyFilter}
              className={`w-full border-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                hasAnyFilter
                  ? "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c]"
                  : "border-[#F3EFE6]/10 bg-[#13131d]/50 text-[#F3EFE6]/30 cursor-not-allowed"
              }`}
            >
              ↺ Επαναφορά
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 3: Active filters summary ─────────────────────────── */}
      <div
        className="px-4 md:px-6 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55 border-b border-[#F3EFE6]/10 bg-[#13131d]/40"
        aria-live="polite"
      >
        <span className="font-bold text-[#fb923c] mr-2">Ενεργά φίλτρα:</span>
        {hasAnyFilter ? (
          <span>{summaryParts.join(" · ")}</span>
        ) : (
          <span className="text-[#F3EFE6]/40">Κανένα</span>
        )}
      </div>

      {/* ── Row 4: Sort pills ─────────────────────────────────────── */}
      <div className="px-4 md:px-6 py-3 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] shrink-0 mr-2">
            Ταξινόμηση ·
          </span>
          {([
            { value: "alpha", label: "Αλφαβητικά" },
            ...SORT_OPTIONS,
          ] as { value: string; label: string }[]).map((opt) => {
            const active = selectedSort === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-all whitespace-nowrap ${
                  active
                    ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                    : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const PlayersFilterHeader = memo(PlayersFilterHeaderComponent);
export default PlayersFilterHeader;
