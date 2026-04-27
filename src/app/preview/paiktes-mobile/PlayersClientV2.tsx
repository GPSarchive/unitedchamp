// src/app/preview/paiktes-mobile/PlayersClientV2.tsx
// Mobile-first variant of PlayersClient: reuses PlayerProfileCard + PlayersList from live,
// swaps the filter header, and uses dvh-based viewport sizing to avoid the
// mobile-browser address-bar bug that compresses the list.
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fraunces,
  Archivo_Black,
  JetBrains_Mono,
  Figtree,
} from "next/font/google";
import type { PlayerLite } from "@/app/paiktes/types";
import PlayerProfileCard from "@/app/paiktes/PlayerProfileCard";
import PlayersListV2 from "./PlayersListV2";
import PlayersFilterHeaderV2 from "./PlayersFilterHeaderV2";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--f-brutal",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-body",
  display: "swap",
});

type PLWithTGoals = PlayerLite & { tournament_goals?: number };

const pad2 = (n: number | string) => String(n).padStart(2, "0");

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

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

type TournamentOpt = { id: number; name: string; season: string | null };

const PaperBackground: React.FC<{ fixed?: boolean }> = ({ fixed = true }) => (
  <div
    aria-hidden
    className={`pointer-events-none ${
      fixed ? "fixed inset-0 -z-10" : "absolute inset-0 -z-10"
    }`}
  >
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
      }}
    />
    <div
      className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
      }}
    />
    <div
      className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
      }}
    />
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.04]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="pgrid-mobile" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pgrid-mobile)" />
    </svg>
  </div>
);

const PageHeader: React.FC<{
  totalCount: number;
  shownCount: number;
  isTournamentScoped: boolean;
}> = ({ totalCount, shownCount, isTournamentScoped }) => (
  <header className="relative border-b-2 border-[#F3EFE6]/20 shrink-0">
    <div className="mx-auto max-w-[1800px] px-3 md:px-6 pt-3 pb-2.5 md:pt-8 md:pb-6">
      <nav className="mb-2 md:mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span>/</span>
        <span className="text-[#F3EFE6]">Παίκτες</span>
      </nav>

      <div className="flex flex-col gap-2 md:gap-3 md:flex-row md:items-end md:justify-between">
        <h1
          className="font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
          style={{ fontSize: "clamp(1.5rem, 4.5vw, 3.5rem)" }}
        >
          Οι Παίκτες
        </h1>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
          {isTournamentScoped && (
            <span className="inline-flex items-center gap-2 border border-[#fb923c]/60 bg-[#fb923c]/10 px-2.5 py-1 text-[#fb923c]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fb923c]" />
              Εμβέλεια Τουρνουά
            </span>
          )}
          <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1">
            Εμφ. {pad2(shownCount)} / {pad2(totalCount)}
          </span>
        </div>
      </div>
    </div>
  </header>
);

export default function PlayersClientV2({
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
  const debouncedQ = useDebounce(q, 600);

  const [activeId, setActiveId] = useState<number | null>(
    base.length ? base[0].id : null
  );
  const [isLoading, setIsLoading] = useState(false);

  const isXL = useIsXL();
  const [detailOpen, setDetailOpen] = useState(false);

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
      router.replace(`/preview/paiktes-mobile?${next.toString()}`, { scroll: false });
    },
    [router, sp]
  );

  const onSortChange = useCallback(
    (v: string) => {
      setClientSort(v);
      setIsLoading(true);
      if (v === "tournament_goals") {
        updateQuery({
          sort: v,
          tournament_id: clientTournamentId ?? "",
          page: 1,
        });
      } else {
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
      const trimmed = idStr.trim();
      const id = trimmed !== "" ? Number(trimmed) : NaN;
      const hasTournament = Number.isFinite(id);

      setClientTournamentId(hasTournament ? id : null);
      setClientSort(hasTournament ? "tournament_goals" : "alpha");
      setIsLoading(true);

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
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [updateQuery]
  );

  useEffect(() => {
    if (isXL) setDetailOpen(false);
  }, [isXL]);

  useEffect(() => {
    setClientSort(selectedSort);
    setClientTournamentId(selectedTournamentId);
    setClientTopInput(topLimit != null ? String(topLimit) : "");
  }, [selectedSort, selectedTournamentId, topLimit]);

  useEffect(() => {
    setQ(initialSearchQuery ?? "");
  }, [initialSearchQuery]);

  useEffect(() => {
    const normalized = debouncedQ.trim();
    if (normalized === normalizedSearchParam) return;
    setIsLoading(true);
    updateQuery({ q: normalized === "" ? null : normalized, page: 1 });
  }, [debouncedQ, normalizedSearchParam, updateQuery]);

  useEffect(() => {
    setIsLoading(false);
  }, [initialPlayers]);

  const players = useMemo(() => {
    return topLimit != null ? base.slice(0, topLimit) : base;
  }, [base, topLimit]);

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
    setClientSort("alpha");
    setClientTournamentId(null);
    setQ("");
    setClientTopInput("");
    setIsLoading(true);
    router.replace("/preview/paiktes-mobile");
  }, [router]);

  const handlePlayerHover = useCallback(
    (id: number) => {
      if (isXL) setActiveId(id);
    },
    [isXL]
  );

  const isAlphaSort = clientSort === "alpha";
  const showTournamentGoals = clientSort === "tournament_goals";
  const isTournamentScoped = !!clientTournamentId;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showPagination = usePagination && totalPages > 1;

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} flex w-screen flex-col overflow-hidden text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
      style={{ height: "100dvh" }}
    >
      <PaperBackground />

      {!isXL && detailOpen && active && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
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
                backgroundSize: "100% 100%",
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/[0.03] to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
          </div>

          <div className="sticky top-0 z-10 border-b-2 border-[#F3EFE6]/15 bg-[#0a0a14]/85 backdrop-blur-sm px-4 py-2.5 shrink-0">
            <button
              type="button"
              onClick={closeDetailOnMobile}
              className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/75 hover:text-[#fb923c] transition-colors"
              aria-label="Επιστροφή στη λίστα"
            >
              ← Πίσω στη Λίστα
            </button>
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-2xl p-4 pb-8">
              <PlayerProfileCard
                player={active}
                isTournamentScoped={isTournamentScoped}
              />
            </div>
          </div>
        </div>
      )}

      <PageHeader
        totalCount={totalCount}
        shownCount={players.length}
        isTournamentScoped={isTournamentScoped}
      />

      <div
        className={`relative z-10 flex flex-1 overflow-hidden ${
          !isXL && detailOpen ? "hidden" : ""
        }`}
      >
        <div className="flex flex-1 flex-col overflow-hidden xl:flex-none xl:basis-[70%] xl:border-r-2 xl:border-[#F3EFE6]/15">
          <PlayersFilterHeaderV2
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

          <div className="relative flex flex-1 flex-col overflow-hidden">
            {isLoading && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#0a0a14]/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#fb923c]/30 border-t-[#fb923c]" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/70">
                    Φόρτωση παικτών...
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <PlayersListV2
                players={players}
                activeId={activeId}
                onPlayerSelect={openDetailOnMobile}
                onPlayerHover={handlePlayerHover}
                showTournamentGoals={showTournamentGoals}
                isAlphaSort={isAlphaSort}
                isTournamentScoped={isTournamentScoped}
              />
            </div>

            {showPagination && (
              <div className="sticky bottom-0 z-10 border-t-2 border-[#F3EFE6]/15 bg-[#0a0a14]/95 backdrop-blur-sm px-3 md:px-6 py-2 md:py-3">
                <PaginationBar
                  page={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  onChange={onPageChange}
                />
              </div>
            )}
          </div>
        </div>

        <aside className="relative hidden xl:flex xl:flex-none xl:basis-[30%] flex-col overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
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
                backgroundSize: "100% 100%",
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/[0.03] to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto p-6">
            {active ? (
              <div className="sticky top-0 mx-auto max-w-xl">
                <PlayerProfileCard
                  player={active}
                  isTournamentScoped={isTournamentScoped}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-sm border-2 border-dashed border-[#F3EFE6]/25 bg-[#0a0a14]/70 backdrop-blur-sm p-8 text-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                    / 00 · Προφίλ
                  </span>
                  <p className="mt-3 font-[var(--f-display)] text-xl font-black italic leading-tight text-[#F3EFE6]">
                    Επιλέξτε έναν παίκτη
                  </p>
                  <p className="mt-2 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
                    Περάστε τον κέρσορα ή κάντε κλικ σε έναν παίκτη για να δείτε
                    το προφίλ.
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

function PaginationBar({
  page,
  totalPages,
  totalCount,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onChange: (p: number) => void;
}) {
  const windowSize = 1;
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= page - windowSize && p <= page + windowSize)
    ) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 md:gap-3">
      <button
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className={`border-2 px-2.5 md:px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          page <= 1
            ? "border-[#F3EFE6]/10 text-[#F3EFE6]/25 cursor-not-allowed"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c]"
        }`}
      >
        ← <span className="hidden sm:inline">Προηγ.</span>
      </button>

      <div className="hidden md:flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`dot-${i}`}
              className="font-mono text-[10px] tracking-[0.2em] text-[#F3EFE6]/35"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tabular-nums transition-colors ${
                p === page
                  ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                  : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
              }`}
            >
              {String(p).padStart(2, "0")}
            </button>
          )
        )}
      </div>

      <div className="flex md:hidden items-center gap-1.5 font-mono text-xs text-[#F3EFE6]/70">
        <span className="font-[var(--f-brutal)] text-sm text-[#F3EFE6]">
          {String(page).padStart(2, "0")}
        </span>
        <span className="text-[#F3EFE6]/30">/</span>
        <span>{String(totalPages).padStart(2, "0")}</span>
      </div>

      <div className="hidden lg:block font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/50">
        Σύνολο · {totalCount}
      </div>

      <button
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className={`border-2 px-2.5 md:px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          page >= totalPages
            ? "border-[#F3EFE6]/10 text-[#F3EFE6]/25 cursor-not-allowed"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c]"
        }`}
      >
        <span className="hidden sm:inline">Επόμ.</span> →
      </button>
    </div>
  );
}
