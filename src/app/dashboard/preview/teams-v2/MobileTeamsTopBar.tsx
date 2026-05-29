// src/app/dashboard/preview/teams-v2/MobileTeamsTopBar.tsx
"use client";

import { memo } from "react";
import { Search, SlidersHorizontal, Plus, RefreshCw } from "lucide-react";

type Props = {
  q: string;
  onQChange: (v: string) => void;
  onOpenFilters: () => void;
  onRefresh: () => void;
  onNew: () => void;
  activeFilterCount: number;
  teamCount: number;
  statusLabel: string;
  refreshing?: boolean;
};

function MobileTeamsTopBarComponent({
  q,
  onQChange,
  onOpenFilters,
  onRefresh,
  onNew,
  activeFilterCount,
  teamCount,
  statusLabel,
  refreshing,
}: Props) {
  return (
    <div
      className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/95 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-3 flex items-center gap-2">
        <h1 className="hidden md:block text-base font-semibold text-white shrink-0 mr-2">
          Ομάδες
        </h1>

        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Αναζήτηση με όνομα ή ΑΜ"
            className="w-full rounded-lg border border-white/15 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
          />
        </div>

        <button
          onClick={onOpenFilters}
          className="relative shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white/80 hover:bg-zinc-800 transition-colors"
          aria-label="Φίλτρα"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Φίλτρα</span>
          {activeFilterCount > 0 && (
            <span
              className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold tabular-nums text-white"
              aria-label={`${activeFilterCount} ενεργά φίλτρα`}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-zinc-900 text-white/80 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          aria-label="Ανανέωση"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>

        <button
          onClick={onNew}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          aria-label="Νέα ομάδα"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Νέα ομάδα</span>
        </button>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-2.5 flex items-center justify-between text-xs text-white/55">
        <span>
          <span className="tabular-nums text-white">{teamCount}</span>{" "}
          {teamCount === 1 ? "ομάδα" : "ομάδες"}
        </span>
        <span>{statusLabel}</span>
      </div>
    </div>
  );
}

const MobileTeamsTopBar = memo(MobileTeamsTopBarComponent);
export default MobileTeamsTopBar;
