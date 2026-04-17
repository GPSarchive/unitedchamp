"use client";

/**
 * Tournament Page — v2.0 "DISPATCH" · Midnight edition
 * Editorial sports-broadsheet × kinetic brutalism, dark palette.
 * Near-black ground. Ivory ink. Orange signal. Saffron honours.
 */

import React, { useMemo, useRef, useEffect, useState } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";
import type {
  Awards,
  DraftMatch,
  Group,
  Player,
  Stage,
  Standing,
  Team,
  Tournament,
} from "@/app/tournaments/useTournamentData";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";
import KOBracketV2Dark from "./KOBracketV2Dark";
import MobileShell from "./MobileShell";

// ───────────────────────────────────────────────────────────────────────
// Typography — distinctive editorial pairing.
// Fraunces (italic display) × Archivo Black (condensed heavy) × JetBrains Mono (data)
// ───────────────────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────────────────
// Shared types
// ───────────────────────────────────────────────────────────────────────
type Props = {
  initialData: {
    tournament: Tournament;
    teams: Team[];
    players: Player[];
    matches: DraftMatch[];
    stages: Stage[];
    standings: Standing[];
    awards: Awards | null;
    groups: Group[];
  };
};

// ───────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────
const elDate = (iso?: string | null, opts?: Intl.DateTimeFormatOptions) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "short",
        ...opts,
      })
    : "";

const elTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const pad2 = (n: number | string) => String(n).padStart(2, "0");

// Hook: count-up on scroll-into-view
function useCountUp(target: number, inView: boolean, duration = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, inView, duration]);
  return v;
}

// ───────────────────────────────────────────────────────────────────────
// Paper texture + grain — CSS-only background atmosphere
// ───────────────────────────────────────────────────────────────────────
const PaperBackground: React.FC = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
    {/* Deep navy base — matches site's GridBgSection palette (#08080f / #1a1a2e) */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
      }}
    />
    {/* orange signal halo top-left */}
    <div
      className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
      }}
    />
    {/* red-purple glow bottom-right — matches site's redPurpleGlow */}
    <div
      className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
      }}
    />
    {/* fine grid */}
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.04]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="v2grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#v2grid)" />
    </svg>
    {/* grain */}
    <svg
      className="absolute inset-0 h-full w-full mix-blend-screen opacity-[0.08]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="v2noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#v2noise)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Top strip — fixed tournament meta
// ───────────────────────────────────────────────────────────────────────
const TopStrip: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const statusCopy =
    tournament.status === "running"
      ? "ΖΩΝΤΑΝΑ"
      : tournament.status === "completed"
      ? "ΕΛΗΞΕ"
      : tournament.status === "archived"
      ? "ΑΡΧΕΙΟ"
      : "ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΟ";

  return (
    <div className="border-b-2 border-[#F3EFE6]/20 bg-[#0a0a14]/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-2.5 font-mono text-[11px] tracking-[0.22em] uppercase text-[#F3EFE6]">
        <div className="flex items-center gap-4">
          <span>Ενημέρωση N°{pad2(tournament.id)}</span>
          <span className="hidden md:inline opacity-60">/</span>
          <span className="hidden md:inline">Σεζόν {tournament.season ?? "—"}</span>
        </div>
        <div className="flex items-center gap-3">
          {tournament.status === "running" && (
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#fb923c]" />
          )}
          <span className="font-bold">{statusCopy}</span>
          <span className="opacity-60">·</span>
          <span>{tournament.format.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Champion plate — team badge + team colour + saffron honours
// ───────────────────────────────────────────────────────────────────────
const ChampionPlate: React.FC<{ winner: Team }> = ({ winner }) => {
  const teamColour =
    winner.colour && /^#[0-9A-Fa-f]{6}$/.test(winner.colour)
      ? winner.colour
      : "#E8B931"; // fallback to saffron if team has no colour set

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative overflow-hidden border-2 rotate-[1.5deg] bg-[#13131d] text-[#F3EFE6]"
      style={{
        borderColor: "rgba(243,239,230,0.2)",
        boxShadow: `10px 10px 0 0 ${teamColour}`,
      }}
    >
      {/* Colour strip — team identity */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: teamColour }}
      />
      {/* Radial halo using team colour */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 85% 15%, ${teamColour}22 0%, transparent 55%)`,
        }}
      />

      {/* Header strip */}
      <div className="relative flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#0a0a14]/60 px-4 py-1.5 pl-5 font-mono text-[10px] uppercase tracking-[0.3em]">
        <span className="flex items-center gap-1.5 font-bold text-[#E8B931]">
          ★ Πρωταθλητής
        </span>
        <span className="text-[#F3EFE6]/55">01</span>
      </div>

      {/* Body — badge + name */}
      <div className="relative flex items-center gap-4 px-4 py-4 pl-5">
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 bg-[#0a0a14]"
          style={{
            borderColor: teamColour,
            boxShadow: `0 0 24px ${teamColour}33`,
          }}
        >
          {winner.logo ? (
            <img
              src={winner.logo}
              alt={winner.name}
              className="h-[90%] w-[90%] rounded-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/team-placeholder.svg";
              }}
            />
          ) : (
            <span
              className="font-[var(--f-brutal)] text-2xl"
              style={{ color: teamColour }}
            >
              {String(winner.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: teamColour }}
          >
            Νικητής
          </p>
          <p className="mt-1 font-[var(--f-display)] text-2xl font-black italic leading-none text-[#F3EFE6] truncate">
            {winner.name}
          </p>
        </div>
      </div>

      {/* Footer — record + points */}
      <div className="relative flex items-center justify-between border-t border-[#F3EFE6]/10 px-4 py-2 pl-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
        <span className="flex items-center gap-2">
          <span className="text-[#F3EFE6]/45">Ρεκόρ</span>
          <span className="font-[var(--f-brutal)] text-sm text-[#F3EFE6]">
            {winner.wins}Ν·{winner.draws}Ι·{winner.losses}Η
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[#F3EFE6]/45">Βαθμοί</span>
          <span
            className="font-[var(--f-brutal)] text-lg leading-none"
            style={{ color: teamColour }}
          >
            {winner.points}
          </span>
        </span>
      </div>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Hero masthead
// ───────────────────────────────────────────────────────────────────────
const Masthead: React.FC<{
  tournament: Tournament;
  winner?: Team | null;
  totals: { teams: number; stages: number; matches: number; goals: number };
}> = ({ tournament, winner, totals }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const watermarkX = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const watermarkOpacity = useTransform(scrollYProgress, [0, 0.8], [0.08, 0]);

  return (
    <header
      ref={ref}
      className="relative overflow-hidden border-b-2 border-[#F3EFE6]/20"
    >
      {/* giant rotated watermark name */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-start"
        style={{ x: watermarkX, opacity: watermarkOpacity }}
      >
        <span
          className="whitespace-nowrap font-[var(--f-display)] italic font-black leading-none tracking-tighter text-[#F3EFE6]"
          style={{ fontSize: "clamp(12rem, 28vw, 30rem)" }}
        >
          {tournament.name}
        </span>
      </motion.div>

      <div className="relative mx-auto max-w-[1400px] px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        {/* breadcrumb */}
        <nav className="mb-10 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
          <Link href="/" className="hover:text-[#fb923c] transition-colors">
            Αρχική
          </Link>
          <span>/</span>
          <Link href="/tournaments" className="hover:text-[#fb923c] transition-colors">
            Διοργανώσεις
          </Link>
          <span>/</span>
          <span className="text-[#F3EFE6]">{tournament.name}</span>
        </nav>

        <div className="grid grid-cols-12 gap-6 md:gap-10">
          {/* Left: editorial title */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-8"
          >
            <div className="mb-6 flex flex-wrap items-center gap-3 font-mono text-xs tracking-[0.2em] uppercase">
              
              <span className="border border-[#F3EFE6]/20 px-2 py-1 text-[#F3EFE6]">
                {tournament.format}
              </span>
              {tournament.season && (
                <span className="border border-[#F3EFE6]/20 px-2 py-1 text-[#F3EFE6]">
                  Σεζόν {tournament.season}
                </span>
              )}
            </div>

            <h1
              className="font-[var(--f-display)] font-black leading-[0.85] tracking-[-0.03em] text-[#F3EFE6]"
              style={{ fontSize: "clamp(3rem, 9vw, 9rem)" }}
            >
              <span className="block italic">{tournament.name.split(" ")[0]}</span>
              {tournament.name.split(" ").slice(1).join(" ") && (
                <span className="block not-italic text-[#F3EFE6]/90">
                  {tournament.name.split(" ").slice(1).join(" ")}
                </span>
              )}
            </h1>

            {/* decorative byline */}
            <div className="mt-8 flex items-center gap-4">
              <span className="h-[2px] w-16 bg-[#13131d]" />
              <p className="font-[var(--f-body)] max-w-xl text-sm md:text-base text-[#F3EFE6]/70 leading-relaxed">
                Πλήρες χρονικό αγώνων, βαθμολογιών, τιμών και ηρώων —
                κάθε πάσα, κάθε γκολ, κάθε κρίσιμη στιγμή του
                <span className="italic text-[#fb923c] font-semibold">
                  {" "}
                  {tournament.name}
                </span>
                {tournament.season ? `, ${tournament.season}.` : "."}
              </p>
            </div>
          </motion.div>

          {/* Right: emblem → count chips → champion plate (when set) */}
          <motion.aside
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-4 flex flex-col gap-4"
          >
            {/* Emblem panel — always shown */}
            {tournament.logo ? (
              <div className="rotate-[-1.5deg] border-2 border-[#F3EFE6]/20 bg-[#0a0a14] p-5 shadow-[8px_8px_0_0_#fb923c]">
                <img
                  src={tournament.logo}
                  alt={tournament.name}
                  className="h-40 w-full object-contain"
                />
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/60 text-center">
                  Επίσημο Έμβλημα
                </p>
              </div>
            ) : null}

            {/* quick count chips */}
            <div className="grid grid-cols-3 border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
              {[
                { label: "Ομάδες", v: totals.teams },
                { label: "Φάσεις", v: totals.stages },
                { label: "Αγώνες", v: totals.matches },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={`p-3 text-center ${
                    i < 2 ? "border-r-2 border-[#F3EFE6]/20" : ""
                  }`}
                >
                  <div className="font-[var(--f-brutal)] text-2xl text-[#F3EFE6]">
                    {pad2(s.v)}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Champion plate — appears when tournament has a declared winner */}
            {winner && <ChampionPlate winner={winner} />}
          </motion.aside>
        </div>
      </div>
    </header>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Big-number ribbon
// ───────────────────────────────────────────────────────────────────────
const NumberRibbon: React.FC<{
  stats: { label: string; value: number; sub?: string }[];
}> = ({ stats }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section
      ref={ref}
      className="border-b-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]"
    >
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <StatCell key={s.label} stat={s} inView={inView} index={i} last={i === stats.length - 1} />
        ))}
      </div>
    </section>
  );
};

const StatCell: React.FC<{
  stat: { label: string; value: number; sub?: string };
  inView: boolean;
  index: number;
  last: boolean;
}> = ({ stat, inView, index, last }) => {
  const v = useCountUp(stat.value, inView);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className={`group relative overflow-hidden p-6 md:p-10 ${
        !last ? "md:border-r border-[#F3EFE6]/15" : ""
      } border-b md:border-b-0 border-[#F3EFE6]/15`}
    >
      {/* hover vermillion wipe */}
      <div className="absolute inset-0 translate-y-full bg-[#fb923c] transition-transform duration-500 group-hover:translate-y-0" />
      <div className="relative">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/60 group-hover:text-[#0a0a14]">
          / {pad2(index + 1)} · {stat.label}
        </div>
        <div
          className="mt-3 font-[var(--f-brutal)] leading-none text-[#F3EFE6] group-hover:text-[#0a0a14]"
          style={{ fontSize: "clamp(3rem, 6vw, 6rem)" }}
        >
          {v}
        </div>
        {stat.sub && (
          <div className="mt-2 font-mono text-xs text-[#F3EFE6]/50 group-hover:text-[#0a0a14]/80">
            {stat.sub}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Section header — newspaper rubric
// ───────────────────────────────────────────────────────────────────────
const Rubric: React.FC<{
  kicker: string;
  title: string;
  meta?: string;
  id?: string;
}> = ({ kicker, title, meta, id }) => (
  <div id={id} className="mb-8 md:mb-12">
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
      <span className="h-[2px] w-8 bg-[#fb923c]" />
      {kicker}
    </div>
    <div className="mt-3 flex items-end justify-between gap-6 border-b-2 border-[#F3EFE6]/20 pb-3">
      <h2
        className="font-[var(--f-display)] font-black italic leading-none tracking-[-0.02em] text-[#F3EFE6]"
        style={{ fontSize: "clamp(2rem, 5vw, 4.5rem)" }}
      >
        {title}
      </h2>
      {meta && (
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#F3EFE6]/60">
          {meta}
        </span>
      )}
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Broadsheet standings table
// ───────────────────────────────────────────────────────────────────────
const StandingsBroadsheet: React.FC<{
  standings: Standing[];
  teamById: Map<number, Team>;
  groupById: Map<number, Group>;
  title?: string;
}> = ({ standings, teamById, groupById, title }) => {
  if (!standings.length)
    return (
      <div className="border-2 border-dashed border-[#F3EFE6]/30 bg-[#0a0a14]/50 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50">
        Καμία βαθμολογία ακόμα
      </div>
    );

  // Group by group_id
  const byGroup = new Map<number | string, Standing[]>();
  for (const s of standings) {
    const gid = s.group_id ?? "league";
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid)!.push(s);
  }

  return (
    <div className="space-y-10">
      {Array.from(byGroup.entries()).map(([gid, rows]) => {
        const g = typeof gid === "number" ? groupById.get(gid) : null;
        const sorted = [...rows].sort(
          (a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.points - a.points
        );
        return (
          <div key={String(gid)} className="overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
            {g && (
              <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/20 bg-[#13131d] px-5 py-2 text-[#F3EFE6]">
                <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
                  Όμιλος · {g.name}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">
                  {sorted.length} ομάδες
                </span>
              </div>
            )}
            <table className="w-full text-[#F3EFE6]">
              <thead>
                <tr className="border-b-2 border-[#F3EFE6]/20 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
                  <th className="w-14 px-2 py-3 text-left">#</th>
                  <th className="px-2 py-3 text-left">Ομάδα</th>
                  <th className="px-2 py-3 text-center">Αγώνες</th>
                  <th className="px-2 py-3 text-center">Ν</th>
                  <th className="px-2 py-3 text-center">Ι</th>
                  <th className="px-2 py-3 text-center">Η</th>
                  <th className="hidden sm:table-cell px-2 py-3 text-center">Υπέρ</th>
                  <th className="hidden sm:table-cell px-2 py-3 text-center">Κατά</th>
                  <th className="px-2 py-3 text-center">Διαφορά</th>
                  <th className="px-3 py-3 text-right">ΒΑΘ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const t = teamById.get(row.team_id);
                  const isLead = i === 0;
                  const isTail = i === sorted.length - 1 && sorted.length > 3;
                  return (
                    <motion.tr
                      key={`${gid}-${row.team_id}`}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ delay: i * 0.04 }}
                      className={`group border-b border-[#F3EFE6]/15 last:border-0 transition-colors hover:bg-[#13131d] hover:text-[#F3EFE6]`}
                    >
                      <td className="px-2 py-3 align-middle">
                        <span
                          className={`font-[var(--f-brutal)] text-2xl md:text-3xl leading-none ${
                            isLead
                              ? "text-[#fb923c]"
                              : isTail
                              ? "text-[#F3EFE6]/30 group-hover:text-[#F3EFE6]/40"
                              : "text-[#F3EFE6] group-hover:text-[#F3EFE6]"
                          }`}
                        >
                          {pad2(row.rank ?? i + 1)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          {t?.logo && (
                            <img
                              src={t.logo}
                              alt=""
                              className="h-7 w-7 rounded-full border border-[#F3EFE6]/40 object-cover group-hover:border-[#F3EFE6]/40"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = "/team-placeholder.svg";
                              }}
                            />
                          )}
                          <span className="font-[var(--f-display)] text-base md:text-lg font-semibold">
                            {t?.name ?? `Ομάδα #${row.team_id}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-sm">{row.played}</td>
                      <td className="px-2 py-3 text-center font-mono text-sm">{row.won}</td>
                      <td className="px-2 py-3 text-center font-mono text-sm">{row.drawn}</td>
                      <td className="px-2 py-3 text-center font-mono text-sm">{row.lost}</td>
                      <td className="hidden sm:table-cell px-2 py-3 text-center font-mono text-sm">
                        {row.gf}
                      </td>
                      <td className="hidden sm:table-cell px-2 py-3 text-center font-mono text-sm">
                        {row.ga}
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-sm">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-[var(--f-brutal)] text-xl">{row.points}</span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Match dispatch row — newspaper style result / fixture
// ───────────────────────────────────────────────────────────────────────
const MatchRow: React.FC<{
  m: DraftMatch;
  teamById: Map<number, Team>;
  mode: "result" | "fixture";
  index: number;
}> = ({ m, teamById, mode, index }) => {
  const a = m.team_a_id ? teamById.get(m.team_a_id) : null;
  const b = m.team_b_id ? teamById.get(m.team_b_id) : null;
  const aWon = m.winner_team_id === m.team_a_id;
  const bWon = m.winner_team_id === m.team_b_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: index * 0.05 }}
      className="group grid grid-cols-12 items-center gap-3 border-b-2 border-[#F3EFE6]/20 py-5 last:border-0 hover:border-[#fb923c]"
    >
      {/* left date block */}
      <div className="col-span-3 md:col-span-2">
        <div
          className={`inline-flex flex-col items-center border-2 ${
            mode === "result"
              ? "border-[#F3EFE6]/20 bg-[#0a0a14]"
              : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]"
          } px-3 py-2`}
        >
          <span className="font-[var(--f-brutal)] text-2xl leading-none">
            {m.match_date ? new Date(m.match_date).getDate() : "—"}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em]">
            {m.match_date
              ? new Date(m.match_date).toLocaleDateString("el-GR", { month: "short" })
              : ""}
          </span>
        </div>
      </div>

      {/* teams & score */}
      <div className="col-span-9 md:col-span-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center justify-end gap-3 text-right min-w-0">
          <span
            className={`truncate font-[var(--f-display)] text-lg md:text-xl font-semibold ${
              aWon ? "text-[#F3EFE6]" : bWon ? "text-[#F3EFE6]/40" : "text-[#F3EFE6]"
            }`}
          >
            {a?.name ?? "ΤΒΑ"}
          </span>
          {a?.logo && (
            <img
              src={a.logo}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/team-placeholder.svg";
              }}
            />
          )}
        </div>

        <div className="shrink-0">
          {mode === "result" ? (
            <div className="flex items-center gap-2 border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-1.5 font-[var(--f-brutal)] text-2xl md:text-3xl leading-none text-[#F3EFE6]">
              <span className={aWon ? "text-[#fb923c]" : ""}>{m.team_a_score ?? 0}</span>
              <span className="text-[#F3EFE6]/30">:</span>
              <span className={bWon ? "text-[#fb923c]" : ""}>{m.team_b_score ?? 0}</span>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#F3EFE6]/60 px-3 py-1.5 text-center font-mono text-xs uppercase tracking-[0.25em]">
              {m.match_date ? elTime(m.match_date) : "ΤΒΑ"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 min-w-0">
          {b?.logo && (
            <img
              src={b.logo}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/team-placeholder.svg";
              }}
            />
          )}
          <span
            className={`truncate font-[var(--f-display)] text-lg md:text-xl font-semibold ${
              bWon ? "text-[#F3EFE6]" : aWon ? "text-[#F3EFE6]/40" : "text-[#F3EFE6]"
            }`}
          >
            {b?.name ?? "ΤΒΑ"}
          </span>
        </div>
      </div>

      {/* meta right */}
      <div className="hidden md:flex col-span-2 flex-col items-end gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
        {(m as any).field && <span>ΓΗΠΕΔΟ · {(m as any).field}</span>}
        {(m as any).referee && <span>ΔΙΑΙΤ · {(m as any).referee}</span>}
        {m.matchday != null && <span>ΑΓ · {m.matchday}</span>}
      </div>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Awards — trading card triptych
// ───────────────────────────────────────────────────────────────────────
const AwardCard: React.FC<{
  variant: "scorer" | "mvp" | "gk";
  player: Player;
  team?: Team | null;
  subline?: string;
  index: number;
}> = ({ variant, player, team, subline, index }) => {
  const palette =
    variant === "scorer"
      ? { tint: "#fb923c", label: "Χρυσό Παπούτσι", tag: "ΠΡΩΤΟΣ ΣΚΟΡΕΡ" }
      : variant === "mvp"
      ? { tint: "#E8B931", label: "Πολυτιμότερος", tag: "MVP" }
      : { tint: "#60a5fa", label: "Χρυσά Γάντια", tag: "ΚΑΛΥΤΕΡΟΣ GK" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -2 : 2 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -6, rotate: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group relative border-2 border-[#F3EFE6]/20 bg-[#0a0a14] shadow-[8px_8px_0_0_#fb923c]"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 10%, ${palette.tint}22 0%, transparent 50%),
          radial-gradient(circle at 80% 90%, ${palette.tint}15 0%, transparent 50%)
        `,
      }}
    >
      {/* top rubric */}
      <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/20 bg-[#13131d] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]">
        <span style={{ color: palette.tint }}>★ {palette.tag}</span>
        <span className="opacity-60">#{pad2(index + 1)}</span>
      </div>

      {/* photo panel */}
      <div className="relative h-64 overflow-hidden border-b-2 border-[#F3EFE6]/20 bg-[#13131d]">
        <img
          src={resolvePlayerPhotoUrl(player.photo)}
          alt={player.name}
          className="h-full w-full object-cover opacity-90 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/player-placeholder.svg";
          }}
        />
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: `linear-gradient(180deg, transparent 40%, ${palette.tint}30 100%)`,
          }}
        />
        {/* foil strip */}
        <div
          className="absolute top-3 right-3 h-16 w-2"
          style={{
            background: `linear-gradient(180deg, ${palette.tint} 0%, #F3EFE6 50%, ${palette.tint} 100%)`,
          }}
        />
      </div>

      {/* name panel */}
      <div className="px-4 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
          {palette.label}
        </p>
        <p
          className="mt-1 font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6]"
        >
          {player.name}
        </p>
        {team && (
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-[#F3EFE6]/50">
            {team.name}
          </p>
        )}
        {subline && (
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-[var(--f-brutal)] text-3xl text-[#F3EFE6]">
              {subline.split(" ")[0]}
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#F3EFE6]/60">
              {subline.split(" ").slice(1).join(" ")}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Top Scorers — bar-chart leaderboard
// ───────────────────────────────────────────────────────────────────────
const TopScorers: React.FC<{
  players: Player[];
  teamById: Map<number, Team>;
}> = ({ players, teamById }) => {
  const top = useMemo(
    () =>
      [...players]
        .filter((p) => !p.isDeleted && (p.goals || 0) > 0)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
        .slice(0, 10),
    [players]
  );
  const max = top[0]?.goals ?? 1;

  if (!top.length) return null;

  return (
    <div className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
      <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/20 bg-[#13131d] px-5 py-3 text-[#F3EFE6]">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
          Πίνακας Σκόρερ
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">
          Γκολ + Ασίστ
        </span>
      </div>
      <ul className="divide-y-2 divide-[#F3EFE6]/15">
        {top.map((p, i) => {
          const t = teamById.get(p.teamId);
          const pct = (p.goals / max) * 100;
          return (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.05 }}
              className="grid grid-cols-12 items-center gap-3 px-4 py-3 md:px-5 md:py-4"
            >
              <div className="col-span-1 flex justify-center">
                <span
                  className={`font-[var(--f-brutal)] text-xl leading-none ${
                    i === 0 ? "text-[#fb923c]" : "text-[#F3EFE6]"
                  }`}
                >
                  {pad2(i + 1)}
                </span>
              </div>
              <div className="col-span-7 md:col-span-5 flex items-center gap-3 min-w-0">
                <img
                  src={resolvePlayerPhotoUrl(p.photo)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full border border-[#F3EFE6]/40 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/player-placeholder.svg";
                  }}
                />
                <div className="min-w-0">
                  <p className="font-[var(--f-display)] font-semibold text-[#F3EFE6] truncate">
                    {p.name}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/50">
                    {t?.name ?? `Ομάδα #${p.teamId}`}
                    {p.position ? ` · ${p.position}` : ""}
                  </p>
                </div>
              </div>
              <div className="col-span-0 md:col-span-4 hidden md:block">
                <div className="relative h-3 overflow-hidden border border-[#F3EFE6]/20 bg-[#0a0a14]">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.9, delay: 0.15 + i * 0.04, ease: "easeOut" }}
                    className="h-full"
                    style={{
                      background:
                        i === 0
                          ? "#fb923c"
                          : i < 3
                          ? "#F3EFE6"
                          : "repeating-linear-gradient(45deg,rgba(243,239,230,0.6),rgba(243,239,230,0.6) 4px,transparent 4px,transparent 8px)",
                    }}
                  />
                </div>
              </div>
              <div className="col-span-4 md:col-span-2 flex items-baseline justify-end gap-3 font-mono">
                <span className="font-[var(--f-brutal)] text-2xl text-[#F3EFE6]">
                  {p.goals}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/50">
                  +{p.assists}Ασ
                </span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Teams grid — bold cards with colour strip
// ───────────────────────────────────────────────────────────────────────
const TeamsGrid: React.FC<{
  teams: Team[];
  players: Player[];
}> = ({ teams, players }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team, i) => {
        const roster = players.filter((p) => p.teamId === team.id && !p.isDeleted);
        const colour = (team as any).colour as string | undefined;
        const accent = colour || (i % 2 === 0 ? "#fb923c" : "#60a5fa");
        return (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.04 }}
            className="group relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] transition-shadow hover:shadow-[6px_6px_0_0_#fb923c]"
          >
            {/* vertical colour strip */}
            <div
              className="absolute left-0 top-0 h-full w-2"
              style={{ background: accent }}
            />
            <div className="flex items-center gap-4 border-b-2 border-[#F3EFE6]/15 px-5 pl-6 py-4">
              <img
                src={team.logo}
                alt={team.name}
                className="h-12 w-12 rounded-full border-2 border-[#F3EFE6]/20 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/team-placeholder.svg";
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-[var(--f-display)] text-lg font-bold italic leading-tight text-[#F3EFE6] truncate">
                  {team.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
                  {team.wins}Ν · {team.draws}Ι · {team.losses}Η
                </p>
              </div>
              <div className="text-right">
                <div className="font-[var(--f-brutal)] text-2xl leading-none text-[#F3EFE6]">
                  {team.points}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/50">
                  ΒΑΘ
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x-2 divide-[#F3EFE6]/10 border-b-2 border-[#F3EFE6]/15 pl-2">
              {[
                { l: "Υπέρ", v: team.goalsFor },
                { l: "Κατά", v: team.goalsAgainst },
                { l: "Διαφορά", v: team.goalDifference },
                { l: "Αγώνες", v: team.matchesPlayed },
              ].map((c) => (
                <div key={c.l} className="px-2 py-2 text-center">
                  <div className="font-[var(--f-brutal)] text-base text-[#F3EFE6]">
                    {c.v}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/50">
                    {c.l}
                  </div>
                </div>
              ))}
            </div>

            {roster.length > 0 && (
              <div className="px-5 pl-6 py-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/50">
                  Ρόστερ — {roster.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {roster.slice(0, 12).map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 border border-[#F3EFE6]/25 bg-[#0a0a14] px-1.5 py-0.5 font-mono text-[10px] text-[#F3EFE6]/80"
                    >
                      {p.isCaptain && <span className="text-[#fb923c]">C</span>}
                      {p.name}
                    </span>
                  ))}
                  {roster.length > 12 && (
                    <span className="font-mono text-[10px] text-[#F3EFE6]/50">
                      +{roster.length - 12}
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Stages section — per-stage standings + fixtures
// ───────────────────────────────────────────────────────────────────────
const StageBlock: React.FC<{
  stage: Stage;
  index: number;
  matches: DraftMatch[];
  standings: Standing[];
  teamById: Map<number, Team>;
  groupById: Map<number, Group>;
  championTeamId?: number | null;
}> = ({ stage, index, matches, standings, teamById, groupById, championTeamId }) => {
  const isKnockout = stage.kind === "knockout";
  const [tab, setTab] = useState<"table" | "bracket" | "fixtures" | "results">(
    isKnockout ? "bracket" : "table"
  );

  const stageMatches = matches.filter(
    (m) => m.stageIdx === index || (m as any).stage_id === stage.id
  );
  const fixtures = stageMatches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? ""));
  const results = stageMatches
    .filter((m) => m.status === "finished")
    .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""));

  const stageStandings = standings.filter((s) => s.stage_id === stage.id);

  const kindLabel =
    stage.kind === "league"
      ? "Πρωτάθλημα"
      : stage.kind === "groups"
      ? "Όμιλοι"
      : stage.kind === "knockout"
      ? "Νοκ Άουτ"
      : stage.kind;

  const tabs = (isKnockout
    ? (["bracket", "results", "fixtures"] as const)
    : (["table", "results", "fixtures"] as const));

  const tabLabel = (t: typeof tabs[number]) => {
    if (t === "table") return "Βαθμολογία";
    if (t === "bracket") return "Δέντρο";
    if (t === "results") return `Αποτελέσματα (${results.length})`;
    return `Πρόγραμμα (${fixtures.length})`;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6 }}
      className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14]"
    >
      {/* stage header */}
      <div className="relative flex flex-wrap items-center gap-4 border-b-2 border-[#F3EFE6]/20 bg-[#13131d] px-5 py-4 text-[#F3EFE6]">
        <span className="font-[var(--f-brutal)] text-4xl md:text-5xl leading-none text-[#E8B931]">
          {pad2(index + 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
             {index + 1} · {kindLabel}
          </p>
          <h3 className="font-[var(--f-display)] text-2xl md:text-3xl font-black italic leading-tight text-[#F3EFE6]">
            {stage.name}
          </h3>
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-2 border-[#F3EFE6]/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                tab === t
                  ? "bg-[#0a0a14] text-[#F3EFE6]"
                  : "bg-transparent text-[#F3EFE6] hover:bg-[#0a0a14]/10"
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 md:p-8">
        <AnimatePresence mode="wait">
          {tab === "table" && (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <StandingsBroadsheet
                standings={stageStandings}
                teamById={teamById}
                groupById={groupById}
              />
            </motion.div>
          )}

          {tab === "bracket" && (
            <motion.div
              key="bracket"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <KOBracketV2Dark
                stage={stage}
                stageIdx={index}
                matches={stageMatches}
                teamById={teamById}
                championTeamId={championTeamId ?? null}
              />
            </motion.div>
          )}

          {tab === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {results.length ? (
                <div>
                  {results.slice(0, 12).map((m, i) => (
                    <MatchRow
                      key={m.db_id ?? i}
                      m={m}
                      teamById={teamById}
                      mode="result"
                      index={i}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#F3EFE6]/30 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50">
                  Δεν υπάρχουν αποτελέσματα ακόμα
                </div>
              )}
            </motion.div>
          )}

          {tab === "fixtures" && (
            <motion.div
              key="fixtures"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {fixtures.length ? (
                <div>
                  {fixtures.slice(0, 12).map((m, i) => (
                    <MatchRow
                      key={m.db_id ?? i}
                      m={m}
                      teamById={teamById}
                      mode="fixture"
                      index={i}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#F3EFE6]/30 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50">
                  Δεν υπάρχουν προγραμματισμένοι αγώνες
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Ticker — scrolling marquee of upcoming fixtures
// ───────────────────────────────────────────────────────────────────────
const FixtureTicker: React.FC<{
  matches: DraftMatch[];
  teamById: Map<number, Team>;
}> = ({ matches, teamById }) => {
  const upcoming = useMemo(
    () =>
      matches
        .filter((m) => m.status === "scheduled")
        .sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? ""))
        .slice(0, 10),
    [matches]
  );

  if (!upcoming.length) return null;
  const loop = [...upcoming, ...upcoming];

  return (
    <section className="relative overflow-hidden border-y-2 border-[#F3EFE6]/20 bg-[#fb923c] text-[#F3EFE6]">
      <div className="flex items-center gap-6 py-3">
        <span className="shrink-0 border-r-2 border-[#F3EFE6]/20 bg-[#13131d] px-4 py-1 font-mono text-[11px] uppercase tracking-[0.3em] text-[#E8B931]">
          ▲ Επόμενοι
        </span>
        <div className="relative flex-1 overflow-hidden">
          <motion.div
            className="flex items-center gap-10 whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 40, ease: "linear", repeat: Infinity }}
          >
            {loop.map((m, i) => {
              const a = m.team_a_id ? teamById.get(m.team_a_id) : null;
              const b = m.team_b_id ? teamById.get(m.team_b_id) : null;
              return (
                <span
                  key={`${m.db_id}-${i}`}
                  className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.22em]"
                >
                  <span>{elDate(m.match_date)}</span>
                  <span className="opacity-60">·</span>
                  <span className="font-bold">{a?.name ?? "ΤΒΑ"}</span>
                  <span className="opacity-60">VS</span>
                  <span className="font-bold">{b?.name ?? "ΤΒΑ"}</span>
                  <span className="ml-6 text-[#F3EFE6]">◆</span>
                </span>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Footer colophon
// ───────────────────────────────────────────────────────────────────────
const Colophon: React.FC<{ tournament: Tournament }> = ({ tournament }) => (
  <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
    <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-end">
      <div>
        
        <h3
          className="mt-2 font-[var(--f-display)] font-black italic leading-none"
          style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
        >
          {tournament.name}
        </h3>
        <p className="mt-3 font-[var(--f-body)] text-sm text-[#F3EFE6]/60 max-w-lg">
          Από τις γραμμές του γηπέδου. Όλοι οι αγώνες, βαθμολογίες και βραβεύσεις
          αντικατοπτρίζουν την τρέχουσα κατάσταση.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60 md:items-end">
        <span>Εκδ. {pad2(tournament.id)} · Σεζόν {tournament.season ?? "—"}</span>
        <span>Μορφή · {tournament.format}</span>
        <Link href="/tournaments" className="mt-2 border border-[#F3EFE6]/30 px-3 py-1 text-[#F3EFE6] hover:bg-[#0a0a14] hover:text-[#F3EFE6] transition-colors">
          ← Όλες οι Διοργανώσεις
        </Link>
      </div>
    </div>
  </footer>
);

// ───────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────
const TournamentClientV2Dark: React.FC<Props> = ({ initialData }) => {
  const { tournament, teams, players, matches, stages, standings, awards, groups } =
    initialData;

  const teamById = useMemo(() => {
    const m = new Map<number, Team>();
    teams.forEach((t) => m.set(t.id, t));
    return m;
  }, [teams]);

  const groupById = useMemo(() => {
    const m = new Map<number, Group>();
    groups.forEach((g) => m.set(g.id, g));
    return m;
  }, [groups]);

  const winner = tournament.winner_team_id
    ? teamById.get(tournament.winner_team_id) ?? null
    : null;

  const totalGoals = useMemo(
    () =>
      matches.reduce(
        (acc, m) => acc + (m.team_a_score ?? 0) + (m.team_b_score ?? 0),
        0
      ),
    [matches]
  );

  const completedMatches = useMemo(
    () => matches.filter((m) => m.status === "finished").length,
    [matches]
  );

  // Sort stages by ordering
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.ordering - b.ordering),
    [stages]
  );

  // Combined standings (if single stage, show as overall)
  const primaryStage = sortedStages[0];
  const topStandings = useMemo(() => {
    if (!primaryStage) return [];
    return standings.filter((s) => s.stage_id === primaryStage.id);
  }, [primaryStage, standings]);

  // Award lookups
  const scorer = awards?.top_scorer_id
    ? players.find((p) => p.id === awards.top_scorer_id) ?? null
    : null;
  const mvp = awards?.mvp_player_id
    ? players.find((p) => p.id === awards.mvp_player_id) ?? null
    : null;
  const gk = awards?.best_gk_player_id
    ? players.find((p) => p.id === awards.best_gk_player_id) ?? null
    : null;

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />

      {/* Mobile shell — visible only on < md */}
      <div className="md:hidden">
        <MobileShell data={initialData} />
      </div>

      {/* Desktop layout — everything below renders only at md+ */}
      <div className="hidden md:block">
        <TopStrip tournament={tournament} />

      <Masthead
        tournament={tournament}
        winner={winner}
        totals={{
          teams: teams.length,
          stages: stages.length,
          matches: matches.length,
          goals: totalGoals,
        }}
      />

      <NumberRibbon
        stats={[
          { label: "Ομάδες", value: teams.length },
          { label: "Φάσεις", value: stages.length, sub: sortedStages.map((s) => s.name).join(" · ") },
          { label: "Αγώνες", value: completedMatches, sub: `από ${matches.length} προγραμματισμένους` },
          { label: "Γκολ", value: totalGoals, sub: matches.length ? `Μ.Ο. ${(totalGoals / Math.max(1, completedMatches)).toFixed(2)}/αγώνα` : "" },
        ]}
      />

      <FixtureTicker matches={matches} teamById={teamById} />

      {/* Overall leaderboard (first stage) */}
      {primaryStage && topStandings.length > 0 && (
        <section className="relative border-b-2 border-[#F3EFE6]/20">
          <div className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
            <Rubric
              kicker={`Βαθμολογία · ${primaryStage.name}`}
              title="Ο Πίνακας"
              meta={`${topStandings.length} εγγραφές`}
            />
            <StandingsBroadsheet
              standings={topStandings}
              teamById={teamById}
              groupById={groupById}
            />
          </div>
        </section>
      )}

      {/* Stages */}
      {sortedStages.length > 0 && (
        <section className="relative border-b-2 border-[#F3EFE6]/20">
          <div className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
            <Rubric
              kicker="Ιστορικό"
              title="Φάσεις & Αγώνες"
              meta={`${sortedStages.length} κεφάλαια`}
            />
            <div className="space-y-8">
              {sortedStages.map((stage, i) => (
                <StageBlock
                  key={stage.id}
                  stage={stage}
                  index={i}
                  matches={matches}
                  standings={standings}
                  teamById={teamById}
                  groupById={groupById}
                  championTeamId={tournament.winner_team_id}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top Scorers */}
      {players.length > 0 && (
        <section className="relative border-b-2 border-[#F3EFE6]/20">
          <div className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
            <Rubric
              kicker="Σκόρερ"
              title="Κορυφαίοι Σκόρερ"
              meta="Σύνολα σεζόν"
            />
            <TopScorers players={players} teamById={teamById} />
          </div>
        </section>
      )}

      {/* Awards */}
      {(scorer || mvp || gk) && (
        <section
          className="relative border-b-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% 10%, #fb923c33 0%, transparent 40%), radial-gradient(circle at 90% 80%, #E8B93133 0%, transparent 40%)",
          }}
        >
          <div className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
            <div className="mb-10 md:mb-14">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#E8B931]">
                <span className="h-[2px] w-8 bg-[#E8B931]" />
                Αίθουσα Τιμής
              </div>
              <h2
                className="mt-3 font-[var(--f-display)] font-black italic leading-none tracking-[-0.02em]"
                style={{ fontSize: "clamp(2rem, 5vw, 4.5rem)" }}
              >
                Οι Ήρωες
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {scorer && (
                <AwardCard
                  variant="scorer"
                  player={scorer}
                  team={teamById.get(scorer.teamId) ?? null}
                  subline={`${awards?.top_scorer_goals ?? scorer.goals} ΓΚΟΛ`}
                  index={0}
                />
              )}
              {mvp && (
                <AwardCard
                  variant="mvp"
                  player={mvp}
                  team={teamById.get(mvp.teamId) ?? null}
                  subline={`${mvp.mvp || 1} ΒΡΑΒΕΙΑ`}
                  index={1}
                />
              )}
              {gk && (
                <AwardCard
                  variant="gk"
                  player={gk}
                  team={teamById.get(gk.teamId) ?? null}
                  subline={`${gk.bestGoalkeeper || 1} ΔΙΑΚΡΙΣΕΙΣ`}
                  index={2}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Teams */}
      {teams.length > 0 && (
        <section className="relative border-b-2 border-[#F3EFE6]/20">
          <div className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
            <Rubric
              kicker="Ρόστερ"
              title="Οι Ομάδες"
              meta={`${teams.length} ομάδες`}
            />
            <TeamsGrid teams={teams} players={players} />
          </div>
        </section>
      )}

      <Colophon tournament={tournament} />
      </div>
    </div>
  );
};

export default TournamentClientV2Dark;
