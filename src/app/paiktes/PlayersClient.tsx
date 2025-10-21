// src/app/paiktes/PlayersClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlayerLite } from "./types";
import SignedImg from "./SignedImg";
import PlayerProfileCard from "./PlayerProfileCard";
import styles from "./PlayersClient.module.css";

// ✅ Local extension adds the optional tournament_goals field
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
    // Safari support
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
  initialPlayers?: PLWithTGoals[];                 // ✅ updated
  tournaments?: TournamentOpt[];
}) {
  const base: PLWithTGoals[] = Array.isArray(initialPlayers) ? initialPlayers : []; // ✅ typed

  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<number | null>(base.length ? base[0].id : null);

  // 🔁 NEW: detail view toggle for mobile
  const isXL = useIsXL();
  const [detailOpen, setDetailOpen] = useState(false);

  // Router + URL sync helpers
  const router = useRouter();
  const sp = useSearchParams();
  const selectedSort = (sp?.get("sort") ?? "alpha").toLowerCase();
  const selectedTournamentId = sp?.get("tournament_id") ? Number(sp.get("tournament_id")) : null;
  const top = sp?.get("top") ? Number(sp.get("top")) : null;

  const updateQuery = (patch: Record<string, string | number | null | undefined>) => {
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
      // when leaving tournament mode, drop tournament_id
      tournament_id: v === "tournament_goals" ? (selectedTournamentId ?? "") : null,
    });
  };

  const onTournamentChange = (idStr: string) => {
    const id = Number(idStr);
    updateQuery({ sort: "tournament_goals", tournament_id: Number.isFinite(id) ? id : null });
  };

  const onTopChange = (val: string) => {
    const n = Number(val);
    updateQuery({ top: Number.isFinite(n) && n > 0 ? n : null });
  };

  // When we grow to desktop, ensure list+card layout is visible (no modal/detail)
  useEffect(() => {
    if (isXL) setDetailOpen(false);
  }, [isXL]);

  // Filter + search (keep server-provided order; do not re-sort on client)
  const players = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((p) => {
      const hay = `${p.first_name} ${p.last_name} ${p.team?.name ?? ""} ${p.position}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [base, q]);

  // Quick lookup for spotlight card
  const byId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p] as const)),
    [players]
  );
  const active = activeId != null ? (byId as Record<number, PLWithTGoals | undefined>)[activeId] ?? null : null;

  // Track visible list items (desktop hover behavior stays)
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!players.length) return; // nothing to observe
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = Number((visible[0].target as HTMLElement).dataset.pid);
          if (id && id !== activeId) setActiveId(id);
        }
      },
      { root: null, threshold: [0.5, 0.75, 1] }
    );
    Object.values(itemRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length]);

  // Focus search after going back on mobile (nice touch)
  const searchRef = useRef<HTMLInputElement | null>(null);
  const openDetailOnMobile = (id: number) => {
    setActiveId(id);
    if (!isXL) {
      setDetailOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const closeDetailOnMobile = () => {
    setDetailOpen(false);
    setTimeout(() => searchRef.current?.focus(), 150);
  };

  const isAlphaSort = selectedSort === "alpha";

  const sortOptions = [
    { value: "alpha", label: "Αλφάβητο" },
    { value: "matches", label: "Περισσότεροι Αγώνες" },
    { value: "goals", label: "Κορυφαίοι Σκόρερ" },
    { value: "assists", label: "Περισσότερες Ασίστ" },
    { value: "wins", label: "Περισσότερες Νίκες" },
    { value: "mvp", label: "Περισσότερα MVP" },
    { value: "bestgk", label: "Περισσότερα Best GK" },
    { value: "tournament_goals", label: "Κορυφαίοι Σκόρερ Τουρνουά" },
  ];

  return (
    <div className="w-screen px-4 sm:px-8 lg:px-12 py-6">
      {/* ===== MOBILE DETAIL VIEW (full-screen card with back) ===== */}
      {!isXL && detailOpen && active && (
        <div className="relative">
          <button
            type="button"
            onClick={closeDetailOnMobile}
            className="absolute left-2 top-2 z-10 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/60 px-3 py-1.5 text-sm text-white shadow-sm backdrop-blur hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
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
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Πίσω
          </button>

          <div className="pt-12">{/* leave space for the button */}
            <PlayerProfileCard player={active} />
          </div>
        </div>
      )}

      {/* ===== CONTROLS BAR (sort / tournament / top / reset) ===== */}
      <div className={`${!isXL && detailOpen ? "hidden" : ""} mb-4`}>
        <div className="flex overflow-x-auto gap-2 pb-2">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                selectedSort === opt.value
                  ? "bg-cyan-400 text-black shadow-md"
                  : "bg-white/5 text-white/80 hover:bg-white/10 border border-white/10"
              }`}
              onClick={() => onSortChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {selectedSort === "tournament_goals" && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-white/70 text-sm font-medium">Τουρνουά:</span>
            <select
              className="bg-white/5 text-white/90 text-sm px-3 py-1.5 rounded-md border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 flex-1"
              value={selectedTournamentId ?? ""}
              onChange={(e) => onTournamentChange(e.target.value)}
            >
              <option value="">— επιλογή —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.season ? ` (${t.season})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className="text-white/70 text-sm font-medium">Top:</span>
          <input
            className="bg-white/5 text-white/90 text-sm px-3 py-1.5 rounded-md border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 w-20"
            type="number"
            min={1}
            placeholder="π.χ. 20"
            defaultValue={top ?? ""}
            onBlur={(e) => onTopChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onTopChange((e.target as HTMLInputElement).value);
            }}
          />
          <button
            className="ml-auto text-xs px-3 py-1.5 rounded-md bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
            onClick={() => router.replace("/paiktes")}
          >
            Επαναφορά
          </button>
        </div>
      </div>

      {/* ===== DESKTOP SPLIT or MOBILE LIST ===== */}
      <div
        className={`grid grid-cols-1 xl:grid-cols-12 gap-6 2xl:gap-8 ${!isXL && detailOpen ? "hidden" : ""}`}
      >
        {/* LEFT: Spotlight (desktop only) */}
        <aside className="hidden xl:block xl:col-span-5 2xl:col-span-4">
          <div className="xl:sticky xl:top-6">
            {active ? (
              <PlayerProfileCard player={active} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-md">
                {players.length
                  ? "Πέρασε τον κέρσορα από έναν παίκτη."
                  : "Δεν υπάρχουν παίκτες για εμφάνιση."}
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT: Search + List (also mobile primary view) */}
        <section className="xl:col-span-7 2xl:col-span-8">
          <div className="flex items-center gap-3 mb-4">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση παίκτη ή ομάδας…"
              className="w-full bg-white/5 border border-white/15 rounded-md px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition-shadow"
              aria-label="Αναζήτηση"
            />
            <div className="text-white/50 text-sm shrink-0">
              {players.length} παίκτες
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden shadow-lg">
            <div className="divide-y divide-white/10">
              {players.map((p, idx) => {
                const prev = players[idx - 1];
                const letter = (p.last_name || p.first_name || "?").charAt(0).toUpperCase();
                const prevLetter = (prev?.last_name || prev?.first_name || "").charAt(0).toUpperCase();
                const showLetter = isAlphaSort && (!prev || prevLetter !== letter);

                const isActive = activeId === p.id;

                return (
                  <div key={p.id}>
                    {showLetter && (
                      <div className="bg-zinc-900/80 text-white/80 px-4 py-2 text-sm font-semibold tracking-wide">
                        {letter}
                      </div>
                    )}
                    <div
                      ref={(el) => {
                        itemRefs.current[p.id] = el;
                      }}
                      data-pid={p.id}
                      onMouseEnter={() => isXL && setActiveId(p.id)}
                      onClick={() => openDetailOnMobile(p.id)}
                      className={`flex items-center gap-4 px-4 py-4 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-all duration-200 ${
                        isActive ? "ring-2 ring-cyan-400/50" : ""
                      }`}
                      role="button"
                      aria-pressed={isActive}
                    >
                      <div className="relative w-14 h-14 overflow-hidden rounded-full bg-white/10 shrink-0 ring-1 ring-white/20">
                        <SignedImg
                          src={p.photo}
                          alt={`${p.first_name} ${p.last_name}`}
                          className={`${styles.avatarImg} object-cover`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-lg truncate">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-white/60 text-sm mt-1">
                          {p.team?.name ? p.team.name + " • " : ""}
                          {p.position || "—"}{" "}
                          {p.height_cm ? `• ${p.height_cm}cm` : ""}{" "}
                          {p.age != null ? `• ${p.age}y` : ""}
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-2 text-xs text-white/70">
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Aγ: {p.matches}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Νικ: {p.wins}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Γκ: {p.goals}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Αστ: {p.assists}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">MVP: {p.mvp}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">BGK: {p.best_gk}</span>
                        {/* Shows only when server attached per-tournament goals */}
                        {typeof p.tournament_goals === "number" && (
                          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                            Τουρν. Γκ: {p.tournament_goals}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!players.length && (
                <div className="px-4 py-6 text-white/60 text-center">Δεν βρέθηκαν παίκτες.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}