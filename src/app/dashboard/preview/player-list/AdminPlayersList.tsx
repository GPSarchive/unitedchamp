// src/app/dashboard/preview/player-list/AdminPlayersList.tsx
"use client";

import { memo, useCallback } from "react";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import type { PlayerWithStats } from "../../players/types";

type TeamLite = { id: number; name: string; logo?: string | null };

export type PlayerListRow = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  player_number: number | null;
  height_cm: number | null;
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
  rows: PlayerListRow[];
  onRowClick: (row: PlayerListRow) => void;
  onEdit: (row: PlayerListRow) => void;
  onArchive: (id: number) => void;
  onRestore?: (id: number) => void;
};

// Columns:
//  mobile:  photo | name+team | goals | actions
//  sm+:     photo | name+team+pos | #  | age | goals | ast | YC | RC | actions
const GRID_MOBILE = "grid grid-cols-[44px_minmax(0,1fr)_36px_72px]";
const GRID_DESKTOP =
  "sm:grid-cols-[56px_minmax(0,1fr)_50px_50px_50px_50px_44px_44px_120px] md:grid-cols-[64px_minmax(0,1fr)_60px_60px_60px_60px_50px_50px_140px]";
const GAPS = "gap-2 md:gap-3";

const COLS = [
  { key: "photo", label: "", full: "", align: "text-left", mobile: true },
  { key: "name", label: "Παίκτης", full: "Παίκτης / Ομάδα", align: "text-left", mobile: true },
  { key: "num", label: "#", full: "Νο.", align: "text-center", mobile: false },
  { key: "age", label: "Ηλ.", full: "Ηλικία", align: "text-center", mobile: false },
  { key: "goals", label: "Γκ.", full: "Γκολ", align: "text-center", mobile: true },
  { key: "assists", label: "Ασ.", full: "Ασίστ", align: "text-center", mobile: false },
  { key: "yc", label: "Κ", full: "Κίτρ.", align: "text-center", mobile: false },
  { key: "rc", label: "Κ", full: "Κόκκ.", align: "text-center", mobile: false },
  { key: "actions", label: "", full: "Ενέργειες", align: "text-right", mobile: true },
];

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function getDisplayPhoto(row: PlayerListRow): string {
  if (row.photo && row.photo !== "/player-placeholder.svg") return row.photo;
  const t = row.teams[0];
  return t?.logo || row.photo || "/player-placeholder.svg";
}

function StatCell({
  value,
  highlight,
  accent = "#fb923c",
  className = "",
}: {
  value: number | string;
  highlight?: boolean;
  accent?: string;
  className?: string;
}) {
  const isZero = value === 0 || value === "—";
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span
        className="font-[var(--f-brutal)] text-sm md:text-base leading-none tabular-nums"
        style={{
          color: highlight ? accent : isZero ? "rgba(243,239,230,0.35)" : "#F3EFE6",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const RowItem = memo(function RowItem({
  row,
  index,
  onRowClick,
  onEdit,
  onArchive,
  onRestore,
}: {
  row: PlayerListRow;
  index: number;
  onRowClick: (row: PlayerListRow) => void;
  onEdit: (row: PlayerListRow) => void;
  onArchive: (id: number) => void;
  onRestore?: (id: number) => void;
}) {
  const handleClick = useCallback(() => onRowClick(row), [onRowClick, row]);
  const stopAndEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(row);
    },
    [onEdit, row]
  );
  const stopAndArchive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onArchive(row.id);
    },
    [onArchive, row.id]
  );
  const stopAndRestore = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRestore?.(row.id);
    },
    [onRestore, row.id]
  );

  const displayPhoto = getDisplayPhoto(row);
  const teamName = row.teams[0]?.name ?? "—";
  const isArchived = !!row.deleted_at;

  return (
    <div
      onClick={handleClick}
      className={`${GRID_MOBILE} ${GRID_DESKTOP} ${GAPS}
        px-3 sm:px-4 md:px-6 py-2.5 md:py-3
        border-b border-[#F3EFE6]/10
        cursor-pointer transition-colors
        hover:bg-[#13131d] ${isArchived ? "opacity-60" : ""}`}
      role="button"
    >
      {/* Photo */}
      <div className="flex items-center">
        <div
          className="relative h-9 w-9 sm:h-11 sm:w-11 md:h-12 md:w-12 overflow-hidden border-2"
          style={{ borderColor: "rgba(243,239,230,0.2)", background: "#13131d" }}
        >
          <PlayerImage
            src={displayPhoto}
            alt={`${row.first_name} ${row.last_name}`}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            animate={false}
          />
        </div>
      </div>

      {/* Name + team + position */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="font-mono text-[9px] tabular-nums text-[#F3EFE6]/40 shrink-0">
            {pad2(index + 1)}
          </span>
          <div className="font-[var(--f-display)] text-sm md:text-base font-semibold italic text-[#F3EFE6] truncate">
            {row.first_name} {row.last_name}
          </div>
          {isArchived && (
            <span className="ml-1 shrink-0 border border-[#F3EFE6]/25 px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
              Αρχείο
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/50">
          <span className="truncate">{teamName}</span>
          {row.position && (
            <>
              <span className="text-[#F3EFE6]/25 hidden sm:inline">·</span>
              <span className="hidden sm:inline">{row.position}</span>
            </>
          )}
        </div>
      </div>

      {/* # number */}
      <StatCell
        value={row.player_number ?? "—"}
        className="hidden sm:flex"
      />
      {/* age */}
      <StatCell value={row.age ?? "—"} className="hidden sm:flex" />
      {/* goals */}
      <StatCell value={row.goals} highlight={row.goals > 0} />
      {/* assists */}
      <StatCell
        value={row.assists}
        highlight={row.assists > 0}
        accent="#60a5fa"
        className="hidden sm:flex"
      />
      {/* yellow cards */}
      <StatCell
        value={row.yellow_cards}
        highlight={row.yellow_cards > 0}
        accent="#facc15"
        className="hidden sm:flex"
      />
      {/* red cards */}
      <StatCell
        value={row.red_cards}
        highlight={row.red_cards > 0}
        accent="#ef4444"
        className="hidden sm:flex"
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={stopAndEdit}
          className="border-2 border-[#F3EFE6]/20 bg-[#13131d] px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c] transition-colors"
          title="Επεξεργασία"
        >
          ✎
        </button>
        {isArchived && onRestore ? (
          <button
            onClick={stopAndRestore}
            className="border-2 border-[#F3EFE6]/20 bg-[#13131d] px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/75 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
            title="Επαναφορά"
          >
            ↺
          </button>
        ) : (
          <button
            onClick={stopAndArchive}
            className="border-2 border-[#F3EFE6]/20 bg-[#13131d] px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/75 hover:border-red-400 hover:text-red-400 transition-colors"
            title="Αρχειοθέτηση"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
});

function AdminPlayersListComponent({ rows, onRowClick, onEdit, onArchive, onRestore }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="border-2 border-dashed border-[#F3EFE6]/25 bg-[#13131d]/40 px-10 py-8 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            / 00 · Κατάλογος
          </span>
          <p className="mt-3 font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6]">
            Δεν βρέθηκαν παίκτες
          </p>
          <p className="mt-2 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
            Δοκιμάστε άλλα κριτήρια αναζήτησης.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a14]/95 backdrop-blur-sm border-b-2 border-[#F3EFE6]/15">
        <div
          className={`${GRID_MOBILE} ${GRID_DESKTOP} ${GAPS} px-3 sm:px-4 md:px-6 py-2.5 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55`}
        >
          {COLS.map((col) => (
            <div
              key={col.key}
              className={`${col.align} ${col.mobile ? "" : "hidden sm:block"}`}
            >
              <span className="hidden md:inline">{col.full}</span>
              <span className="md:hidden">{col.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div>
        {rows.map((row, idx) => (
          <RowItem
            key={row.id}
            row={row}
            index={idx}
            onRowClick={onRowClick}
            onEdit={onEdit}
            onArchive={onArchive}
            onRestore={onRestore}
          />
        ))}
      </div>
    </div>
  );
}

const AdminPlayersList = memo(AdminPlayersListComponent);
export default AdminPlayersList;
