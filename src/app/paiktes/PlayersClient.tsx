// src/app/paiktes/PlayersClient.tsx (OPTIMIZED with Pagination + Rerender fixes)
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlayerLite } from "./types";
import PlayerProfileCard from "./PlayerProfileCard";
import PlayersList from "./PlayersList";
import PlayersFilterHeader from "./PlayersFilterHeader";
import SportyBackground from "./Sportybackground";

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
  // ✅ Debounce search query to reduce rerenders while typing
  const debouncedQ = useDebounce(q, 300);

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
      const id = Number(idStr);
      // ✅ Update client state immediately
      setClientTournamentId(Number.isFinite(id) ? id : null);
      setClientSort("tournament_goals");
      setIsLoading(true);

      // Fetch from server with new tournament filter
      updateQuery({
        sort: "tournament_goals",
        tournament_id: Number.isFinite(id) ? id : null,
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

  // Filter + search + sort (client-side for instant response)
  // ✅ Use debounced query to prevent excessive filtering while typing
  const players = useMemo(() => {
    // Step 1: Filter by search query
    const needle = debouncedQ.trim().toLowerCase();
    let filtered = base;
    if (needle) {
      filtered = base.filter((p) => {
        const hay = `${p.first_name} ${p.last_name} ${p.team?.name ?? ""} ${
          p.position
        }`.toLowerCase();
        return hay.includes(needle);
      });
    }

    // Step 2: Apply tournament-aware sorting
    // ✅ Helper to get the correct metric (tournament-scoped or global)
    const isTournamentScoped = !!clientTournamentId;
    const getMetric = (
      player: PLWithTGoals,
      globalField: keyof PLWithTGoals,
      tournamentField: keyof PLWithTGoals
    ): number => {
      if (isTournamentScoped) {
        const tValue = player[tournamentField];
        if (typeof tValue === "number") return tValue;
      }
      const gValue = player[globalField];
      return typeof gValue === "number" ? gValue : 0;
    };

    const sorted = [...filtered];
    switch (clientSort) {
      case "goals":
      case "tournament_goals":
        sorted.sort(
          (a, b) =>
            getMetric(b, "goals", "tournament_goals") -
            getMetric(a, "goals", "tournament_goals")
        );
        break;
      case "matches":
        sorted.sort(
          (a, b) =>
            getMetric(b, "matches", "tournament_matches") -
            getMetric(a, "matches", "tournament_matches")
        );
        break;
      case "wins":
        sorted.sort(
          (a, b) =>
            getMetric(b, "wins", "tournament_wins") -
            getMetric(a, "wins", "tournament_wins")
        );
        break;
      case "assists":
        sorted.sort(
          (a, b) =>
            getMetric(b, "assists", "tournament_assists") -
            getMetric(a, "assists", "tournament_assists")
        );
        break;
      case "mvp":
        sorted.sort(
          (a, b) =>
            getMetric(b, "mvp", "tournament_mvp") -
            getMetric(a, "mvp", "tournament_mvp")
        );
        break;
      case "bestgk":
        sorted.sort(
          (a, b) =>
            getMetric(b, "best_gk", "tournament_best_gk") -
            getMetric(a, "best_gk", "tournament_best_gk")
        );
        break;
      case "alpha":
      default:
        // Alphabetical sorting
        sorted.sort((a, b) => {
          const aName = `${a.last_name} ${a.first_name}`.toLowerCase();
          const bName = `${b.last_name} ${b.first_name}`.toLowerCase();
          return aName.localeCompare(bName);
        });
        break;
    }

    return topLimit != null ? sorted.slice(0, topLimit) : sorted;
  }, [base, debouncedQ, clientSort, clientTournamentId, topLimit]);

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
        <div className="absolute inset-0 z-50 bg-black overflow-y-auto">
          <div className="relative">
            <button
              type="button"
              onClick={closeDetailOnMobile}
              className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              aria-label="Back to list"
            >
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0"
              >
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Πίσω
            </button>
            <div className="pt-16 px-4 pb-8">
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
          
          {/* Filter Header */}
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
            {/* ✅ Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center">
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
              <div className="sticky bottom-0 z-10 bg-zinc-950 border-t border-white/10 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/50">
                    Page {currentPage} of {totalPages} • {totalCount} total players
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onPageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium text-white bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                            className={`w-10 h-10 text-sm font-medium rounded transition-all ${
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
                      className="px-4 py-2 text-sm font-medium text-white bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
        <aside className="hidden xl:flex xl:flex-none xl:basis-[30%] flex-col bg-zinc-950/50 relative">
          <SportyBackground variant="pitch" opacity={0.12} animate={true} />
          <div className="flex-1 overflow-y-auto p-6">
            {active ? (
              <div className="sticky top-0">
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