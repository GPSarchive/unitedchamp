// src/app/dashboard/preview/teams-v2/MobileTeamActionSheet.tsx
"use client";

import { memo, useEffect, useState } from "react";
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
        className={`absolute inset-x-0 bottom-0 flex flex-col
          bg-[#0a0a14] border-t-2 border-[#F3EFE6]/20 shadow-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#F3EFE6]/30" />
        </div>

        <div className="px-4 pt-2 pb-3 border-b border-[#F3EFE6]/10">
          <div className="font-[var(--f-display)] text-base font-semibold italic text-[#F3EFE6] truncate">
            {row.name}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55 truncate">
            ID #{row.id}
            {row.am ? <span className="ml-2 text-[#fb923c]">ΑΜ {row.am}</span> : null}
          </div>
        </div>

        <div className="px-2 py-2">
          <button
            onClick={() => onOpenPlayers(row)}
            className="w-full flex items-center gap-3 px-3 py-3.5 text-left active:bg-[#13131d] transition-colors"
          >
            <span className="text-[18px] leading-none">👥</span>
            <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-[#F3EFE6]">
              Ρόστερ
            </span>
          </button>

          <button
            onClick={() => onEdit(row)}
            className="w-full flex items-center gap-3 px-3 py-3.5 text-left active:bg-[#13131d] transition-colors"
          >
            <span className="text-[18px] leading-none">✎</span>
            <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-[#F3EFE6]">
              Επεξεργασία
            </span>
          </button>

          {isArchived && onRestore ? (
            <button
              onClick={() => onRestore(row.id)}
              className="w-full flex items-center gap-3 px-3 py-3.5 text-left active:bg-[#13131d] transition-colors"
            >
              <span className="text-[18px] leading-none text-emerald-400">↺</span>
              <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-emerald-400">
                Επαναφορά
              </span>
            </button>
          ) : (
            <button
              onClick={() => onArchive(row.id)}
              className="w-full flex items-center gap-3 px-3 py-3.5 text-left active:bg-[#13131d] transition-colors"
            >
              <span className="text-[18px] leading-none text-red-400">🗄</span>
              <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-red-400">
                Αρχειοθέτηση
              </span>
            </button>
          )}
        </div>

        <div className="px-3 pt-2 pb-3 border-t border-[#F3EFE6]/10">
          <button
            onClick={onClose}
            className="w-full border-2 border-[#F3EFE6]/20 bg-[#13131d] py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-[#F3EFE6]/80 active:text-[#F3EFE6] transition-colors"
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
