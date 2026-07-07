// src/app/dashboard/preview/player-list-mobile/MobileFilterSheet.tsx
"use client";

import { memo, useEffect } from "react";

export type StatusFilter = "active" | "archived" | "all";
export type SortKey =
  | "alpha"
  | "goals"
  | "assists"
  | "yellow"
  | "red"
  | "age"
  | "number";

type TeamLite = { id: number; name: string; logo?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;

  teams: TeamLite[];
  teamId: number | null;
  onTeamChange: (id: number | null) => void;

  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;

  sortKey: SortKey;
  onSortChange: (s: SortKey) => void;

  topInput: string;
  onTopChange: (v: string) => void;

  playerCount: number;
  summaryParts: string[];
  onReset: () => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "alpha", label: "Αλφαβητικά" },
  { value: "goals", label: "Γκολ" },
  { value: "assists", label: "Ασίστ" },
  { value: "yellow", label: "Κίτρινες" },
  { value: "red", label: "Κόκκινες" },
  { value: "age", label: "Ηλικία" },
  { value: "number", label: "Νούμερο" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Ενεργοί" },
  { value: "archived", label: "Αρχείο" },
  { value: "all", label: "Όλοι" },
];

function MobileFilterSheetComponent({
  open,
  onClose,
  teams,
  teamId,
  onTeamChange,
  status,
  onStatusChange,
  sortKey,
  onSortChange,
  topInput,
  onTopChange,
  playerCount,
  summaryParts,
  onReset,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const hasAnyFilter =
    teamId != null ||
    status !== "active" ||
    sortKey !== "alpha" ||
    !!topInput.trim();

  function handleTopChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.trim();
    if (v === "") {
      onTopChange("");
      return;
    }
    const n = Number(v);
    onTopChange(Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : "");
  }

  return (
    <div
      className={`fixed inset-0 z-40 transition ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Φίλτρα"
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col
          bg-[#0a0a14] border-t-2 border-[#F3EFE6]/20 shadow-2xl
          transition-transform duration-200 ease-out
          ${open ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#F3EFE6]/30" />
        </div>

        {/* Header */}
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

        {/* Active filters summary */}
        <div
          className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55 border-b border-[#F3EFE6]/10 bg-[#13131d]/40"
          aria-live="polite"
        >
          <span className="font-bold text-[#fb923c] mr-2">Ενεργά:</span>
          {summaryParts.length ? (
            <span>{summaryParts.join(" · ")}</span>
          ) : (
            <span className="text-[#F3EFE6]/40">Κανένα</span>
          )}
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Status */}
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

          {/* Team */}
          <section>
            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Ομάδα
            </label>
            <div className="relative">
              <select
                value={teamId ?? ""}
                onChange={(e) =>
                  onTeamChange(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full appearance-none border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 pr-10 py-3 font-mono text-[12px] uppercase tracking-[0.22em] text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
              >
                <option value="">Όλες οι ομάδες</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#F3EFE6]/55">
                ▾
              </span>
            </div>
          </section>

          {/* Top-N */}
          <section>
            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Εμφάνιση Top
            </label>
            <input
              type="number"
              min={1}
              placeholder="π.χ. 20"
              value={topInput}
              onChange={handleTopChange}
              inputMode="numeric"
              className="w-full border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-3 font-mono text-[12px] uppercase tracking-[0.22em] text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
            />
          </section>

          {/* Sort */}
          <section>
            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Ταξινόμηση
            </label>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => {
                const active = sortKey === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onSortChange(opt.value)}
                    className={`border-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                      active
                        ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                        : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70 active:text-[#F3EFE6]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Q-syntax help */}
          <section>
            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Σύνταξη Αναζήτησης
            </label>
            <div className="border-2 border-[#F3EFE6]/15 bg-[#13131d]/60 px-3 py-3 font-mono text-[10px] leading-relaxed text-[#F3EFE6]/65 space-y-1">
              <div>
                <span className="text-[#fb923c]">team:</span>Παναθηναϊκός
              </div>
              <div>
                <span className="text-[#fb923c]">position:</span>GK
              </div>
              <div>
                <span className="text-[#fb923c]">goals:</span>&gt;10{" "}
                <span className="text-[#F3EFE6]/35">·</span>{" "}
                <span className="text-[#fb923c]">assists:</span>&gt;5
              </div>
              <div className="pt-1 text-[#F3EFE6]/45 normal-case tracking-normal">
                Συνδυάστε ελεύθερα · διπλά εισαγωγικά για πολλαπλές λέξεις.
              </div>
            </div>
          </section>
        </div>

        {/* Sticky apply button */}
        <div className="px-4 pt-3 pb-4 border-t border-[#F3EFE6]/10 bg-[#0a0a14]">
          <button
            onClick={onClose}
            className="w-full border-2 border-[#fb923c] bg-[#fb923c] py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-[#0a0a14] active:bg-[#fb923c]/85 transition-colors"
          >
            Εφαρμογή · {playerCount} παίκτες
          </button>
        </div>
      </div>
    </div>
  );
}

const MobileFilterSheet = memo(MobileFilterSheetComponent);
export default MobileFilterSheet;
