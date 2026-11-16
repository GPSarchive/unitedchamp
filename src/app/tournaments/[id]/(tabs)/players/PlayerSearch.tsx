// The search over «Όλοι οι παίκτες». The rows are drawn on the server; this
// only hides the ones that do not match, with the same matching as /paiktes
// (accents, case, word order and greeklish all fold away: "γιαν", "gian",
// "giannhs" all find Γιάννης). A team's name matches its players too.
"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { matchesTokens, queryTokens, type SearchKeys } from "@/app/preview/paiktes-v2/model";
import { FOCUS_RING } from "@/app/preview/paiktes-v2/DirectoryClient";

export type SearchRow = { id: number; keys: SearchKeys; node: React.ReactNode };

export function PlayerSearch({
  rows,
  header,
  frameClassName,
  frameStyle,
}: {
  rows: SearchRow[];
  /** The column labels, drawn above the list inside the frame. */
  header: React.ReactNode;
  frameClassName: string;
  frameStyle: React.CSSProperties;
}) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const shown = useMemo(() => {
    const tokens = queryTokens(deferred);
    return tokens.length === 0 ? rows : rows.filter((r) => matchesTokens(r.keys, tokens));
  }, [rows, deferred]);
  const searching = q.trim() !== "";

  return (
    <>
      {/* Stays in reach while the list scrolls, under the site's navbar (same offsets as /paiktes). */}
      <div className="sticky top-14 z-20 -mx-1 mb-4 bg-[#0a0a14] px-1 py-2 md:top-28">
        <div className="relative">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#F3EFE6]/50"
          >
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && q) {
                e.preventDefault();
                setQ("");
              }
            }}
            placeholder="Αναζήτηση παίκτη ή ομάδας"
            aria-label="Αναζήτηση παίκτη ή ομάδας"
            autoComplete="off"
            enterKeyHint="search"
            className={`h-11 w-full border border-[#F3EFE6]/20 bg-[#13131d] pl-9 pr-10 text-base text-[#F3EFE6] placeholder:text-[#F3EFE6]/45 hover:border-[#F3EFE6]/40 [&::-webkit-search-cancel-button]:hidden ${FOCUS_RING}`}
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Καθαρισμός αναζήτησης"
              className={`absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[#F3EFE6]/60 hover:text-[#F3EFE6] ${FOCUS_RING}`}
            >
              <svg aria-hidden viewBox="0 0 10 10" className="h-3 w-3">
                <path d="M1 1l8 8M9 1l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </div>
        <p aria-live="polite" className={searching ? "mt-2 text-[15px] font-bold text-[#F3EFE6]" : "sr-only"}>
          {searching ? `${shown.length} από ${rows.length}` : ""}
        </p>
      </div>

      {shown.length > 0 ? (
        <div className={frameClassName} style={frameStyle}>
          {header}
          <ul>
            {shown.map((r) => (
              <li key={r.id} className="border-b border-[#F3EFE6]/[0.14] last:border-b-0">
                {r.node}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-[17px] text-[#F3EFE6]/75">Κανένας παίκτης δεν ταιριάζει με «{q.trim()}».</p>
          <button
            type="button"
            onClick={() => setQ("")}
            className={`mt-3 text-sm text-[#F3EFE6]/70 underline decoration-[#F3EFE6]/30 underline-offset-4 hover:text-[#fb923c] ${FOCUS_RING}`}
          >
            Καθαρισμός αναζήτησης
          </button>
        </div>
      )}
    </>
  );
}
