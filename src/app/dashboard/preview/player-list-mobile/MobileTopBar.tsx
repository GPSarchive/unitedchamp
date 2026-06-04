// src/app/dashboard/preview/player-list-mobile/MobileTopBar.tsx
"use client";

import { memo } from "react";

type Props = {
  q: string;
  onQChange: (v: string) => void;
  onOpenFilters: () => void;
  onNew: () => void;
  activeFilterCount: number;
  playerCount: number;
  sortLabel: string;
};

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function MobileTopBarComponent({
  q,
  onQChange,
  onOpenFilters,
  onNew,
  activeFilterCount,
  playerCount,
  sortLabel,
}: Props) {
  return (
    <div
      className="sticky top-0 z-30 bg-[#0a0a14]/95 backdrop-blur-sm border-b-2 border-[#F3EFE6]/15"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Row 1: search + filter + new */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
            ΑΝΑΖ·
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Παίκτης ή team:X goals:>10"
            className="w-full border-2 border-[#F3EFE6]/20 bg-[#0a0a14] pl-14 pr-3 py-2 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
          />
        </div>

        <button
          onClick={onOpenFilters}
          className="relative shrink-0 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/80 active:bg-[#1a1a26] transition-colors"
          aria-label="Φίλτρα"
        >
          Φίλτρα
          {activeFilterCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#fb923c] text-[#0a0a14] font-mono text-[10px] font-bold tabular-nums"
              aria-label={`${activeFilterCount} ενεργά φίλτρα`}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={onNew}
          className="shrink-0 border-2 border-[#fb923c] bg-[#fb923c] px-3 py-2 font-mono text-[14px] leading-none text-[#0a0a14] active:bg-[#fb923c]/85 transition-colors"
          aria-label="Νέος παίκτης"
        >
          +
        </button>
      </div>

      {/* Row 2: count + sort summary */}
      <div className="px-3 pb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
        <span>
          <span className="text-[#fb923c]">{pad2(playerCount)}</span> παίκτες
        </span>
        <span>Ταξ · {sortLabel}</span>
      </div>
    </div>
  );
}

const MobileTopBar = memo(MobileTopBarComponent);
export default MobileTopBar;
