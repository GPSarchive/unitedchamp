"use client";

/**
 * Tournaments catalog — editorial sports-broadsheet × kinetic brutalism.
 * Dark palette: near-black ground, ivory ink, orange signal, saffron honours.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";
import type { Tournament } from "@/app/tournaments/useTournamentData";

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
// Props & types
// ───────────────────────────────────────────────────────────────────────
type Props = {
  initialTournaments: Tournament[];
};

type StatusFilter = "all" | "running" | "completed" | "scheduled" | "archived";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Όλα" },
  { value: "running", label: "Ζωντανά" },
  { value: "completed", label: "Έληξαν" },
  { value: "scheduled", label: "Προγραμματισμένα" },
  { value: "archived", label: "Αρχείο" },
];

// ───────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────
const pad2 = (n: number | string) => String(n).padStart(2, "0");

function statusLabel(status: Tournament["status"]): string {
  if (status === "running") return "Ζωντανά";
  if (status === "completed") return "Έληξε";
  if (status === "archived") return "Αρχείο";
  return "Προγραμματισμένο";
}

// ───────────────────────────────────────────────────────────────────────
// Atmosphere background
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
    {/* orange signal halo top-left */}
    <div
      className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
      }}
    />
    {/* red-purple glow bottom-right */}
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
        <pattern id="tgrid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tgrid)" />
    </svg>
    {/* grain */}
    <svg
      className="absolute inset-0 h-full w-full mix-blend-screen opacity-[0.08]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="tnoise">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#tnoise)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Compact page header
// ───────────────────────────────────────────────────────────────────────
const PageHeader: React.FC<{ total: number; running: number }> = ({
  total,
  running,
}) => (
  <header className="relative border-b-2 border-[#F3EFE6]/20">
    <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-6 md:pt-10 md:pb-8">
      {/* breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span>/</span>
        <span className="text-[#F3EFE6]">Τουρνουά</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            <span className="h-[2px] w-8 bg-[#fb923c]" />
            Κατάλογος
          </div>
          <h1
            className="mt-2 font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
            style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
          >
            Τα Τουρνουά
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70"
        >
          {running > 0 && (
            <span className="inline-flex items-center gap-2 border border-[#fb923c]/60 bg-[#fb923c]/10 px-2.5 py-1 text-[#fb923c]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fb923c]" />
              {pad2(running)} Ζωντανά
            </span>
          )}
          <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1">
            Σύνολο · {pad2(total)}
          </span>
        </motion.div>
      </div>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Controls — search + status pills
// ───────────────────────────────────────────────────────────────────────
const Controls: React.FC<{
  search: string;
  setSearch: (s: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}> = ({ search, setSearch, statusFilter, setStatusFilter, counts }) => {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* search */}
      <div className="relative w-full max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
          AΝΑΖ·
        </span>
        <input
          type="text"
          placeholder="Αναζήτηση διοργάνωσης..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border-2 border-[#F3EFE6]/20 bg-[#0a0a14] pl-16 pr-4 py-3 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
        />
      </div>
      {/* filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          const c = counts[f.value];
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`group flex items-center gap-2 border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-all ${
                active
                  ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                  : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`font-[var(--f-brutal)] text-xs ${
                  active ? "text-[#0a0a14]" : "text-[#F3EFE6]"
                }`}
              >
                {pad2(c)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Tournament card
// ───────────────────────────────────────────────────────────────────────
const TournamentCard: React.FC<{ t: Tournament; index: number }> = ({
  t,
  index,
}) => {
  const isRunning = t.status === "running";
  const isCompleted = t.status === "completed";
  const isArchived = t.status === "archived";

  const accent = isRunning ? "#fb923c" : isCompleted ? "#E8B931" : "#60a5fa";
  const rotation = index % 2 === 0 ? "0.4deg" : "-0.4deg";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.4) }}
      className="h-full"
    >
      <Link
        href={`/tournaments/${t.id}`}
        aria-label={`Άνοιγμα ${t.name}`}
        className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fb923c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a14]"
      >
        <div
          className="relative flex h-full flex-col overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] transition-all duration-300 group-hover:border-[#F3EFE6]/40 group-hover:-translate-y-1"
          style={{
            transform: `rotate(${rotation})`,
            boxShadow: `6px 6px 0 0 ${accent}`,
          }}
        >
          {/* hover spotlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(400px 200px at 100% 0%, ${accent}22 0%, transparent 60%)`,
            }}
          />

          {/* header strip */}
          <div
            className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]"
          >
            <span
              className="flex items-center gap-1.5 font-bold"
              style={{ color: accent }}
            >
              {isRunning && (
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: accent }}
                />
              )}
              {statusLabel(t.status)}
            </span>
            <span className="text-[#F3EFE6]/60">
              N°{pad2(t.id)}
            </span>
          </div>

          {/* body */}
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start gap-4">
              {t.logo ? (
                <img
                  src={t.logo}
                  alt={`${t.name} logo`}
                  className="h-14 w-14 shrink-0 rounded-full border-2 object-cover"
                  style={{ borderColor: accent }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/team-placeholder.svg";
                  }}
                />
              ) : (
                <div
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 bg-[#13131d]"
                  style={{ borderColor: accent }}
                >
                  <span
                    className="font-[var(--f-brutal)] text-xl"
                    style={{ color: accent }}
                  >
                    {String(t.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-[var(--f-display)] text-xl md:text-2xl font-black italic leading-tight text-[#F3EFE6] line-clamp-2">
                  {t.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]">
                  {t.season && (
                    <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-1.5 py-0.5 text-[#F3EFE6]/75">
                      Σεζόν {t.season}
                    </span>
                  )}
                  {t.format && (
                    <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-1.5 py-0.5 text-[#F3EFE6]/75">
                      {t.format}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* champion row */}
            {isCompleted && t.winner_team_name && (
              <div
                className="mt-4 flex items-center gap-2 border-2 px-3 py-2"
                style={{
                  borderColor: "#E8B931",
                  background: "rgba(232,185,49,0.08)",
                }}
              >
                <span className="font-[var(--f-brutal)] text-sm text-[#E8B931]">
                  ★
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E8B931]">
                  Πρωταθλητής
                </span>
                <span className="flex-1 truncate font-[var(--f-display)] text-sm italic font-semibold text-[#F3EFE6]">
                  {t.winner_team_name}
                </span>
              </div>
            )}

            {/* counts + CTA */}
            <div className="mt-auto flex items-end justify-between pt-5">
              <div className="grid grid-cols-2 gap-3">
                <CountBlock
                  value={String(t.teams_count ?? "—")}
                  label="Ομάδες"
                />
                <CountBlock
                  value={String(t.matches_count ?? "—")}
                  label="Αγώνες"
                />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60 group-hover:text-[#fb923c] transition-colors">
                Προβολή →
              </span>
            </div>
          </div>

          {/* bottom strip — tournament id */}
          <div
            className="flex items-center justify-between border-t px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.28em]"
            style={{
              borderColor: "rgba(243,239,230,0.1)",
              color: "rgba(243,239,230,0.4)",
            }}
          >
            <span>UC · {pad2(t.id)}</span>
            {isArchived && <span>ΑΡΧΕΙΟ</span>}
            {!isArchived && t.status && (
              <span
                className="inline-block h-[6px] w-[6px] rounded-full"
                style={{ background: accent, opacity: 0.8 }}
              />
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const CountBlock: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => (
  <div>
    <div className="font-[var(--f-brutal)] text-2xl leading-none text-[#F3EFE6]">
      {value}
    </div>
    <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/50">
      {label}
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Empty state
// ───────────────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ hasAny: boolean }> = ({ hasAny }) => (
  <div
    className="relative border-2 border-dashed border-[#F3EFE6]/25 p-12 text-center"
    style={{ background: "rgba(19,19,29,0.4)" }}
  >
    <div className="mx-auto max-w-md">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
        / {pad2(0)} ·{" "}
        {hasAny ? "Φίλτρα" : "Κατάλογος"}
      </span>
      <p className="mt-4 font-[var(--f-display)] text-3xl font-black italic leading-tight text-[#F3EFE6]">
        {hasAny ? "Κανένα αποτέλεσμα" : "Δεν υπάρχουν τουρνουά"}
      </p>
      <p className="mt-3 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
        {hasAny
          ? "Δοκιμάστε άλλα κριτήρια ή καθαρίστε τα φίλτρα."
          : "Αναμείνατε — το πρώτο τουρνουά έρχεται σύντομα."}
      </p>
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Footer colophon
// ───────────────────────────────────────────────────────────────────────
const Colophon: React.FC<{ total: number }> = ({ total }) => (
  <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
    <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-6 py-6 md:flex-row md:items-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
        Σύνολο τουρνουά · {pad2(total)}
      </p>
      <Link
        href="/"
        className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] hover:bg-[#F3EFE6] hover:text-[#0a0a14] transition-colors"
      >
        ← Επιστροφή στην Αρχική
      </Link>
    </div>
  </footer>
);

// ───────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────
const TournamentsClient: React.FC<Props> = ({ initialTournaments }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: initialTournaments.length,
      running: 0,
      completed: 0,
      scheduled: 0,
      archived: 0,
    };
    initialTournaments.forEach((t) => {
      if (t.status === "running") base.running += 1;
      else if (t.status === "completed") base.completed += 1;
      else if (t.status === "scheduled") base.scheduled += 1;
      else if (t.status === "archived") base.archived += 1;
    });
    return base;
  }, [initialTournaments]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return initialTournaments.filter((t) => {
      const matchesSearch =
        !s ||
        t.name.toLowerCase().includes(s) ||
        (t.season ?? "").toLowerCase().includes(s) ||
        (t.winner_team_name ?? "").toLowerCase().includes(s);
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [initialTournaments, search, statusFilter]);

  const sortedFiltered = useMemo(() => {
    // Running first, then scheduled, then completed, then archived
    const rank: Record<string, number> = {
      running: 0,
      scheduled: 1,
      completed: 2,
      archived: 3,
    };
    return [...filtered].sort(
      (a, b) =>
        (rank[a.status ?? ""] ?? 9) - (rank[b.status ?? ""] ?? 9) ||
        b.id - a.id
    );
  }, [filtered]);

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />

      <PageHeader
        total={initialTournaments.length}
        running={counts.running}
      />

      {/* Catalog body */}
      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 py-10 md:py-14">
          <Controls
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            counts={counts}
          />

          <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/50">
            <span>
              {pad2(sortedFiltered.length)} / {pad2(initialTournaments.length)}{" "}
              τουρνουά
            </span>
            {(search || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="text-[#F3EFE6]/60 hover:text-[#fb923c] transition-colors"
              >
                Καθαρισμός ×
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {sortedFiltered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState hasAny={initialTournaments.length > 0} />
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {sortedFiltered.map((t, i) => (
                  <TournamentCard key={t.id} t={t} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <Colophon total={initialTournaments.length} />
    </div>
  );
};

export default TournamentsClient;
