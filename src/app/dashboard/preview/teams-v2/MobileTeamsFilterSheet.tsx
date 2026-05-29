// src/app/dashboard/preview/teams-v2/MobileTeamsFilterSheet.tsx
"use client";

import { memo, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

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
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md max-h-[85vh] flex flex-col
          rounded-t-2xl bg-zinc-950 border-t border-x border-white/10 shadow-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pt-2 pb-3 flex items-center justify-between border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Φίλτρα</h3>
          <button
            onClick={onReset}
            disabled={!hasAnyFilter}
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
              hasAnyFilter
                ? "text-blue-400 hover:text-blue-300"
                : "text-white/30"
            }`}
          >
            <RotateCcw className="h-3 w-3" />
            Επαναφορά
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <section>
            <label className="mb-2 block text-xs font-medium text-white/55">
              Κατάσταση
            </label>
            <div className="flex rounded-lg border border-white/15 bg-zinc-900 p-0.5">
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onStatusChange(opt.value)}
                    className={`flex-1 rounded-md px-2 py-2 text-sm transition-colors ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="px-4 pt-3 pb-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-blue-500/50 bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Εφαρμογή · {teamCount} {teamCount === 1 ? "ομάδα" : "ομάδες"}
          </button>
        </div>
      </div>
    </div>
  );
}

const MobileTeamsFilterSheet = memo(MobileTeamsFilterSheetComponent);
export default MobileTeamsFilterSheet;
