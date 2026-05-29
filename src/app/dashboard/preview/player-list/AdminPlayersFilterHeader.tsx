// src/app/dashboard/preview/player-list/AdminPlayersFilterHeader.tsx
"use client";

import { memo, useCallback } from "react";

export type StatusFilter = "active" | "archived" | "all";
export type SortKey = "alpha" | "goals" | "assists" | "age" | "number";

type TeamLite = { id: number; name: string; logo?: string | null };

type Props = {
  q: string;
  onQChange: (v: string) => void;

  teams: TeamLite[];
  teamId: number | null;
  onTeamChange: (id: number | null) => void;

  positions: string[];
  position: string | null;
  onPositionChange: (p: string | null) => void;

  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;

  sortKey: SortKey;
  onSortChange: (s: SortKey) => void;

  playerCount: number;
  onReset: () => void;
  onNew: () => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "alpha", label: "Αλφαβητικά" },
  { value: "goals", label: "Γκολ" },
  { value: "assists", label: "Ασίστ" },
  { value: "age", label: "Ηλικία" },
  { value: "number", label: "Νούμερο" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Ενεργοί" },
  { value: "archived", label: "Αρχείο" },
  { value: "all", label: "Όλοι" },
];

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function AdminPlayersFilterHeaderComponent({
  q,
  onQChange,
  teams,
  teamId,
  onTeamChange,
  positions,
  position,
  onPositionChange,
  status,
  onStatusChange,
  sortKey,
  onSortChange,
  playerCount,
  onReset,
  onNew,
}: Props) {
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onQChange(e.target.value),
    [onQChange]
  );
  const handleTeam = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      onTeamChange(v ? Number(v) : null);
    },
    [onTeamChange]
  );
  const handlePosition = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      onPositionChange(v || null);
    },
    [onPositionChange]
  );

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortKey)?.label;
  const teamLabel = teamId != null ? teams.find((t) => t.id === teamId)?.name : null;

  const summaryParts: string[] = [];
  if (sortLabel) summaryParts.push(`Ταξινόμηση · ${sortLabel}`);
  if (teamLabel) summaryParts.push(`Ομάδα · ${teamLabel}`);
  if (position) summaryParts.push(`Θέση · ${position}`);
  if (status !== "active")
    summaryParts.push(
      `Κατάσταση · ${STATUS_OPTIONS.find((o) => o.value === status)?.label}`
    );
  if (q.trim()) summaryParts.push(`Αναζήτηση · «${q.trim()}»`);

  const hasAnyFilter =
    !!teamLabel || !!position || status !== "active" || !!q.trim() || sortKey !== "alpha";

  return (
    <div className="bg-[#0a0a14]/90 backdrop-blur-sm border-b-2 border-[#F3EFE6]/15">
      {/* Row 1: Search + Count + New */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F3EFE6]/10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
              ΑΝΑΖ·
            </span>
            <input
              type="text"
              value={q}
              onChange={handleSearch}
              placeholder='π.χ. «Γιώργος»'
              className="w-full border-2 border-[#F3EFE6]/20 bg-[#0a0a14] pl-16 pr-4 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70 shrink-0">
            <span>Σύνολο</span>
            <span className="font-[var(--f-brutal)] text-base text-[#F3EFE6]" style={{ letterSpacing: 0 }}>
              {pad2(playerCount)}
            </span>
          </div>
          <button
            onClick={onNew}
            className="shrink-0 border-2 border-[#fb923c] bg-[#fb923c] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a14] hover:bg-[#fb923c]/85 transition-colors"
          >
            + Νέος παίκτης
          </button>
        </div>
      </div>

      {/* Row 2: Team + Position + Status + Reset */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F3EFE6]/10">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          {/* Team */}
          <div className="md:col-span-5">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Ομάδα
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
                ΟΜΑΔ·
              </span>
              <select
                value={teamId ?? ""}
                onChange={handleTeam}
                className="w-full appearance-none border-2 border-[#F3EFE6]/20 bg-[#13131d] pl-16 pr-10 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
              >
                <option value="">Όλες οι ομάδες</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#F3EFE6]/55">▾</span>
            </div>
          </div>

          {/* Position */}
          <div className="md:col-span-3">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Θέση
            </label>
            <div className="relative">
              <select
                value={position ?? ""}
                onChange={handlePosition}
                className="w-full appearance-none border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 pr-10 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
              >
                <option value="">Όλες</option>
                {positions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#F3EFE6]/55">▾</span>
            </div>
          </div>

          {/* Status segmented */}
          <div className="md:col-span-2">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Κατάσταση
            </label>
            <div className="flex border-2 border-[#F3EFE6]/20 bg-[#13131d]">
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onStatusChange(opt.value)}
                    className={`flex-1 px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                      active
                        ? "bg-[#fb923c] text-[#0a0a14]"
                        : "text-[#F3EFE6]/70 hover:text-[#F3EFE6]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          <div className="md:col-span-2">
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

      {/* Row 3: Active filters summary */}
      <div
        className="px-4 md:px-6 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55 border-b border-[#F3EFE6]/10 bg-[#13131d]/40"
        aria-live="polite"
      >
        <span className="font-bold text-[#fb923c] mr-2">Ενεργά φίλτρα:</span>
        {summaryParts.length ? (
          <span>{summaryParts.join(" · ")}</span>
        ) : (
          <span className="text-[#F3EFE6]/40">Κανένα</span>
        )}
      </div>

      {/* Row 4: Sort pills */}
      <div className="px-4 md:px-6 py-3 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] shrink-0 mr-2">
            Ταξινόμηση ·
          </span>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.value;
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

const AdminPlayersFilterHeader = memo(AdminPlayersFilterHeaderComponent);
export default AdminPlayersFilterHeader;
