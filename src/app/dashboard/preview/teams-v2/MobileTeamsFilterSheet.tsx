// src/app/dashboard/preview/teams-v2/MobileTeamsFilterSheet.tsx
"use client";

import { memo, useEffect, useState } from "react";

export type StatusFilter = "active" | "archived" | "all";

type Props = {
  onClose: () => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  teamCount: number;
  onReset: () => void;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Ενεργές" },
  { value: "archived", label: "Αρχείο" },
  { value: "all", label: "Όλες" },
];

function MobileTeamsFilterSheetComponent({
  onClose,
  status,
  onStatusChange,
  teamCount,
  onReset,
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

  const hasAnyFilter = status !== "active";

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
        aria-label="Φίλτρα"
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col
          bg-[#0a0a14] border-t-2 border-[#F3EFE6]/20 shadow-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#F3EFE6]/30" />
        </div>

        <div className="px-4 pt-2 pb-3 flex items-center justify-between border-b border-[#F3EFE6]/10">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#F3EFE6]">
            Φίλτρα
          </h3>
          <button
            onClick={onReset}
            disabled={!hasAnyFilter}
            className={`font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
              hasAnyFilter
                ? "text-[#fb923c] active:text-[#fb923c]/80"
                : "text-[#F3EFE6]/30"
            }`}
          >
            ↺ Επαναφορά
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <section>
            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Κατάσταση
            </label>
            <div className="flex border-2 border-[#F3EFE6]/20 bg-[#13131d]">
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onStatusChange(opt.value)}
                    className={`flex-1 px-2 py-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                      active
                        ? "bg-[#fb923c] text-[#0a0a14]"
                        : "text-[#F3EFE6]/70 active:text-[#F3EFE6]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="px-4 pt-3 pb-4 border-t border-[#F3EFE6]/10 bg-[#0a0a14]">
          <button
            onClick={onClose}
            className="w-full border-2 border-[#fb923c] bg-[#fb923c] py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-[#0a0a14] active:bg-[#fb923c]/85 transition-colors"
          >
            Εφαρμογή · {teamCount} ομάδες
          </button>
        </div>
      </div>
    </div>
  );
}

const MobileTeamsFilterSheet = memo(MobileTeamsFilterSheetComponent);
export default MobileTeamsFilterSheet;
