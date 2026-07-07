// src/app/dashboard/preview/teams-v2/MobileTeamActionSheet.tsx
"use client";

import { memo, useEffect, useState } from "react";
import { Users, Pencil, Archive, RotateCcw } from "lucide-react";
import type { TeamCardRow } from "./MobileTeamCard";

type Props = {
  row: TeamCardRow;
  onClose: () => void;
  onEdit: (row: TeamCardRow) => void;
  onArchive: (id: number) => void;
  onRestore?: (id: number) => void;
  onOpenPlayers: (row: TeamCardRow) => void;
};

function MobileTeamActionSheetComponent({
  row,
  onClose,
  onEdit,
  onArchive,
  onRestore,
  onOpenPlayers,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const isArchived = !!row.deleted_at;

  return (
    <div className="fixed inset-0 z-40">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ενέργειες ομάδας"
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md flex flex-col
          rounded-t-2xl bg-zinc-950 border-t border-x border-white/10 shadow-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pt-2 pb-3 border-b border-white/10">
          <div className="text-sm font-semibold text-white truncate">{row.name}</div>
          <div className="mt-0.5 text-xs text-white/55 truncate">
            ID #{row.id}
            {row.am ? <span className="ml-2 text-white/40">· ΑΜ {row.am}</span> : null}
          </div>
        </div>

        <div className="px-2 py-2">
          <button
            onClick={() => onOpenPlayers(row)}
            className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-white/5 transition-colors"
          >
            <Users className="h-4 w-4 text-white/60" />
            <span className="text-sm text-white">Ρόστερ ομάδας</span>
          </button>

          <button
            onClick={() => onEdit(row)}
            className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-white/5 transition-colors"
          >
            <Pencil className="h-4 w-4 text-white/60" />
            <span className="text-sm text-white">Επεξεργασία</span>
          </button>

          {isArchived && onRestore ? (
            <button
              onClick={() => onRestore(row.id)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-emerald-500/5 transition-colors"
            >
              <RotateCcw className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">Επαναφορά</span>
            </button>
          ) : (
            <button
              onClick={() => onArchive(row.id)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-red-500/5 transition-colors"
            >
              <Archive className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-300">Αρχειοθέτηση</span>
            </button>
          )}
        </div>

        <div className="px-3 pt-2 pb-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-white/15 bg-zinc-900 py-2.5 text-sm text-white/80 hover:bg-zinc-800 transition-colors"
          >
            Ακύρωση
          </button>
        </div>
      </div>
    </div>
  );
}

const MobileTeamActionSheet = memo(MobileTeamActionSheetComponent);
export default MobileTeamActionSheet;
