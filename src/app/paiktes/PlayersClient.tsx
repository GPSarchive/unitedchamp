// src/app/paiktes/PlayersClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerLite } from "./types";
import SignedImg from "./SignedImg";
import PlayerProfileCard from "./PlayerProfileCard";
import styles from "./PlayersClient.module.css";

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

export default function PlayersClient({ initialPlayers = [] }: { initialPlayers?: PlayerLite[] }) {
  const base = Array.isArray(initialPlayers) ? initialPlayers : [];

  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<number | null>(base.length ? base[0].id : null);

  // 🔁 NEW: detail view toggle for mobile
  const isXL = useIsXL();
  const [detailOpen, setDetailOpen] = useState(false);

  // When we grow to desktop, ensure list+card layout is visible (no modal/detail)
  useEffect(() => {
    if (isXL) setDetailOpen(false);
  }, [isXL]);

  // Filter + search
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
  const active = activeId != null ? byId[activeId] ?? null : null;

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

          <div className="pt-12"> {/* leave space for the button */}
            <PlayerProfileCard player={active} />
          </div>
        </div>
      )}

      {/* ===== DESKTOP SPLIT or MOBILE LIST ===== */}
      <div
        className={`grid grid-cols-1 xl:grid-cols-12 gap-6 2xl:gap-8 ${
          !isXL && detailOpen ? "hidden" : ""
        }`}
      >
        {/* LEFT: Spotlight (desktop only) */}
        <aside className="hidden xl:block xl:col-span-5 2xl:col-span-4">
          <div className="xl:sticky xl:top-6">
            {active ? (
              <PlayerProfileCard player={active} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
                {players.length
                  ? "Πέρασε τον κέρσορα από έναν παίκτη."
                  : "Δεν υπάρχουν παίκτες για εμφάνιση."}
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT: List (also mobile primary view) */}
        <section className="xl:col-span-7 2xl:col-span-8">
          <div className="flex items-center gap-3 mb-4">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση παίκτη ή ομάδας…"
              className="w-full bg-slate-950 border border-white/15 rounded-md px-3 py-2 text-white text-sm"
              aria-label="Αναζήτηση"
            />
            <div className="text-white/50 text-sm shrink-0">
              {players.length} παίκτες
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="divide-y divide-white/10">
              {players.map((p, idx) => {
                const prev = players[idx - 1];
                const letter = (p.last_name || p.first_name || "?").charAt(0).toUpperCase();
                const prevLetter = (prev?.last_name || prev?.first_name || "").charAt(0).toUpperCase();
                const showLetter = !prev || prevLetter !== letter;

                const isActive = activeId === p.id;

                return (
                  <div key={p.id}>
                    {showLetter && (
                      <div className="bg-zinc-900/60 text-white/70 px-4 py-1 text-xs tracking-wide">
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
                      className={`flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer ${
                        isActive ? "ring-1 ring-cyan-400/40" : ""
                      }`}
                      role="button"
                      aria-pressed={isActive}
                    >
                      <div className="relative w-12 h-12 overflow-hidden rounded-md bg-white/10 shrink-0">
                        <SignedImg
                          src={p.photo}
                          alt={`${p.first_name} ${p.last_name}`}
                          className={styles.avatarImg}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-white/60 text-xs">
                          {p.team?.name ? p.team.name + " • " : ""}
                          {p.position || "—"}{" "}
                          {p.height_cm ? `• ${p.height_cm}cm` : ""}{" "}
                          {p.age != null ? `• ${p.age}y` : ""}
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-2 text-[11px] text-white/70">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Aγ: {p.matches}</span>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Γκ: {p.goals}</span>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Αστ: {p.assists}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!players.length && (
                <div className="px-4 py-6 text-white/60">Δεν βρέθηκαν παίκτες.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
