// app/players/PlayersClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type TeamLite = { id: number; name: string; logo: string | null } | null;

type PlayerLite = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string;
  position: string;
  height_cm: number | null;
  age: number | null;
  team: TeamLite;
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number;
  best_gk: number;
};

export default function PlayersClient({
  initialPlayers = [],
}: {
  initialPlayers?: PlayerLite[];
}) {
  // Always have a safe array
  const base = Array.isArray(initialPlayers) ? initialPlayers : [];

  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<number | null>(
    base.length ? base[0].id : null
  );

  // Alphabetical + search filter
  const players = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((p) => {
      const hay = `${p.first_name} ${p.last_name} ${p.team?.name ?? ""} ${p.position}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [base, q]);

  // Quick lookup for spotlight
  const byId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p] as const)),
    [players]
  );
  const active = activeId != null ? byId[activeId] ?? null : null;

  // Track visible list items
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

  return (
    <div className="w-screen px-4 sm:px-8 lg:px-12 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 2xl:gap-8">
        {/* LEFT: Spotlight */}
        <aside className="xl:col-span-5 2xl:col-span-4">
          <div className="xl:sticky xl:top-6">
            {active ? (
              <SpotlightCard player={active} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
                {players.length
                  ? "Πέρασε τον κέρσορα από έναν παίκτη."
                  : "Δεν υπάρχουν παίκτες για εμφάνιση."}
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT: List */}
        <section className="xl:col-span-7 2xl:col-span-8">
          <div className="flex items-center gap-3 mb-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση παίκτη ή ομάδας…"
              className="w-full bg-slate-950 border border-white/15 rounded-md px-3 py-2 text-white text-sm"
            />
            <div className="text-white/50 text-sm shrink-0">
              {players.length} παίκτες
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="divide-y divide-white/10">
              {players.map((p, idx) => {
                const prev = players[idx - 1];
                const letter = (p.last_name || p.first_name || "?")
                  .charAt(0)
                  .toUpperCase();
                const prevLetter = (prev?.last_name || prev?.first_name || "")
                  .charAt(0)
                  .toUpperCase();
                const showLetter = !prev || prevLetter !== letter;

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
                      onMouseEnter={() => setActiveId(p.id)}
                      className={`flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer ${
                        activeId === p.id ? "ring-1 ring-cyan-400/40" : ""
                      }`}
                    >
                      <div className="relative w-12 h-12 overflow-hidden rounded-md bg-white/10 shrink-0">
                        <Image
                          src={p.photo}
                          alt={`${p.first_name} ${p.last_name}`}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-white/60 text-xs">
                          {p.team?.name ? p.team.name + " • " : ""}
                          {p.position || "—"} {p.height_cm ? `• ${p.height_cm}cm` : ""}{" "}
                          {p.age != null ? `• ${p.age}y` : ""}
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-2 text-[11px] text-white/70">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                          Aγ: {p.matches}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                          Γκ: {p.goals}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                          Αστ: {p.assists}
                        </span>
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

function SpotlightCard({ player }: { player: PlayerLite }) {
  const full = `${player.first_name} ${player.last_name}`.trim();

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-zinc-900/60 to-slate-900/70 p-5">
      {/* hero image */}
      <div className="relative overflow-hidden rounded-xl mb-4">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-transparent to-fuchsia-500/20 blur-2xl" />
        <div className="relative w-full aspect-[16/9] md:aspect-[4/3] rounded-xl overflow-hidden">
          <Image
            src={player.photo}
            alt={full}
            fill
            sizes="(min-width: 1536px) 640px, (min-width: 1280px) 560px, 100vw"
            className="object-cover scale-[1.02] hover:scale-[1.06] transition-transform duration-500"
          />
        </div>
      </div>

      {/* identity */}
      <div className="flex items-start gap-3">
        {player.team?.logo ? (
          <Image
            src={player.team.logo}
            alt={player.team.name}
            width={48}
            height={48}
            className="rounded-md object-cover bg-white/10"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-white/10" />
        )}

        <div className="flex-1">
          <div className="text-white text-xl md:text-2xl font-semibold leading-tight">
            {full}
          </div>
          <div className="text-white/70 text-sm">
            {player.team?.name ? player.team.name + " • " : ""}
            {player.position || "Θέση —"} {player.height_cm ? `• ${player.height_cm}cm` : ""}{" "}
            {player.age != null ? `• ${player.age} ετών` : ""}
          </div>
        </div>
      </div>

      {/* quick facts grid */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <Fact label="Αγώνες" value={player.matches} />
        <Fact label="Γκολ" value={player.goals} />
        <Fact label="Ασσίστ" value={player.assists} />
        <Fact label="Κίτρινες" value={player.yellow_cards} />
        <Fact label="Κόκκινες" value={player.red_cards} />
        <Fact label="Μπλε" value={player.blue_cards} />
        <Fact label="MVP" value={player.mvp} />
        <Fact label="Καλ. Τερμ." value={player.best_gk} />
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-white/60">{label}</div>
      <div className="text-white font-medium tabular-nums">{value ?? "—"}</div>
    </div>
  );
}
