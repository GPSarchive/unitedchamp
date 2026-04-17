"use client";

/**
 * Matches explorer — editorial sports-broadsheet × kinetic brutalism.
 * Dark palette: near-black ground, ivory ink, orange signal, saffron honours.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fraunces,
  Archivo_Black,
  JetBrains_Mono,
  Figtree,
} from "next/font/google";
import { supabase } from "@/app/lib/supabase/supabaseClient";

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
// Types
// ───────────────────────────────────────────────────────────────────────
type TeamLite = { name: string | null; logo: string | null };
type TournamentLite = { id: number; name: string | null; logo: string | null };

type MatchRow = {
  id: number;
  match_date: string | null;
  status: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  teamA: TeamLite[] | TeamLite | null;
  teamB: TeamLite[] | TeamLite | null;
  tournament: TournamentLite[] | TournamentLite | null;
  matchday: number | null;
  round: number | null;
};

export type TournamentOption = {
  id: number;
  name: string;
};

type TabKey = "upcoming" | "finished";

// ───────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────
const pad2 = (n: number | string) => String(n).padStart(2, "0");

const one = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? v[0] ?? null : v;

const elDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "short",
      })
    : "";

const elDay = (iso?: string | null) =>
  iso ? String(new Date(iso).getDate()) : "—";

const elMonthShort = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", { month: "short" })
    : "";

const elTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

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
        <pattern id="mgrid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mgrid)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Page header
// ───────────────────────────────────────────────────────────────────────
const PageHeader: React.FC<{ total: number; tab: TabKey }> = ({
  total,
  tab,
}) => (
  <header className="relative border-b-2 border-[#F3EFE6]/20">
    <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-6 md:pt-10 md:pb-8">
      <nav className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span>/</span>
        <span className="text-[#F3EFE6]">Αγώνες</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            <span className="h-[2px] w-8 bg-[#fb923c]" />
            {tab === "upcoming" ? "Πρόγραμμα" : "Ιστορικό"}
          </div>
          <h1
            className="mt-2 font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
            style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
          >
            Οι Αγώνες
          </h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
          <span
            className={`inline-flex items-center gap-2 border px-2.5 py-1 ${
              tab === "upcoming"
                ? "border-[#fb923c]/60 bg-[#fb923c]/10 text-[#fb923c]"
                : "border-[#E8B931]/60 bg-[#E8B931]/10 text-[#E8B931]"
            }`}
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{
                background: tab === "upcoming" ? "#fb923c" : "#E8B931",
              }}
            />
            {tab === "upcoming" ? "Προσεχείς" : "Τελειωμένοι"}
          </span>
          <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1">
            Σύνολο · {pad2(total)}
          </span>
        </div>
      </div>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────
type Props = {
  tournaments: TournamentOption[];
};

const PAGE_SIZE = 12;

export default function MatchesExplorer({ tournaments }: Props) {
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentISO = useMemo(() => new Date().toISOString(), []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [tab, tournamentId]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        let q = supabase
          .from("matches")
          .select(
            `id, match_date, status, team_a_score, team_b_score,
             matchday, round,
             teamA:teams!matches_team_a_id_fkey (name, logo),
             teamB:teams!matches_team_b_id_fkey (name, logo),
             tournament:tournament_id (id, name, logo)`,
            { count: "exact" }
          );

        if (tournamentId != null) {
          q = q.eq("tournament_id", tournamentId);
        }

        const isUpcoming = tab === "upcoming";
        q = isUpcoming
          ? q.gte("match_date", currentISO)
          : q.lt("match_date", currentISO);

        q = q.order("match_date", { ascending: isUpcoming });

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        q = q.range(from, to);

        const { data, error: qErr, count } = await q;
        if (qErr) throw qErr;
        setRows((data as MatchRow[]) ?? []);
        setTotal(count ?? 0);
      } catch (e: any) {
        setError(e?.message ?? "Αποτυχία φόρτωσης αγώνων");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [tab, tournamentId, page, currentISO]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />

      <PageHeader total={total} tab={tab} />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 py-10 md:py-14">
          {/* Controls */}
          <Controls
            tab={tab}
            setTab={setTab}
            tournaments={tournaments}
            tournamentId={tournamentId}
            setTournamentId={setTournamentId}
          />

          {/* Result meta */}
          <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
            <span>
              {pad2(Math.min(total, PAGE_SIZE))} / {pad2(total)} αγώνες
              {tournamentId != null && tournaments.length > 0 && (
                <>
                  {" · "}
                  <span className="text-[#F3EFE6]/75">
                    {tournaments.find((t) => t.id === tournamentId)?.name ??
                      "—"}
                  </span>
                </>
              )}
            </span>
            {tournamentId != null && (
              <button
                onClick={() => setTournamentId(null)}
                className="text-[#F3EFE6]/60 hover:text-[#fb923c] transition-colors"
              >
                Καθαρισμός ×
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <StateBlock
              kicker="Σφάλμα"
              title="Η φόρτωση απέτυχε"
              body={error}
            />
          ) : rows.length === 0 ? (
            <StateBlock
              kicker={tab === "upcoming" ? "Πρόγραμμα" : "Αρχείο"}
              title={
                tab === "upcoming"
                  ? "Δεν υπάρχουν προσεχείς αγώνες"
                  : "Δεν υπάρχουν τελειωμένοι αγώνες"
              }
              body={
                tournamentId != null
                  ? "Δοκιμάστε άλλο τουρνουά ή καθαρίστε το φίλτρο."
                  : "Αναμείνατε — το χρονικό θα ενημερωθεί σύντομα."
              }
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${tab}-${tournamentId ?? "all"}-${page}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="divide-y-2 divide-[#F3EFE6]/10 border-2 border-[#F3EFE6]/20 bg-[#0a0a14]"
              >
                {rows.map((m, i) => (
                  <MatchRowView key={m.id} m={m} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Pagination */}
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </div>
      </section>

      <Colophon total={total} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Controls
// ───────────────────────────────────────────────────────────────────────
const Controls: React.FC<{
  tab: TabKey;
  setTab: (t: TabKey) => void;
  tournaments: TournamentOption[];
  tournamentId: number | null;
  setTournamentId: (v: number | null) => void;
}> = ({ tab, setTab, tournaments, tournamentId, setTournamentId }) => {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: "upcoming" as TabKey, label: "Προσεχείς" },
          { k: "finished" as TabKey, label: "Τελειωμένοι" },
        ].map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-all ${
                active
                  ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                  : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tournament select */}
      <label className="relative flex items-center">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
          ΔΙΟΡΓ·
        </span>
        <select
          value={tournamentId ?? ""}
          onChange={(e) =>
            setTournamentId(e.target.value ? Number(e.target.value) : null)
          }
          className="appearance-none border-2 border-[#F3EFE6]/20 bg-[#13131d] pl-20 pr-10 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors min-w-[260px]"
        >
          <option value="">Όλα τα τουρνουά</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#F3EFE6]/55">
          ▾
        </span>
      </label>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Match row
// ───────────────────────────────────────────────────────────────────────
const MatchRowView: React.FC<{ m: MatchRow; index: number }> = ({
  m,
  index,
}) => {
  const A = one(m.teamA);
  const B = one(m.teamB);
  const tournament = one(m.tournament);
  const aScore = typeof m.team_a_score === "number" ? m.team_a_score : null;
  const bScore = typeof m.team_b_score === "number" ? m.team_b_score : null;
  const finished =
    m.status === "finished" || (aScore !== null && bScore !== null);
  const postponed = m.status === "postponed";

  let outcomeColor = "#F3EFE6";
  let outcomeLabel: string | null = null;
  if (finished && aScore !== null && bScore !== null) {
    if (aScore > bScore) {
      outcomeColor = "#fb923c";
      outcomeLabel = "ΝΙΚΗ Α";
    } else if (bScore > aScore) {
      outcomeColor = "#fb923c";
      outcomeLabel = "ΝΙΚΗ Β";
    } else {
      outcomeColor = "#E8B931";
      outcomeLabel = "ΙΣΟΠΑΛΟ";
    }
  } else if (postponed) {
    outcomeColor = "#a855f7";
    outcomeLabel = "ΑΝΑΒΟΛΗ";
  }

  const matchdayLabel = m.round
    ? `Γύρος ${m.round}`
    : m.matchday
    ? `Αγωνιστική ${m.matchday}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.3) }}
      className="relative"
    >
      <Link
        href={`/matches/${m.id}`}
        className="group block transition-colors hover:bg-[#13131d]/80"
      >
        <div className="grid grid-cols-12 items-center gap-3 px-4 py-4 md:px-5">
          {/* Date block */}
          <div className="col-span-3 sm:col-span-2">
            <div
              className="inline-flex flex-col items-center border-2 px-3 py-1.5"
              style={{
                borderColor: outcomeLabel
                  ? outcomeColor
                  : "rgba(243,239,230,0.3)",
                color: outcomeLabel ? outcomeColor : "#F3EFE6",
              }}
            >
              <span className="font-[var(--f-brutal)] text-xl leading-none">
                {elDay(m.match_date)}
              </span>
              <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
                {elMonthShort(m.match_date)}
              </span>
            </div>
          </div>

          {/* Teams + score */}
          <div className="col-span-9 sm:col-span-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-2 text-right min-w-0">
              <span className="truncate font-[var(--f-display)] text-sm sm:text-base font-semibold italic text-[#F3EFE6]">
                {A?.name ?? "Ομάδα Α"}
              </span>
              {A?.logo && (
                <img
                  src={A.logo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/team-placeholder.svg";
                  }}
                />
              )}
            </div>

            <div className="shrink-0">
              {finished ? (
                <div className="flex items-center gap-1 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1 font-[var(--f-brutal)] text-lg leading-none tabular-nums text-[#F3EFE6]">
                  <span>{aScore ?? 0}</span>
                  <span className="text-[#F3EFE6]/30">:</span>
                  <span>{bScore ?? 0}</span>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
                  {m.match_date ? elTime(m.match_date) : "ΤΒΑ"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0">
              {B?.logo && (
                <img
                  src={B.logo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/team-placeholder.svg";
                  }}
                />
              )}
              <span className="truncate font-[var(--f-display)] text-sm sm:text-base font-semibold italic text-[#F3EFE6]">
                {B?.name ?? "Ομάδα Β"}
              </span>
            </div>
          </div>

          {/* Outcome + meta */}
          <div className="col-span-12 sm:col-span-3 flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
            {outcomeLabel && (
              <span
                className="border px-2 py-0.5 font-bold"
                style={{
                  borderColor: outcomeColor,
                  color: outcomeColor,
                }}
              >
                {outcomeLabel}
              </span>
            )}
            {tournament?.name && (
              <span
                className="truncate max-w-[160px] text-[#F3EFE6]/55 group-hover:text-[#fb923c] transition-colors"
                title={tournament.name}
              >
                {tournament.name}
              </span>
            )}
            <span className="font-mono text-[11px] text-[#F3EFE6]/40 group-hover:text-[#fb923c] transition-colors">
              →
            </span>
          </div>

          {/* Date line (mobile) */}
          <div className="col-span-12 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/45 sm:hidden">
            <span>{elDate(m.match_date)}</span>
            {matchdayLabel && <span>{matchdayLabel}</span>}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Loading skeleton
// ───────────────────────────────────────────────────────────────────────
const ListSkeleton: React.FC = () => (
  <div className="divide-y-2 divide-[#F3EFE6]/10 border-2 border-[#F3EFE6]/15 bg-[#0a0a14]">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="grid grid-cols-12 items-center gap-3 px-5 py-5">
        <div className="col-span-2 h-11 w-14 animate-pulse bg-[#F3EFE6]/10" />
        <div className="col-span-7 flex items-center gap-3">
          <div className="h-4 flex-1 animate-pulse bg-[#F3EFE6]/10" />
          <div className="h-6 w-14 animate-pulse bg-[#F3EFE6]/10" />
          <div className="h-4 flex-1 animate-pulse bg-[#F3EFE6]/10" />
        </div>
        <div className="col-span-3 h-4 animate-pulse bg-[#F3EFE6]/10" />
      </div>
    ))}
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Empty/error block
// ───────────────────────────────────────────────────────────────────────
const StateBlock: React.FC<{
  kicker: string;
  title: string;
  body: string;
}> = ({ kicker, title, body }) => (
  <div
    className="relative border-2 border-dashed border-[#F3EFE6]/25 p-12 text-center"
    style={{ background: "rgba(19,19,29,0.4)" }}
  >
    <div className="mx-auto max-w-md">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
        / 00 · {kicker}
      </span>
      <p className="mt-4 font-[var(--f-display)] text-3xl font-black italic leading-tight text-[#F3EFE6]">
        {title}
      </p>
      <p className="mt-3 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
        {body}
      </p>
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Pagination
// ───────────────────────────────────────────────────────────────────────
const PaginationBar: React.FC<{
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}> = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

  const window = 2;
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= page - window && p <= page + window)
    ) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <nav className="mt-8 flex items-center justify-between gap-3 border-t-2 border-[#F3EFE6]/15 pt-5">
      <button
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className={`border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          page <= 1
            ? "border-[#F3EFE6]/10 text-[#F3EFE6]/25 cursor-not-allowed"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c]"
        }`}
      >
        ← Προηγ.
      </button>

      <ul className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === "…" ? (
            <li
              key={`dot-${i}`}
              className="font-mono text-[10px] tracking-[0.2em] text-[#F3EFE6]/35"
            >
              …
            </li>
          ) : (
            <li key={p}>
              <button
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tabular-nums transition-colors ${
                  p === page
                    ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                    : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
                }`}
              >
                {pad2(p)}
              </button>
            </li>
          )
        )}
      </ul>

      <button
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className={`border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          page >= totalPages
            ? "border-[#F3EFE6]/10 text-[#F3EFE6]/25 cursor-not-allowed"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c]"
        }`}
      >
        Επόμ. →
      </button>
    </nav>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Colophon
// ───────────────────────────────────────────────────────────────────────
const Colophon: React.FC<{ total: number }> = ({ total }) => (
  <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
    <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-6 py-6 md:flex-row md:items-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
        Σύνολο αγώνων · {pad2(total)}
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
