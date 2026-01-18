// src/app/paiktes/PlayersClient.tsx (OPTIMIZED with Pagination + Rerender fixes)
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlayerLite } from "./types";
import PlayerProfileCard from "./PlayerProfileCard";
import PlayersList from "./PlayersList";
import PlayersFilterHeader from "./PlayersFilterHeader";

type PLWithTGoals = PlayerLite & { tournament_goals?: number };

/** Hook: is viewport >= xl (Tailwind 1280px)? */
function useIsXL() {
  const query = "(min-width: 1280px)";
  const [isXL, setIsXL] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsXL(e.matches);
    if ("addEventListener" in mql) mql.addEventListener("change", handler);
    else (mql as any).addListener?.(handler);
    return () => {
      if ("removeEventListener" in mql) mql.removeEventListener("change", handler);
      else (mql as any).removeListener?.(handler);
    };
  }, []);

  return isXL;
}

/** Hook: Debounce a value */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type TournamentOpt = { id: number; name: string; season: string | null };

export default function PlayersClient({
  initialPlayers = [],
  tournaments = [],
  totalCount = 0,
  currentPage = 1,
  pageSize = 50,
  usePagination = true,
  initialSearchQuery = "",
}: {
  initialPlayers?: PLWithTGoals[];
  tournaments?: TournamentOpt[];
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  usePagination?: boolean;
  initialSearchQuery?: string;
}) {
  const base: PLWithTGoals[] = Array.isArray(initialPlayers) ? initialPlayers : [];

  const [q, setQ] = useState(initialSearchQuery ?? "");
  // ✅ Debounce search query to reduce server requests while typing
  // Increased to 1000ms to allow comfortable typing without interruption
  const debouncedQ = useDebounce(q, 1000);

  const [activeId, setActiveId] = useState<number | null>(
    base.length ? base[0].id : null
  );

  // ✅ Loading state for when data is being fetched
  const [isLoading, setIsLoading] = useState(false);

  const isXL = useIsXL();
  const [detailOpen, setDetailOpen] = useState(false);

  // Router + URL sync helpers
  const router = useRouter();
  const sp = useSearchParams();
  const selectedSort = (sp?.get("sort") ?? "alpha").toLowerCase();
  const selectedTournamentId = sp?.get("tournament_id")
    ? Number(sp.get("tournament_id"))
    : null;
  const rawTop = sp?.get("top");
  const parsedTop = rawTop ? Number(rawTop) : NaN;
  const topLimit =
    Number.isFinite(parsedTop) && parsedTop > 0 ? Math.floor(parsedTop) : null;
  const rawSearchParam = sp?.get("q") ?? "";
  const normalizedSearchParam = rawSearchParam.trim();

  // ✅ Client-side sort mode state for instant responsiveness
  const [clientSort, setClientSort] = useState(selectedSort);
  const [clientTournamentId, setClientTournamentId] = useState(selectedTournamentId);
  const [clientTopInput, setClientTopInput] = useState(
    topLimit != null ? String(topLimit) : ""
  );

  const updateQuery = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(sp?.toString() ?? "");
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") next.delete(k);
        else next.set(k, String(v));
      });
      router.replace(`/paiktes?${next.toString()}`, { scroll: false });
    },
    [router, sp]
  );

  const onSortChange = useCallback(
    (v: string) => {
      // ✅ Update client state immediately for instant UI response
      setClientSort(v);
      // ✅ Show loading state since this triggers server fetch
      setIsLoading(true);

      // ✅ Preserve tournament filter across all sort modes
      // Only fetch from server if switching to tournament_goals (needs additional data)
      if (v === "tournament_goals") {
        updateQuery({
          sort: v,
          tournament_id: clientTournamentId ?? "",
          page: 1,
        });
      } else {
        // For other sorts, keep tournament filter if one is selected
        updateQuery({
          sort: v,
          tournament_id: clientTournamentId ?? undefined,
          page: 1,
        });
      }
    },
    [updateQuery, clientTournamentId]
  );

  const onTournamentChange = useCallback(
    (idStr: string) => {
      // ✅ Handle empty string (clearing tournament filter)
      const trimmed = idStr.trim();
      const id = trimmed !== "" ? Number(trimmed) : NaN;
      const hasTournament = Number.isFinite(id);

      // ✅ Update client state immediately
      setClientTournamentId(hasTournament ? id : null);
      // ✅ When clearing tournament, reset to alphabetical sort
      setClientSort(hasTournament ? "tournament_goals" : "alpha");
      setIsLoading(true);

      // Fetch from server with new tournament filter
      updateQuery({
        sort: hasTournament ? "tournament_goals" : "alpha",
        tournament_id: hasTournament ? id : null,
        page: 1,
      });
    },
    [updateQuery]
  );

  const onTopChange = useCallback(
    (val: string) => {
      const normalized = val.trim();
      const n = Number(normalized);
      const nextValue =
        Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : "";
      setClientTopInput(nextValue);
      setIsLoading(true);
      updateQuery({
        top: nextValue ? Number(nextValue) : null,
        page: 1,
      });
    },
    [updateQuery]
  );

  const onPageChange = useCallback(
    (newPage: number) => {
      setIsLoading(true);
      updateQuery({ page: newPage });
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [updateQuery]
  );

  // When we grow to desktop, ensure list+card layout is visible
  useEffect(() => {
    if (isXL) setDetailOpen(false);
  }, [isXL]);

  // ✅ Sync client state with URL params (e.g., on mount or browser back/forward)
  useEffect(() => {
    setClientSort(selectedSort);
    setClientTournamentId(selectedTournamentId);
    setClientTopInput(topLimit != null ? String(topLimit) : "");
  }, [selectedSort, selectedTournamentId, topLimit]);

  // ✅ Keep the search input in sync with server-rendered search term
  useEffect(() => {
    setQ(initialSearchQuery ?? "");
  }, [initialSearchQuery]);

  // ✅ Mirror debounced search term to the URL so the server fetch knows about it
  useEffect(() => {
    const normalized = debouncedQ.trim();
    if (normalized === normalizedSearchParam) return;
    setIsLoading(true);
    updateQuery({ q: normalized === "" ? null : normalized, page: 1 });
  }, [debouncedQ, normalizedSearchParam, updateQuery]);

  // ✅ Clear loading state when new data arrives
  useEffect(() => {
    setIsLoading(false);
  }, [initialPlayers]);

  // Players are already filtered and sorted server-side
  // Just apply topN limit if needed (client-side for instant feedback)
  const players = useMemo(() => {
    return topLimit != null ? base.slice(0, topLimit) : base;
  }, [base, topLimit]);

  // Quick lookup for card
  const byId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p] as const)),
    [players]
  );
  const active =
    activeId != null
      ? (byId as Record<number, PLWithTGoals | undefined>)[activeId] ?? null
      : null;

  const openDetailOnMobile = useCallback(
    (id: number) => {
      setActiveId(id);
      if (!isXL) {
        setDetailOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [isXL]
  );

  const closeDetailOnMobile = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const handleReset = useCallback(() => {
    // ✅ Reset client state immediately for instant UI feedback
    setClientSort("alpha");
    setClientTournamentId(null);
    setQ("");
    setClientTopInput("");
    setIsLoading(true);
    router.replace("/paiktes");
  }, [router]);

  const handlePlayerHover = useCallback(
    (id: number) => {
      if (isXL) setActiveId(id);
    },
    [isXL]
  );

  // ✅ Use client sort state for UI to be instantly responsive
  const isAlphaSort = clientSort === "alpha";
  const showTournamentGoals = clientSort === "tournament_goals";
  const isTournamentScoped = !!clientTournamentId;

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / pageSize);
  const showPagination = usePagination && totalPages > 1;

  return (
    <div className="w-screen h-screen flex flex-col bg-black overflow-hidden">
      {/* ===== MOBILE DETAIL VIEW (full-screen) ===== */}
      {!isXL && detailOpen && active && (
        <div className="fixed inset-0 z-50 flex flex-col relative overflow-hidden">
          {/* Premium background layers (same as desktop) */}
          <div className="absolute inset-0 z-0">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />

            {/* Topographic contour lines pattern */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `
                  repeating-radial-gradient(circle at 20% 30%, transparent 0px, transparent 40px, rgba(212, 175, 55, 0.6) 40px, rgba(212, 175, 55, 0.6) 41px),
                  repeating-radial-gradient(circle at 80% 70%, transparent 0px, transparent 35px, rgba(255, 193, 7, 0.5) 35px, rgba(255, 193, 7, 0.5) 36px),
                  repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 50px, rgba(140, 108, 0, 0.7) 50px, rgba(140, 108, 0, 0.7) 51px),
                  repeating-radial-gradient(circle at 10% 80%, transparent 0px, transparent 45px, rgba(212, 175, 55, 0.4) 45px, rgba(212, 175, 55, 0.4) 46px),
                  repeating-radial-gradient(circle at 90% 20%, transparent 0px, transparent 38px, rgba(255, 193, 7, 0.6) 38px, rgba(255, 193, 7, 0.6) 39px)
                `,
                backgroundSize: '100% 100%',
              }}
            />

            {/* Subtle animated glow overlay */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `
                  radial-gradient(circle at 30% 40%, rgba(212, 175, 55, 0.08) 0%, transparent 40%),
                  radial-gradient(circle at 70% 60%, rgba(255, 193, 7, 0.06) 0%, transparent 40%)
                `,
                animation: 'meshGradient 20s ease-in-out infinite',
                backgroundSize: '200% 200%',
              }}
            />

            {/* Spotlight from top */}
            <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/[0.03] to-transparent" />

            {/* Vignette effect */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />

            {/* Subtle noise texture for depth */}
            <div
              className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />
          </div>

          {/* Header with back button */}
          <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-sm border-b border-white/10 px-3 sm:px-4 py-2 sm:py-3 flex-shrink-0">
            <button
              type="button"
              onClick={closeDetailOnMobile}
              className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors"
              aria-label="Back to list"
            >
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0 sm:w-5 sm:h-5"
              >
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-medium text-sm sm:text-base">Πίσω στη λίστα</span>
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto overscroll-contain relative z-10">
            <div className="p-3 sm:p-4 pb-6 sm:pb-8 min-h-0 max-w-2xl mx-auto">
              <PlayerProfileCard player={active} isTournamentScoped={isTournamentScoped} />
            </div>
          </div>
        </div>
      )}

      {/* ===== DESKTOP SPLIT LAYOUT ===== */}
      <div
        className={`flex-1 flex overflow-hidden ${
          !isXL && detailOpen ? "hidden" : ""
        }`}
      >
        {/* LEFT PANEL - Players List with Filters */}
        <div className="flex-1 xl:flex-none xl:basis-[70%] flex flex-col border-r border-white/10 overflow-hidden">
          {/* Filter Header - outside scrollable area to prevent blocking */}
          <PlayersFilterHeader
            selectedSort={clientSort}
            selectedTournamentId={clientTournamentId}
            topInputValue={clientTopInput}
            tournaments={tournaments}
            searchQuery={q}
            playerCount={players.length}
            onSortChange={onSortChange}
            onTournamentChange={onTournamentChange}
            onTopChange={onTopChange}
            onTopInputChange={setClientTopInput}
            onSearchChange={setQ}
            onReset={handleReset}
          />

          {/* Players List */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {/* ✅ Loading Overlay - only covers the list, not the header */}
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                  <div className="text-white/70 text-sm font-medium">Φόρτωση παικτών...</div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <PlayersList
                players={players}
                activeId={activeId}
                onPlayerSelect={openDetailOnMobile}
                onPlayerHover={handlePlayerHover}
                showTournamentGoals={showTournamentGoals}
                isAlphaSort={isAlphaSort}
                isTournamentScoped={isTournamentScoped}
              />
            </div>

            {/* Pagination Controls */}
            {showPagination && (
              <div className="sticky bottom-0 z-10 bg-zinc-950 border-t border-white/10 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
                {/* Mobile Pagination - Compact */}
                <div className="flex sm:hidden items-center justify-between gap-2">
                  <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 text-white bg-white/5 border border-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:bg-white/10"
                    aria-label="Previous page"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-sm font-medium">{currentPage}</span>
                    <span className="text-white/30 text-xs">/</span>
                    <span className="text-white/50 text-sm">{totalPages}</span>
                  </div>
                  
                  <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 text-white bg-white/5 border border-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:bg-white/10"
                    aria-label="Next page"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* Desktop Pagination - Full */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="text-xs md:text-sm text-white/50">
                    Page {currentPage} of {totalPages} • {totalCount} total players
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onPageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-white bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => onPageChange(pageNum)}
                            className={`w-8 h-8 md:w-10 md:h-10 text-xs md:text-sm font-medium rounded transition-all ${
                              currentPage === pageNum
                                ? "bg-cyan-500 text-white"
                                : "text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => onPageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-white bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Player Card (Desktop Only) */}
        <aside className="hidden xl:flex xl:flex-none xl:basis-[30%] flex-col relative overflow-hidden">
          {/* Premium background layers */}
          <div className="absolute inset-0 z-0">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />

            {/* Topographic contour lines pattern */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `
                  repeating-radial-gradient(circle at 20% 30%, transparent 0px, transparent 40px, rgba(212, 175, 55, 0.6) 40px, rgba(212, 175, 55, 0.6) 41px),
                  repeating-radial-gradient(circle at 80% 70%, transparent 0px, transparent 35px, rgba(255, 193, 7, 0.5) 35px, rgba(255, 193, 7, 0.5) 36px),
                  repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 50px, rgba(140, 108, 0, 0.7) 50px, rgba(140, 108, 0, 0.7) 51px),
                  repeating-radial-gradient(circle at 10% 80%, transparent 0px, transparent 45px, rgba(212, 175, 55, 0.4) 45px, rgba(212, 175, 55, 0.4) 46px),
                  repeating-radial-gradient(circle at 90% 20%, transparent 0px, transparent 38px, rgba(255, 193, 7, 0.6) 38px, rgba(255, 193, 7, 0.6) 39px)
                `,
                backgroundSize: '100% 100%',
              }}
            />

            {/* Subtle animated glow overlay */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `
                  radial-gradient(circle at 30% 40%, rgba(212, 175, 55, 0.08) 0%, transparent 40%),
                  radial-gradient(circle at 70% 60%, rgba(255, 193, 7, 0.06) 0%, transparent 40%)
                `,
                animation: 'meshGradient 20s ease-in-out infinite',
                backgroundSize: '200% 200%',
              }}
            />

            {/* Spotlight from top */}
            <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/[0.03] to-transparent" />

            {/* Vignette effect */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />

            {/* Subtle noise texture for depth */}
            <div
              className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />
          </div>

          {/* Content on top of background */}
          <div className="flex-1 overflow-y-auto p-4 xl:p-6 relative z-10">
            {active ? (
              <div className="sticky top-0 max-w-xl mx-auto">
                <PlayerProfileCard player={active} isTournamentScoped={isTournamentScoped} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-white/40 px-8">
                  <div className="text-6xl mb-4">👤</div>
                  <p className="text-lg">
                    Πέρασε τον κέρσορα από έναν παίκτη για να δεις τα στοιχεία του
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}