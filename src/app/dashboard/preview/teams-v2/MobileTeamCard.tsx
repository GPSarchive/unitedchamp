// src/app/dashboard/preview/teams-v2/MobileTeamCard.tsx
"use client";

import { memo, useCallback } from "react";
import type { TeamRow } from "@/app/lib/types";

export type TeamCardRow = {
  id: number;
  name: string;
  am: string | null;
  logo: string | null;
  colour: string | null;
  season_score: number | null;
  created_at: string | null;
  deleted_at: string | null;
  raw: TeamRow;
};

type Props = {
  row: TeamCardRow;
  index: number;
  onTap: (row: TeamCardRow) => void;
  onMenu: (row: TeamCardRow) => void;
};

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function MobileTeamCardComponent({ row, index, onTap, onMenu }: Props) {
  const handleTap = useCallback(() => onTap(row), [onTap, row]);
  const handleMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenu(row);
    },
    [onMenu, row]
  );

  const isArchived = !!row.deleted_at;
  const accent = row.colour || "#fb923c";

  return (
    <div
      onClick={handleTap}
      role="button"
      className={`relative w-full border-2 border-[#F3EFE6]/15 bg-[#13131d] px-3 py-2.5
        active:bg-[#1a1a26] transition-colors
        ${isArchived ? "opacity-60" : ""}`}
    >
      {/* Left color stripe */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: accent }}
      />

      <div className="flex items-start gap-3 pl-1.5">
        {/* Logo */}
        <div
          className="relative h-12 w-12 shrink-0 overflow-hidden border-2 grid place-items-center"
          style={{ borderColor: "rgba(243,239,230,0.2)", background: "#0a0a14" }}
        >
          {row.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.logo}
              alt={row.name}
              loading="lazy"
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/40">
              —
            </span>
          )}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[9px] tabular-nums text-[#F3EFE6]/40 shrink-0">
              {pad2(index + 1)}
            </span>
            <h3 className="font-[var(--f-display)] text-[15px] font-semibold italic text-[#F3EFE6] truncate">
              {row.name}
            </h3>
            {isArchived && (
              <span className="ml-1 shrink-0 border border-[#F3EFE6]/25 px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                Αρχείο
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
            <span className="text-[#F3EFE6]/40">ID</span>
            <span className="tabular-nums">#{row.id}</span>
            {row.am && (
              <>
                <span className="text-[#F3EFE6]/25">·</span>
                <span className="truncate">ΑΜ {row.am}</span>
              </>
            )}
          </div>

          {row.season_score != null && (
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/45">
              Σκορ σεζόν · <span className="text-[#fb923c] tabular-nums">{row.season_score}</span>
            </div>
          )}
        </div>

        {/* Kebab */}
        <button
          onClick={handleMenu}
          aria-label="Ενέργειες ομάδας"
          className="shrink-0 -mr-1 -mt-1 h-9 w-9 flex items-center justify-center text-[#F3EFE6]/60 active:text-[#F3EFE6] transition-colors"
        >
          <span className="text-[18px] leading-none">⋮</span>
        </button>
      </div>

      {/* Footer: tap hint */}
      <div className="mt-2.5 pt-2 border-t border-[#F3EFE6]/10 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/45">
        <span>Πατήστε για ρόστερ</span>
        <span className="text-[#F3EFE6]/35">›</span>
      </div>
    </div>
  );
}

const MobileTeamCard = memo(MobileTeamCardComponent);
export default MobileTeamCard;
