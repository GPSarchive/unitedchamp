"use client";

/**
 * Team page — editorial sports-broadsheet × kinetic brutalism.
 * Dark palette: near-black ground, ivory ink, orange signal, saffron honours.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fraunces,
  Archivo_Black,
  JetBrains_Mono,
  Figtree,
} from "next/font/google";
import type { Team, PlayerAssociation, Match } from "@/app/lib/types";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";
import {
  FaUser,
  FaFutbol,
  FaHandsHelping,
  FaRunning,
  FaTrophy,
  FaShieldAlt,
} from "react-icons/fa";

// ───────────────────────────────────────────────────────────────────────
// Typography
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
// Types + utilities
// ───────────────────────────────────────────────────────────────────────
type SeasonStats = {
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number;
  best_gk: number;
};

type TournamentLight = {
  id: number;
  name: string | null;
  season: string | null;
  status?: string | null;
  winner_team_id?: number | null;
};

type TournamentWin = {
  id: number;
  name: string | null;
  season: string | null;
};

type Props = {
  team: Team;
  teamId: number;
  tournaments: TournamentLight[];
  wins: TournamentWin[];
  playerAssociations: PlayerAssociation[];
  seasonStatsByPlayer: Record<number, SeasonStats>;
  matches: Match[] | null;
};

const pad2 = (n: number | string) => String(n).padStart(2, "0");

const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

function parseIsoWallClock(iso: string) {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  return { y: +m[1], M: +m[2], d: +m[3], h: +m[4], min: +m[5], s: +m[6] };
}

const wallClockDate = (iso?: string | null): Date | null => {
  if (!iso) return null;
  const p = parseIsoWallClock(iso);
  if (!p) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(p.y, p.M - 1, p.d, p.h, p.min, p.s);
};

const elDate = (iso?: string | null, opts?: Intl.DateTimeFormatOptions) => {
  const d = wallClockDate(iso);
  return d
    ? d.toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "short",
        ...opts,
      })
    : "";
};

const elTime = (iso?: string | null) => {
  if (!iso) return "";
  const p = parseIsoWallClock(iso);
  if (p) return `${pad2(p.h)}:${pad2(p.min)}`;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
};

const hexIsLight = (hex: string | null | undefined) => {
  if (!hex) return false;
  const v = hex.replace("#", "");
  if (v.length !== 6) return false;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
};

// ───────────────────────────────────────────────────────────────────────
// Atmosphere
// ───────────────────────────────────────────────────────────────────────
const PaperBackground: React.FC = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
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
        <pattern id="teamgrid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#teamgrid)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Page header (compact)
// ───────────────────────────────────────────────────────────────────────
const PageHeader: React.FC<{ team: Team }> = ({ team }) => (
  <header className="relative border-b-2 border-[#F3EFE6]/20">
    <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-4 md:px-6 md:pt-10 md:pb-6">
      <nav className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="shrink-0 hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span className="shrink-0">/</span>
        <Link
          href="/OMADES"
          className="shrink-0 hover:text-[#fb923c] transition-colors"
        >
          Ομάδες
        </Link>
        <span className="shrink-0">/</span>
        <span className="min-w-0 truncate text-[#F3EFE6]">{team.name ?? "—"}</span>
      </nav>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Masthead — team hero
// ───────────────────────────────────────────────────────────────────────
const Masthead: React.FC<{
  team: Team;
  accent: string;
  wins: TournamentWin[];
  totals: { players: number; tournaments: number; titles: number };
}> = ({ team, accent, wins, totals }) => {
  const lastWin = wins[0];
  const accentIsLight = hexIsLight(accent);

  return (
    <header className="relative overflow-hidden border-b-2 border-[#F3EFE6]/20">
      <div className="relative mx-auto max-w-[1400px] px-4 pt-8 pb-10 md:px-6 md:pt-14 md:pb-16">
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          {/* Left: name + meta */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-8"
          >
            <div className="mb-5 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]">
              <span className="h-[2px] w-8" style={{ background: accent }} />
              <span style={{ color: accent }}>Προφίλ Ομάδας</span>
              {team.am && (
                <span className="border border-[#F3EFE6]/20 px-2 py-0.5 text-[#F3EFE6]/70">
                  AM · {team.am}
                </span>
              )}
            </div>

            <h1
              className="font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
              style={{ fontSize: "clamp(2rem, 8vw, 6rem)" }}
            >
              {team.name ?? "Ομάδα"}
            </h1>

            <div className="mt-6 flex items-center gap-4">
              <span className="h-[2px] w-12 bg-[#fb923c]" />
              <p className="font-[var(--f-body)] max-w-xl text-sm md:text-base text-[#F3EFE6]/70 leading-relaxed">
                Επίσημο προφίλ, στατιστικά ρόστερ,
                <span className="italic text-[#fb923c] font-semibold">
                  {" "}συμμετοχές σε τουρνουά{" "}
                </span>
                και κατακτήσεις τίτλων.
              </p>
            </div>

            {/* Inline meta chips */}
            <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
              {team.created_at && (
                <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1 text-[#F3EFE6]/70">
                  Μέλος από{" "}
                  {new Date(team.created_at).toLocaleDateString("el-GR", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              {typeof team.season_score === "number" && (
                <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1 text-[#F3EFE6]/70">
                  Σκορ Σεζόν · {team.season_score}
                </span>
              )}
            </div>
          </motion.div>

          {/* Right: crest panel */}
          <motion.aside
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-4 flex flex-col gap-4"
          >
            <div
              className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] p-4 shadow-[6px_6px_0_0_var(--s)] md:p-5 md:shadow-[10px_10px_0_0_var(--s)]"
              style={{ ["--s" as any]: accent } as React.CSSProperties}
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em]">
                <span style={{ color: accent }}>Έμβλημα</span>
                <span className="text-[#F3EFE6]/60">#{pad2(team.id)}</span>
              </div>
              <div className="mt-4 flex items-center justify-center md:mt-5">
                <div
                  className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 md:h-40 md:w-40"
                  style={{
                    borderColor: accent,
                    background: "#13131d",
                    boxShadow: `0 0 60px ${accent}33`,
                  }}
                >
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={team.name ?? "team logo"}
                      className="h-28 w-28 rounded-full object-cover md:h-36 md:w-36"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "/team-placeholder.svg";
                      }}
                    />
                  ) : (
                    <span
                      className="font-[var(--f-brutal)] text-4xl md:text-5xl"
                      style={{ color: accent }}
                    >
                      {String(team.name ?? "?")
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              {lastWin && (
                <div className="mt-4 flex items-center gap-2 border-t border-[#F3EFE6]/15 pt-3 font-mono text-[10px] uppercase tracking-[0.22em] md:mt-5">
                  <span className="shrink-0 text-[#E8B931]">★ Τελευταίος τίτλος</span>
                  <span className="flex-1 truncate text-right font-[var(--f-display)] text-sm italic font-semibold text-[#F3EFE6]">
                    {lastWin.name}
                    {lastWin.season ? ` · ${lastWin.season}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* 3 count chips */}
            <div className="grid grid-cols-3 border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
              {[
                { label: "Παίκτες", v: totals.players },
                { label: "Τουρνουά", v: totals.tournaments },
                { label: "Τίτλοι", v: totals.titles, gold: true },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={`p-2.5 text-center md:p-3 ${
                    i < 2 ? "border-r-2 border-[#F3EFE6]/20" : ""
                  }`}
                >
                  <div
                    className="font-[var(--f-brutal)] text-xl md:text-2xl"
                    style={{ color: s.gold ? "#E8B931" : "#F3EFE6" }}
                  >
                    {pad2(s.v)}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </motion.aside>
        </div>
      </div>
    </header>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Rubric — section header
// ───────────────────────────────────────────────────────────────────────
const Rubric: React.FC<{
  kicker: string;
  title: string;
  meta?: string;
  accent?: string;
}> = ({ kicker, title, meta, accent = "#fb923c" }) => (
  <div className="mb-8 md:mb-10">
    <div
      className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]"
      style={{ color: accent }}
    >
      <span className="h-[2px] w-8" style={{ background: accent }} />
      {kicker}
    </div>
    <div className="mt-3 flex flex-col items-start gap-1 border-b-2 border-[#F3EFE6]/20 pb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <h2
        className="font-[var(--f-display)] font-black italic leading-none tracking-[-0.02em] text-[#F3EFE6]"
        style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)" }}
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
// Honours — titles grid
// ───────────────────────────────────────────────────────────────────────
const HonoursSection: React.FC<{ wins: TournamentWin[] }> = ({ wins }) => {
  if (!wins.length) return null;
  return (
    <section className="relative border-b-2 border-[#F3EFE6]/20">
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6 md:py-16">
        <Rubric
          kicker="Αίθουσα Τιμής"
          title="Κατακτήσεις"
          meta={`${pad2(wins.length)} τίτλοι`}
          accent="#E8B931"
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {wins.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.45 }}
              whileHover={{ y: -4 }}
              className="relative overflow-hidden border-2 border-[#E8B931]/60 bg-[#13131d] p-4 shadow-[4px_4px_0_0_#E8B931] sm:p-5 sm:shadow-[6px_6px_0_0_#E8B931]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 10%, rgba(232,185,49,0.14) 0%, transparent 55%)",
              }}
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-[#E8B931]">
                <span>★ Πρωταθλητής</span>
                <span>#{pad2(i + 1)}</span>
              </div>
              <h3 className="mt-4 font-[var(--f-display)] text-xl sm:text-2xl font-black italic leading-tight text-[#F3EFE6]">
                {w.name ?? "Τουρνουά"}
              </h3>
              {w.season && (
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
                  Σεζόν · {w.season}
                </p>
              )}
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-[var(--f-brutal)] text-3xl sm:text-4xl text-[#E8B931]">
                  01
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
                  τρόπαιο
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Participations — tournament list
// ───────────────────────────────────────────────────────────────────────
const ParticipationsSection: React.FC<{
  tournaments: TournamentLight[];
  winIds: Set<number>;
}> = ({ tournaments, winIds }) => {
  if (!tournaments.length) return null;

  const statusColor = (s?: string | null) =>
    s === "running"
      ? "#fb923c"
      : s === "completed"
      ? "#E8B931"
      : s === "archived"
      ? "#60a5fa"
      : "#F3EFE6";

  const statusLabel = (s?: string | null) =>
    s === "running"
      ? "Ζωντανά"
      : s === "completed"
      ? "Έληξε"
      : s === "archived"
      ? "Αρχείο"
      : "Προγραμματισμένο";

  return (
    <section className="relative border-b-2 border-[#F3EFE6]/20">
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6 md:py-16">
        <Rubric
          kicker="Ιστορικό"
          title="Συμμετοχές"
          meta={`${pad2(tournaments.length)} τουρνουά`}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {tournaments.map((t, i) => {
            const won = winIds.has(t.id);
            const sc = statusColor(t.status);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Link
                  href={`/tournaments/${t.id}`}
                  className="group flex items-center gap-3 border-2 border-[#F3EFE6]/15 bg-[#13131d] p-3 transition-all hover:border-[#F3EFE6]/40 hover:-translate-y-0.5"
                >
                  <span
                    className="font-[var(--f-brutal)] text-lg leading-none"
                    style={{ color: won ? "#E8B931" : "#F3EFE6" }}
                  >
                    {pad2(i + 1)}
                  </span>
                  <span className="h-6 w-[2px] shrink-0" style={{ background: sc }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[var(--f-display)] text-base font-semibold italic text-[#F3EFE6] group-hover:text-[#fb923c] transition-colors">
                      {t.name ?? "Τουρνουά"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                      <span style={{ color: sc }}>{statusLabel(t.status)}</span>
                      {t.season && (
                        <>
                          <span className="opacity-50">·</span>
                          <span>Σεζόν {t.season}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {won && (
                    <span className="shrink-0 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#E8B931]">
                      ★ Νικητής
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-[#F3EFE6]/40 group-hover:text-[#fb923c] transition-colors">
                    →
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Roster — player cards
// ───────────────────────────────────────────────────────────────────────
type RosterPlayer = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  age: number | null;
  heightCm: number | null;
  photoUrl: string;
  stats: SeasonStats;
};

const INITIAL_ROSTER_LIMIT = 6;

const RosterSection: React.FC<{
  players: RosterPlayer[];
  accent: string;
}> = ({ players, accent }) => {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        (p.position ?? "").toLowerCase().includes(q)
    );
  }, [players, query]);

  // Top scorer highlight
  const topScorerId = useMemo<number | null>(() => {
    let bestId: number | null = null;
    let bestGoals = 0;
    players.forEach((p) => {
      if (p.stats.goals > bestGoals) {
        bestGoals = p.stats.goals;
        bestId = p.id;
      }
    });
    return bestGoals > 0 ? bestId : null;
  }, [players]);

  return (
    <section className="relative border-b-2 border-[#F3EFE6]/20">
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6 md:py-16">
        <Rubric
          kicker="Ρόστερ"
          title="Οι Παίκτες"
          meta={`${pad2(filtered.length)} / ${pad2(players.length)}`}
          accent={accent}
        />

        {players.length > 6 && (
          <div className="mb-6 max-w-md">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
                ΑΝΑΖ·
              </span>
              <input
                type="text"
                placeholder="Αναζήτηση παίκτη..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border-2 border-[#F3EFE6]/20 bg-[#0a0a14] pl-16 pr-4 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50">
            {players.length === 0
              ? "Δεν υπάρχουν παίκτες στο ρόστερ"
              : "Κανένα αποτέλεσμα"}
          </div>
        ) : (
          (() => {
            const isSearching = query.trim().length > 0;
            const canToggle = !isSearching && filtered.length > INITIAL_ROSTER_LIMIT;
            const hiddenCount = Math.max(0, filtered.length - INITIAL_ROSTER_LIMIT);
            return (
              <>
                <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((p, i) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      index={i}
                      accent={accent}
                      isTopScorer={p.id === topScorerId}
                      className={
                        !expanded && !isSearching && i >= INITIAL_ROSTER_LIMIT
                          ? "hidden lg:block"
                          : undefined
                      }
                    />
                  ))}
                </div>
                {canToggle && (
                  <div className="mt-8 flex justify-center lg:hidden">
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="group flex items-center gap-3 border-2 border-[#F3EFE6]/30 bg-[#13131d] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#F3EFE6] transition-all hover:border-[#fb923c] hover:text-[#fb923c]"
                      aria-expanded={expanded}
                    >
                      <span
                        className="h-[2px] w-6 transition-all group-hover:w-10"
                        style={{ background: accent }}
                      />
                      <span>
                        {expanded ? "Δείτε λιγότερα" : "Δείτε περισσότερα"}
                      </span>
                      <span
                        className="font-[var(--f-brutal)] text-base leading-none"
                        style={{ color: accent }}
                      >
                        {expanded ? "−" : `+${hiddenCount}`}
                      </span>
                    </button>
                  </div>
                )}
              </>
            );
          })()
        )}
      </div>
    </section>
  );
};

const PlayerCard: React.FC<{
  player: RosterPlayer;
  index: number;
  accent: string;
  isTopScorer: boolean;
  className?: string;
}> = ({ player, index, accent, isTopScorer, className }) => {
  const rotation = index % 2 === 0 ? "0.3deg" : "-0.3deg";
  const isMvp = player.stats.mvp > 0;
  const isGk = player.stats.best_gk > 0;
  const shadowColor = isTopScorer || isMvp ? "#E8B931" : accent;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.5 }}
      whileHover={{ y: -6 }}
    >
      <div
        className="group relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] shadow-[4px_4px_0_0_var(--s)] sm:shadow-[6px_6px_0_0_var(--s)] sm:[transform:rotate(var(--r))]"
        style={
          {
            ["--s" as any]: shadowColor,
            ["--r" as any]: rotation,
          } as React.CSSProperties
        }
      >
        {/* Portrait */}
        <div
          className="relative aspect-[3/4] overflow-hidden border-b-2 border-[#F3EFE6]/15 bg-[#13131d]"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 20%, ${accent}26 0%, transparent 60%)`,
          }}
        >
          <Image
            src={player.photoUrl}
            alt={player.fullName}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
          />
          {/* Dark gradient for legibility */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 40%, rgba(10,10,20,0.85) 100%)",
            }}
          />
          {/* Position badge */}
          {player.position && (
            <div
              className="absolute top-3 left-3 inline-flex items-center gap-1.5 border-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{
                borderColor: accent,
                background: "#0a0a14",
                color: accent,
              }}
            >
              <FaUser className="h-3 w-3" />
              {player.position}
            </div>
          )}
          {/* Honour pip */}
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            {isTopScorer && (
              <span
                className="border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{
                  borderColor: "#E8B931",
                  background: "rgba(232,185,49,0.18)",
                  color: "#E8B931",
                }}
              >
                ★ ΣΚΟΡΕΡ
              </span>
            )}
            {isMvp && (
              <span
                className="border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{
                  borderColor: "#E8B931",
                  background: "rgba(232,185,49,0.18)",
                  color: "#E8B931",
                }}
              >
                MVP · {player.stats.mvp}
              </span>
            )}
            {isGk && (
              <span
                className="border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{
                  borderColor: "#60a5fa",
                  background: "rgba(96,165,250,0.18)",
                  color: "#60a5fa",
                }}
              >
                GK · {player.stats.best_gk}
              </span>
            )}
          </div>
          {/* Name */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/60">
              {pad2(index + 1)} · ΜΗΤΡΩΟ
            </p>
            <p className="mt-1 font-[var(--f-display)] text-xl font-black italic leading-none text-[#F3EFE6]">
              {player.firstName}
            </p>
            {player.lastName && (
              <p className="mt-0.5 font-[var(--f-display)] text-base italic text-[#F3EFE6]/80">
                {player.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Info chips: age + height — always present for uniform card height */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#F3EFE6]/10 px-3 py-2">
          <span
            className="inline-flex items-center border border-[#F3EFE6]/20 bg-[#13131d] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em]"
            style={{
              color:
                player.age != null
                  ? "rgba(243,239,230,0.75)"
                  : "rgba(243,239,230,0.35)",
            }}
          >
            {player.age != null ? `${player.age} ετών` : "—"}
          </span>
          <span
            className="inline-flex items-center border border-[#F3EFE6]/20 bg-[#13131d] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em]"
            style={{
              color:
                player.heightCm != null
                  ? "rgba(243,239,230,0.75)"
                  : "rgba(243,239,230,0.35)",
            }}
          >
            {player.heightCm != null ? `${player.heightCm} εκ` : "—"}
          </span>
        </div>

        {/* Primary stats row */}
        <div className="grid grid-cols-3 divide-x-2 divide-[#F3EFE6]/10">
          <StatBlock
            label="Αγώνες"
            value={player.stats.matches}
            icon={<FaRunning className="h-3.5 w-3.5" />}
          />
          <StatBlock
            label="Γκολ"
            value={player.stats.goals}
            highlight={player.stats.goals > 0}
            icon={<FaFutbol className="h-3.5 w-3.5" />}
          />
          <StatBlock
            label="Ασίστ"
            value={player.stats.assists}
            icon={<FaHandsHelping className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Honours row — always rendered for uniform card height */}
        <div className="grid grid-cols-2 divide-x-2 divide-[#F3EFE6]/10 border-t-2 border-[#F3EFE6]/10">
          <HonourBlock
            label="MVP"
            value={player.stats.mvp}
            color="#E8B931"
            icon={<FaTrophy className="h-3.5 w-3.5" />}
            active={player.stats.mvp > 0}
          />
          <HonourBlock
            label="Καλύτερος ΤΦ"
            value={player.stats.best_gk}
            color="#60a5fa"
            icon={<FaShieldAlt className="h-3.5 w-3.5" />}
            active={player.stats.best_gk > 0}
          />
        </div>

      </div>
    </motion.div>
  );
};

const StatBlock: React.FC<{
  label: string;
  value: number;
  highlight?: boolean;
  icon?: React.ReactNode;
}> = ({ label, value, highlight, icon }) => (
  <div className="p-3 text-center">
    {icon && (
      <div
        className="mb-1 flex justify-center"
        style={{ color: highlight ? "#fb923c" : "rgba(243,239,230,0.45)" }}
      >
        {icon}
      </div>
    )}
    <div
      className="font-[var(--f-brutal)] text-xl leading-none"
      style={{ color: highlight ? "#fb923c" : "#F3EFE6" }}
    >
      {value}
    </div>
    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
      {label}
    </div>
  </div>
);

const HonourBlock: React.FC<{
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  active: boolean;
}> = ({ label, value, color, icon, active }) => (
  <div
    className="flex items-center justify-center gap-1.5 p-2.5 sm:gap-2"
    style={{
      background: active ? `${color}12` : "transparent",
    }}
  >
    <span style={{ color: active ? color : "rgba(243,239,230,0.35)" }}>
      {icon}
    </span>
    <span
      className="font-[var(--f-brutal)] text-base leading-none"
      style={{ color: active ? color : "rgba(243,239,230,0.35)" }}
    >
      {value}
    </span>
    <span
      className="truncate font-mono text-[9px] uppercase tracking-[0.22em]"
      style={{ color: active ? color : "rgba(243,239,230,0.45)" }}
    >
      {label}
    </span>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Matches — tabs (upcoming / finished)
// ───────────────────────────────────────────────────────────────────────
type TabKey = "upcoming" | "finished" | "all";

const MatchesSection: React.FC<{
  matches: Match[];
  teamId: number;
}> = ({ matches, teamId }) => {
  const [tab, setTab] = useState<TabKey>("upcoming");

  const { upcoming, finished } = useMemo(() => {
    const up: Match[] = [];
    const fi: Match[] = [];
    matches.forEach((m) => {
      const hasScores =
        typeof m.team_a_score === "number" &&
        typeof m.team_b_score === "number";
      if (m.status === "finished" || hasScores) fi.push(m);
      else up.push(m);
    });
    up.sort(
      (a, b) =>
        new Date(a.match_date ?? 0).getTime() -
        new Date(b.match_date ?? 0).getTime()
    );
    fi.sort(
      (a, b) =>
        new Date(b.match_date ?? 0).getTime() -
        new Date(a.match_date ?? 0).getTime()
    );
    return { upcoming: up, finished: fi };
  }, [matches]);

  const summary = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    finished.forEach((m) => {
      const isA = m.team_a?.id === teamId;
      const my = isA ? m.team_a_score : m.team_b_score;
      const opp = isA ? m.team_b_score : m.team_a_score;
      if (typeof my === "number" && typeof opp === "number") {
        goalsFor += my;
        goalsAgainst += opp;
        if (my > opp) wins += 1;
        else if (my < opp) losses += 1;
        else draws += 1;
      }
    });
    return { wins, draws, losses, goalsFor, goalsAgainst };
  }, [finished, teamId]);

  const list = tab === "upcoming" ? upcoming : tab === "finished" ? finished : [...upcoming, ...finished];

  return (
    <section className="relative border-b-2 border-[#F3EFE6]/20">
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6 md:py-16">
        <Rubric
          kicker="Ιστορικό"
          title="Αγώνες"
          meta={`${pad2(finished.length + upcoming.length)} συνολικά`}
        />

        {/* summary strip */}
        {finished.length > 0 && (
          <div className="mb-6 grid grid-cols-5 border-2 border-[#F3EFE6]/15 bg-[#13131d]">
            <SummaryCell label="Νίκες" v={summary.wins} accent="#fb923c" />
            <SummaryCell label="Ισόπαλα" v={summary.draws} />
            <SummaryCell label="Ήττες" v={summary.losses} accent="#ef4444" />
            <SummaryCell label="Υπέρ" v={summary.goalsFor} />
            <SummaryCell label="Κατά" v={summary.goalsAgainst} last />
          </div>
        )}

        {/* tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { k: "upcoming" as TabKey, label: "Προσεχείς", c: upcoming.length },
            {
              k: "finished" as TabKey,
              label: "Τελειωμένοι",
              c: finished.length,
            },
          ].map((t) => {
            const active = tab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`flex items-center gap-2 border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-all ${
                  active
                    ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                    : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`font-[var(--f-brutal)] text-xs ${
                    active ? "text-[#0a0a14]" : "text-[#F3EFE6]"
                  }`}
                >
                  {pad2(t.c)}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {list.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50"
            >
              {tab === "upcoming"
                ? "Δεν υπάρχουν προγραμματισμένοι αγώνες"
                : "Δεν υπάρχουν τελειωμένοι αγώνες"}
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y-2 divide-[#F3EFE6]/10 border-2 border-[#F3EFE6]/20 bg-[#0a0a14]"
            >
              {list.map((m, i) => (
                <MatchRow key={m.id} m={m} teamId={teamId} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

const SummaryCell: React.FC<{
  label: string;
  v: number;
  accent?: string;
  last?: boolean;
}> = ({ label, v, accent = "#F3EFE6", last }) => (
  <div
    className={`p-2.5 text-center sm:p-4 ${
      !last ? "border-r-2 border-[#F3EFE6]/15" : ""
    }`}
  >
    <div
      className="font-[var(--f-brutal)] text-xl leading-none sm:text-2xl"
      style={{ color: accent }}
    >
      {v}
    </div>
    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
      {label}
    </div>
  </div>
);

const MatchRow: React.FC<{ m: Match; teamId: number; index: number }> = ({
  m,
  teamId,
  index,
}) => {
  const isA = m.team_a?.id === teamId;
  const mine = isA ? m.team_a : m.team_b;
  const opp = isA ? m.team_b : m.team_a;
  const myScore = isA ? m.team_a_score : m.team_b_score;
  const oppScore = isA ? m.team_b_score : m.team_a_score;
  const finished =
    m.status === "finished" ||
    (typeof m.team_a_score === "number" &&
      typeof m.team_b_score === "number");
  const outcome =
    finished && typeof myScore === "number" && typeof oppScore === "number"
      ? myScore > oppScore
        ? "W"
        : myScore < oppScore
        ? "L"
        : "D"
      : null;

  const outcomeColor =
    outcome === "W"
      ? "#fb923c"
      : outcome === "L"
      ? "#ef4444"
      : outcome === "D"
      ? "#E8B931"
      : "#F3EFE6";
  const outcomeLabel =
    outcome === "W" ? "ΝΙΚΗ" : outcome === "L" ? "ΗΤΤΑ" : outcome === "D" ? "ΙΣΟΠΑΛΟ" : null;

  const datePill = (
    <div
      className="inline-flex flex-col items-center border-2 px-3 py-1.5"
      style={{
        borderColor: outcome ? outcomeColor : "rgba(243,239,230,0.3)",
        color: outcome ? outcomeColor : "#F3EFE6",
      }}
    >
      <span className="font-[var(--f-brutal)] text-xl leading-none">
        {wallClockDate(m.match_date)?.getDate() ?? "—"}
      </span>
      <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
        {wallClockDate(m.match_date)?.toLocaleDateString("el-GR", {
          month: "short",
        }) ?? ""}
      </span>
    </div>
  );

  const outcomeBadge = outcomeLabel && (
    <span
      className="border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
      style={{
        borderColor: outcomeColor,
        color: outcomeColor,
      }}
    >
      {outcomeLabel}
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="group p-4 transition-colors hover:bg-[#13131d] sm:grid sm:grid-cols-12 sm:items-center sm:gap-3"
    >
      {/* Mobile-only top row: date + outcome */}
      <div className="mb-3 flex items-center justify-between gap-2 sm:hidden">
        {datePill}
        {outcomeBadge}
      </div>

      {/* Desktop date */}
      <div className="hidden sm:col-span-2 sm:block">{datePill}</div>

      {/* Teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:col-span-7 sm:gap-3">
        <div className="flex items-center justify-end gap-2 text-right min-w-0">
          <span
            className="truncate font-[var(--f-display)] text-sm font-semibold italic text-[#F3EFE6] sm:text-base"
            style={{ opacity: outcome === "L" ? 0.55 : 1 }}
          >
            {mine?.name ?? "—"}
          </span>
          {mine?.logo && (
            <img
              src={mine.logo}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover sm:h-7 sm:w-7"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/team-placeholder.svg";
              }}
            />
          )}
        </div>

        <div className="shrink-0">
          {finished ? (
            <div className="flex items-center gap-1 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-2 py-1 font-[var(--f-brutal)] text-base leading-none tabular-nums sm:text-lg">
              <span
                style={{
                  color:
                    outcome === "W"
                      ? outcomeColor
                      : outcome === "L"
                      ? `${outcomeColor}AA`
                      : "#F3EFE6",
                }}
              >
                {myScore ?? 0}
              </span>
              <span className="text-[#F3EFE6]/30">:</span>
              <span
                style={{
                  color:
                    outcome === "L"
                      ? outcomeColor
                      : outcome === "W"
                      ? "#F3EFE6AA"
                      : "#F3EFE6",
                }}
              >
                {oppScore ?? 0}
              </span>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
              {m.match_date ? elTime(m.match_date) : "ΤΒΑ"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {opp?.logo && (
            <img
              src={opp.logo}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover sm:h-7 sm:w-7"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/team-placeholder.svg";
              }}
            />
          )}
          <span
            className="truncate font-[var(--f-display)] text-sm font-semibold italic text-[#F3EFE6] sm:text-base"
            style={{ opacity: outcome === "W" ? 0.55 : 1 }}
          >
            {opp?.name ?? "ΤΒΑ"}
          </span>
        </div>
      </div>

      {/* Outcome (desktop) + tournament link */}
      <div className="mt-2 flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.22em] sm:col-span-3 sm:mt-0">
        {outcomeLabel && (
          <span
            className="hidden border px-2 py-0.5 font-bold sm:inline"
            style={{
              borderColor: outcomeColor,
              color: outcomeColor,
            }}
          >
            {outcomeLabel}
          </span>
        )}
        {m.tournament?.name && (
          <Link
            href={`/tournaments/${m.tournament.id}`}
            className="truncate text-[#F3EFE6]/55 hover:text-[#fb923c] transition-colors max-w-[160px]"
            title={m.tournament.name}
          >
            {m.tournament.name}
          </Link>
        )}
      </div>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Colophon
// ───────────────────────────────────────────────────────────────────────
const Colophon: React.FC<{ team: Team }> = ({ team }) => (
  <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
    <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-4 py-6 md:flex-row md:items-center md:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
        {team.name ?? "Ομάδα"} · Κωδικός {pad2(team.id)}
      </p>
      <Link
        href="/OMADES"
        className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] hover:bg-[#F3EFE6] hover:text-[#0a0a14] transition-colors"
      >
        ← Όλες οι Ομάδες
      </Link>
    </div>
  </footer>
);

// ───────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────
const TeamClient: React.FC<Props> = ({
  team,
  teamId,
  tournaments,
  wins,
  playerAssociations,
  seasonStatsByPlayer,
  matches,
}) => {
  const accent = useMemo(() => {
    const c = team.colour;
    if (c && /^#[0-9A-Fa-f]{6}$/.test(c)) return c;
    return "#fb923c";
  }, [team.colour]);

  const winIds = useMemo(() => new Set(wins.map((w) => w.id)), [wins]);

  const rosterPlayers = useMemo<RosterPlayer[]>(() => {
    return playerAssociations.map((assoc) => {
      const p = assoc.player;
      const stats = p.player_statistics?.[0] ?? null;
      const agg = seasonStatsByPlayer[p.id] ?? {
        matches: 0,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
        mvp: 0,
        best_gk: 0,
      };
      const firstName = p.first_name ?? "";
      const lastName = p.last_name ?? "";
      const fullName = `${firstName} ${lastName}`.trim() || "Άγνωστος";
      return {
        id: p.id,
        firstName: firstName || fullName,
        lastName,
        fullName,
        position: p.position,
        age: (stats?.age as number | null) ?? null,
        heightCm: p.height_cm,
        photoUrl: resolvePlayerPhotoUrl(p.photo),
        stats: agg,
      };
    });
  }, [playerAssociations, seasonStatsByPlayer]);

  const totals = {
    players: rosterPlayers.length,
    tournaments: tournaments.length,
    titles: wins.length,
  };

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} min-h-screen overflow-x-hidden text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />

      <PageHeader team={team} />

      <Masthead team={team} accent={accent} wins={wins} totals={totals} />

      <HonoursSection wins={wins} />

      <RosterSection players={rosterPlayers} accent={accent} />

      <ParticipationsSection tournaments={tournaments} winIds={winIds} />

      {matches && matches.length > 0 && (
        <MatchesSection matches={matches} teamId={teamId} />
      )}

      <Colophon team={team} />
    </div>
  );
};

export default TeamClient;
