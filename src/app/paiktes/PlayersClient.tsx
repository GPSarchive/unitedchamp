// src/app/paiktes/PlayersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

type TournamentOpt = { id: number; name: string; season: string | null };

export default function PlayersClient({
  initialPlayers = [],
  tournaments = [],
}: {
  initialPlayers?: PLWithTGoals[];
  tournaments?: TournamentOpt[];
}) {
  const base: PLWithTGoals[] = Array.isArray(initialPlayers) ? initialPlayers : [];

  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<number | null>(
    base.length ? base[0].id : null
  );

  const isXL = useIsXL();
  const [detailOpen, setDetailOpen] = useState(false);

  // Router + URL sync helpers
  const router = useRouter();
  const sp = useSearchParams();
  const selectedSort = (sp?.get("sort") ?? "alpha").toLowerCase();
  const selectedTournamentId = sp?.get("tournament_id")
    ? Number(sp.get("tournament_id"))
    : null;
  const top = sp?.get("top") ? Number(sp.get("top")) : null;

  const updateQuery = (
    patch: Record<string, string | number | null | undefined>
  ) => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    });
    router.replace(`/paiktes?${next.toString()}`, { scroll: false });
  };

  const onSortChange = (v: string) => {
    updateQuery({
      sort: v,
      tournament_id:
        v === "tournament_goals" ? selectedTournamentId ?? "" : null,
    });
  };

  const onTournamentChange = (idStr: string) => {
    const id = Number(idStr);
    updateQuery({
      sort: "tournament_goals",
      tournament_id: Number.isFinite(id) ? id : null,
    });
  };

  const onTopChange = (val: string) => {
    const n = Number(val);
    updateQuery({ top: Number.isFinite(n) && n > 0 ? n : null });
  };

  // When we grow to desktop, ensure list+card layout is visible
  useEffect(() => {
    if (isXL) setDetailOpen(false);
  }, [isXL]);

  // Filter + search
  const players = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((p) => {
      const hay = `${p.first_name} ${p.last_name} ${p.team?.name ?? ""} ${
        p.position
      }`.toLowerCase();
      return hay.includes(needle);
    });
  }, [base, q]);

  // Quick lookup for card
  const byId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p] as const)),
    [players]
  );
  const active =
    activeId != null
      ? (byId as Record<number, PLWithTGoals | undefined>)[activeId] ?? null
      : null;

  const openDetailOnMobile = (id: number) => {
    setActiveId(id);
    if (!isXL) {
      setDetailOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeDetailOnMobile = () => {
    setDetailOpen(false);
  };

  const isAlphaSort = selectedSort === "alpha";
  const showTournamentGoals = selectedSort === "tournament_goals";

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
              <PlayerProfileCard player={active} />
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
            selectedSort={selectedSort}
            selectedTournamentId={selectedTournamentId}
            topN={top}
            tournaments={tournaments}
            searchQuery={q}
            playerCount={players.length}
            onSortChange={onSortChange}
            onTournamentChange={onTournamentChange}
            onTopChange={onTopChange}
            onSearchChange={setQ}
            onReset={() => router.replace("/paiktes")}
          />

          {/* Players List */}
          <div className="flex-1 overflow-hidden">
            <PlayersList
              players={players}
              activeId={activeId}
              onPlayerSelect={openDetailOnMobile}
              onPlayerHover={(id) => isXL && setActiveId(id)}
              showTournamentGoals={showTournamentGoals}
              isAlphaSort={isAlphaSort}
            />
          </div>
        </div>

        {/* RIGHT PANEL - Player Card (Desktop Only) */}
        <aside className="hidden xl:flex xl:flex-none xl:basis-[30%] flex-col bg-zinc-950/50">

          <div className="flex-1 overflow-y-auto p-6">
            {active ? (
              <div className="sticky top-0">
                <PlayerProfileCard player={active} />
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