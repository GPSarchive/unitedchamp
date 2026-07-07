// src/app/dashboard/preview/player-list-mobile/MobilePlayerCard.tsx
"use client";

import { memo, useCallback } from "react";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import type { PlayerWithStats } from "../../players/types";
import type { SortKey } from "./MobileFilterSheet";

type TeamLite = { id: number; name: string; logo?: string | null };

export type PlayerCardRow = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  player_number: number | null;
  deleted_at: string | null;
  age: number | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  teams: TeamLite[];
  raw: PlayerWithStats;
};

type Props = {
  row: PlayerCardRow;
  index: number;
  sortKey?: SortKey;
  onTap: (row: PlayerCardRow) => void;
  onMenu: (row: PlayerCardRow) => void;
};

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function getDisplayPhoto(row: PlayerCardRow): string {
  if (row.photo && row.photo !== "/player-placeholder.svg") return row.photo;
  const t = row.teams[0];
  return t?.logo || row.photo || "/player-placeholder.svg";
}

function Stat({
  icon,
  value,
  color,
  emphasized,
}: {
  icon: string;
  value: number;
  color: string;
  emphasized?: boolean;
}) {
  const isZero = value === 0;
  return (
    <div
      className={`flex items-center gap-1 ${
        emphasized ? "border border-[#fb923c]/50 bg-[#fb923c]/10 px-1.5 py-0.5" : ""
      }`}
    >
      <span className="text-[11px] leading-none" aria-hidden>
        {icon}
      </span>
      <span
        className={`font-[var(--f-brutal)] leading-none tabular-nums ${
          emphasized ? "text-[14px]" : "text-[13px]"
        }`}
        style={{ color: emphasized ? color : isZero ? "rgba(243,239,230,0.35)" : color }}
      >
        {value}
      </span>
    </div>
  );
}

function MobilePlayerCardComponent({ row, index, sortKey, onTap, onMenu }: Props) {
  const handleTap = useCallback(() => onTap(row), [onTap, row]);
  const handleMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenu(row);
    },
    [onMenu, row]
  );

  const displayPhoto = getDisplayPhoto(row);
  const teamName = row.teams[0]?.name ?? "—";
  const isArchived = !!row.deleted_at;
  const showBlue = row.blue_cards > 0;

  return (
    <div
      onClick={handleTap}
      role="button"
      className={`relative w-full border-2 border-[#F3EFE6]/15 bg-[#13131d] px-3 py-2.5
        active:bg-[#1a1a26] transition-colors
        ${isArchived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Photo */}
        <div
          className="relative h-14 w-14 shrink-0 overflow-hidden border-2"
          style={{ borderColor: "rgba(243,239,230,0.2)", background: "#0a0a14" }}
        >
          <PlayerImage
            src={displayPhoto}
            alt={`${row.first_name} ${row.last_name}`}
            width={56}
            height={56}
            className="w-full h-full object-cover"
            animate={false}
          />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[9px] tabular-nums text-[#F3EFE6]/40 shrink-0">
              {pad2(index + 1)}
            </span>
            <h3 className="font-[var(--f-display)] text-[15px] font-semibold italic text-[#F3EFE6] truncate">
              {row.first_name} {row.last_name}
            </h3>
            {isArchived && (
              <span className="ml-1 shrink-0 border border-[#F3EFE6]/25 px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                Αρχείο
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
            {row.player_number != null && (
              <span className="text-[#fb923c]">#{row.player_number}</span>
            )}
            {row.position && (
              <>
                {row.player_number != null && (
                  <span className="text-[#F3EFE6]/25">·</span>
                )}
                <span className="truncate">{row.position}</span>
              </>
            )}
          </div>

          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/45 truncate">
            {teamName}
          </div>
        </div>

        {/* Kebab */}
        <button
          onClick={handleMenu}
          aria-label="Ενέργειες"
          className="shrink-0 -mr-1 -mt-1 h-9 w-9 flex items-center justify-center text-[#F3EFE6]/60 active:text-[#F3EFE6] transition-colors"
        >
          <span className="text-[18px] leading-none">⋮</span>
        </button>
      </div>

      {/* Stats strip */}
      <div className="mt-2.5 pt-2 border-t border-[#F3EFE6]/10 flex items-center gap-3">
        <Stat
          icon="⚽"
          value={row.goals}
          color="#fb923c"
          emphasized={sortKey === "goals"}
        />
        <Stat
          icon="🅰"
          value={row.assists}
          color="#60a5fa"
          emphasized={sortKey === "assists"}
        />
        <Stat
          icon="🟨"
          value={row.yellow_cards}
          color="#facc15"
          emphasized={sortKey === "yellow"}
        />
        <Stat
          icon="🟥"
          value={row.red_cards}
          color="#ef4444"
          emphasized={sortKey === "red"}
        />
        {showBlue && <Stat icon="🟦" value={row.blue_cards} color="#38bdf8" />}
        {row.age != null && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/50">
            {row.age} ετών
          </span>
        )}
      </div>
    </div>
  );
}

const MobilePlayerCard = memo(MobilePlayerCardComponent);
export default MobilePlayerCard;
