// src/app/dashboard/preview/teams-v2/MobileTeamCard.tsx
"use client";

import { memo, useCallback } from "react";
import { MoreVertical, Users, ChevronRight } from "lucide-react";
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
  onTap: (row: TeamCardRow) => void;
  onMenu: (row: TeamCardRow) => void;
};

function MobileTeamCardComponent({ row, onTap, onMenu }: Props) {
  const handleTap = useCallback(() => onTap(row), [onTap, row]);
  const handleMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenu(row);
    },
    [onMenu, row]
  );

  const isArchived = !!row.deleted_at;
  const accent = row.colour || null;

  return (
    <div
      onClick={handleTap}
      role="button"
      className={`group relative flex flex-col rounded-xl border border-white/10 bg-zinc-900/60 p-3.5 hover:border-white/20 hover:bg-zinc-900 transition-colors cursor-pointer ${
        isArchived ? "opacity-60" : ""
      }`}
    >
      {/* Accent stripe */}
      {accent && (
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r"
          style={{ background: accent }}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Logo */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-950 grid place-items-center">
          {row.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.logo}
              alt={row.name}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-[10px] text-white/30">—</span>
          )}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="text-sm font-semibold text-white truncate leading-tight">
              {row.name}
            </h3>
            {isArchived && (
              <span className="shrink-0 mt-0.5 inline-flex items-center rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                Αρχείο
              </span>
            )}
          </div>

          <div className="mt-1 text-xs text-white/55 truncate">
            ID #{row.id}
            {row.am && <span className="ml-1.5 text-white/40">· ΑΜ {row.am}</span>}
          </div>
        </div>

        {/* Kebab */}
        <button
          onClick={handleMenu}
          aria-label="Ενέργειες ομάδας"
          className="shrink-0 -mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      {/* Timestamp line */}
      {(row.created_at || (isArchived && row.deleted_at)) && (
        <div className="mt-2 text-[11px] text-white/40 truncate">
          {isArchived && row.deleted_at ? (
            <>
              <span className="text-amber-400/70">Αρχ.</span>{" "}
              {new Date(row.deleted_at).toLocaleDateString("el-GR")}
            </>
          ) : row.created_at ? (
            <>Δημιουργία {new Date(row.created_at).toLocaleDateString("el-GR")}</>
          ) : null}
        </div>
      )}

      {/* Footer row */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-white/60">
          {row.season_score != null && (
            <span>
              <span className="text-white/40">Σκορ</span>{" "}
              <span className="tabular-nums text-white">{row.season_score}</span>
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-white/50 group-hover:text-white/80 transition-colors">
          <Users className="h-3.5 w-3.5" />
          Ρόστερ
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

const MobileTeamCard = memo(MobileTeamCardComponent);
export default MobileTeamCard;
