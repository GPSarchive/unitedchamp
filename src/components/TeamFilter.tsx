"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, X, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// =========================================================
// Types
// =========================================================
type TeamFilterProps = {
  options: string[];
  pinned?: string[];
  logosByTeam?: Record<string, string>;
  value: string | null;
  onChange: (team: string | null) => void;
  placeholder?: string;
  className?: string;
};

// Small helper to highlight query matches
function highlight(text: string, query: string) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  const before = text.slice(0, i);
  const match = text.slice(i, i + query.length);
  const after = text.slice(i + query.length);
  return (
    <>
      {before}
      <mark className="bg-orange-500/30 text-orange-200 rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}

// =========================================================
// Team Filter Component (Combobox-style with search + keyboard nav)
// =========================================================
export default function TeamFilter({
  options,
  pinned = [],
  logosByTeam = {},
  value,
  onChange,
  placeholder = "Αναζήτηση ομάδας...",
  className = "",
}: TeamFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const uniqueOptions = useMemo(() => Array.from(new Set(options)).sort(), [options]);
  const filtered = useMemo(() => {
    if (!query) return uniqueOptions;
    return uniqueOptions.filter((t) => t.toLowerCase().includes(query.toLowerCase()));
  }, [uniqueOptions, query]);

  // For keyboard navigation
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-option]");
    const item = el?.[activeIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered.length, open]);

  function select(team: string | null) {
    onChange(team);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIndex];
      if (pick) select(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // click outside to close
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selectedLogo = value ? logosByTeam?.[value] : undefined;

  return (
    <div ref={containerRef} className={className}>
      {/* Control */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls="team-filter-popover"
        onClick={() => setOpen((v) => !v)}
        className="w-full inline-flex items-center justify-between gap-2 rounded-2xl border border-orange-400/40 bg-zinc-900/70 px-4 py-3 text-left shadow-inner hover:border-orange-400/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {selectedLogo ? (
            <div className="relative h-6 w-6 flex-shrink-0">
              <Image src={selectedLogo} alt={value!} fill className="object-contain" sizes="24px" />
            </div>
          ) : (
            <Search className="h-4 w-4 text-white/50" />
          )}
          <span className={`truncate ${value ? "text-white" : "text-white/50"}`}>
            {value ?? "Αναζήτηση match ομάδας ..."}
          </span>
        </div>
        <ChevronDown className="h-5 w-5 text-white/50" />
      </button>

      {/* Quick actions */}
      <div className="mt-2 flex items-center gap-2 overflow-x-auto hide-scrollbar">

        {pinned?.length > 0 && (
          <div className="flex items-center gap-2">
            {pinned.slice(0, 12).map((t) => {
              const logo = logosByTeam?.[t];
              return (
                <button
                  key={t}
                  onClick={() => select(t)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border flex items-center gap-2 ${
                    value === t
                      ? "bg-orange-500 text-white border-orange-400"
                      : "bg-zinc-800/60 text-white/80 border-zinc-700 hover:bg-zinc-700/60"
                  }`}
                >
                  {logo ? (
                    <span className="relative inline-block h-5 w-5">
                      <Image src={logo} alt={t} fill className="object-contain" sizes="20px" />
                    </span>
                  ) : null}
                  <span className="truncate max-w-[140px]">{t}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="team-filter-popover"
            role="listbox"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
            className="relative z-50 mt-2"
            onKeyDown={onKeyDown}
          >
            <div className="absolute left-0 right-0 rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl shadow-2xl">
              {/* Search input */}
              <div className="flex items-center gap-2 px-3 pt-3">
                <div className="flex items-center gap-2 flex-1 rounded-xl bg-zinc-800/60 px-3">
                  <Search className="h-4 w-4 text-white/50" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder={placeholder}
                    className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="p-1 text-white/50 hover:text-white"
                      aria-label="Καθαρισμός"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {value && (
                  <button
                    onClick={() => select(null)}
                    className="h-9 px-3 rounded-xl text-sm font-semibold bg-zinc-800/60 text-white/80 hover:bg-zinc-700/60 border border-zinc-700"
                  >
                    Καμία επιλογή
                  </button>
                )}
              </div>

              {/* Results list */}
              <div
                ref={listRef}
                className="max-h-[320px] overflow-auto py-2 px-2 mt-1 hide-scrollbar"
              >
                {filtered.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-white/50">
                    Δεν βρέθηκαν αποτελέσματα
                  </div>
                )}

                {filtered.map((team, i) => {
                  const logo = logosByTeam?.[team];
                  return (
                    <button
                      key={team}
                      data-option
                      role="option"
                      aria-selected={value === team}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => select(team)}
                      className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        i === activeIndex
                          ? "bg-zinc-800/80"
                          : "hover:bg-zinc-800/60"
                      }`}
                    >
                      {/* Logo avatar or initials fallback */}
                      {logo ? (
                        <div className="relative h-8 w-8 flex-shrink-0">
                          <Image src={logo} alt={team} fill className="object-contain" sizes="32px" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white/80 text-xs font-bold">
                          {team
                            .split(" ")
                            .slice(0, 2)
                            .map((s) => s[0])
                            .join("")}
                        </div>
                      )}
                      <div className="flex-1 text-sm text-white">
                        {highlight(team, query)}
                      </div>
                      {value === team && (
                        <Check className="h-4 w-4 text-orange-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
