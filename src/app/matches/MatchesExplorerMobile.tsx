"use client";

/**
 * Matches explorer — mobile shell.
 * Thumb-first, section-stacked, sticky rail.
 * Editorial brutalism × pocket edition.
 */

import React, { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
} from "framer-motion";

// ───────────────────────────────────────────────────────────────────────
// Types (local mirror — kept minimal for props)
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

export type TournamentOption = { id: number; name: string };
export type TabKey = "upcoming" | "finished";

// ───────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────
const pad2 = (n: number | string) => String(n).padStart(2, "0");

const one = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? v[0] ?? null : v;

const elDay = (iso?: string | null) =>
  iso ? String(new Date(iso).getDate()) : "—";

const elMonthShort = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", { month: "short" })
    : "";

const elWeekday = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", { weekday: "short" })
    : "";

const elTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

// ───────────────────────────────────────────────────────────────────────
// Props
// ───────────────────────────────────────────────────────────────────────
type Props = {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  tournaments: TournamentOption[];
  tournamentId: number | null;
  setTournamentId: (v: number | null) => void;
  rows: MatchRow[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  pageSize: number;
};

// ───────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────
export default function MatchesExplorerMobile({
  tab,
  setTab,
  tournaments,
  tournamentId,
  setTournamentId,
  rows,
  total,
  loading,
  error,
  page,
  setPage,
  totalPages,
  pageSize,
}: Props) {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const selectedTournament =
    tournamentId != null
      ? tournaments.find((t) => t.id === tournamentId) ?? null
      : null;

  return (
    <div className="relative">
      <ScrollProgress />

      <TopStrip tab={tab} total={total} />

      <Masthead tab={tab} />

      <FiltersRail
        tab={tab}
        setTab={setTab}
        selectedTournament={selectedTournament}
        onOpenSheet={() => setSheetOpen(true)}
        onClearTournament={() => setTournamentId(null)}
      />

      <section className="px-4 pt-4 pb-10">
        <MetaLine
          shown={Math.min(total, pageSize)}
          total={total}
          tournamentName={selectedTournament?.name ?? null}
          onClear={
            selectedTournament ? () => setTournamentId(null) : undefined
          }
        />

        {loading ? (
          <Skeleton />
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
            <motion.ul
              key={`${tab}-${tournamentId ?? "all"}-${page}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3"
            >
              {rows.map((m, i) => (
                <li key={m.id}>
                  <MatchCard m={m} index={i} />
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      <Colophon total={total} />

      <TournamentSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tournaments={tournaments}
        selected={tournamentId}
        onSelect={(id) => {
          setTournamentId(id);
          setSheetOpen(false);
        }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Scroll progress
// ───────────────────────────────────────────────────────────────────────
const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 30,
    restDelta: 0.001,
  });
  return (
    <motion.div
      style={{ scaleX: width }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-[#fb923c]"
      aria-hidden
    />
  );
};

// ───────────────────────────────────────────────────────────────────────
// Top strip — compact status
// ───────────────────────────────────────────────────────────────────────
const TopStrip: React.FC<{ tab: TabKey; total: number }> = ({
  tab,
  total,
}) => (
  <div className="border-b-2 border-[#F3EFE6]/20 bg-[#0a0a14]/90 backdrop-blur-sm">
    <div className="flex items-center justify-between gap-3 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/85">
      <span>N°{pad2(total)} · ΑΓΩΝΕΣ</span>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full"
          style={{
            background: tab === "upcoming" ? "#fb923c" : "#E8B931",
          }}
        />
        <span className="font-bold">
          {tab === "upcoming" ? "ΠΡΟΣΕΧΕΙΣ" : "ΤΕΛΕΙΩΜΕΝΟΙ"}
        </span>
      </div>
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Masthead
// ───────────────────────────────────────────────────────────────────────
const Masthead: React.FC<{ tab: TabKey }> = ({ tab }) => (
  <header className="relative border-b-2 border-[#F3EFE6]/20">
    <div className="px-5 pt-6 pb-8">
      <nav className="mb-5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span>/</span>
        <span className="text-[#F3EFE6]">Αγώνες</span>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
          <span className="h-[2px] w-6 bg-[#fb923c]" />
          {tab === "upcoming" ? "Πρόγραμμα" : "Ιστορικό"}
        </div>
        <h1
          className="mt-3 font-[var(--f-display)] font-black italic leading-[0.88] tracking-[-0.02em] text-[#F3EFE6]"
          style={{ fontSize: "clamp(2.5rem, 13vw, 3.5rem)" }}
        >
          Οι Αγώνες
        </h1>
        <p className="mt-3 max-w-[34ch] font-[var(--f-body)] text-[13px] leading-relaxed text-[#F3EFE6]/65">
          Το χρονικό κάθε αναμέτρησης — φιλτράρετε ανά τουρνουά ή περιηγηθείτε
          στις καρτέλες.
        </p>
      </motion.div>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Sticky filter rail
// ───────────────────────────────────────────────────────────────────────
const FiltersRail: React.FC<{
  tab: TabKey;
  setTab: (t: TabKey) => void;
  selectedTournament: TournamentOption | null;
  onOpenSheet: () => void;
  onClearTournament: () => void;
}> = ({ tab, setTab, selectedTournament, onOpenSheet, onClearTournament }) => (
  <div
    className="sticky top-0 z-40 border-b-2 border-[#F3EFE6]/15 bg-[#0a0a14]/90 backdrop-blur-md"
    style={{ WebkitBackdropFilter: "blur(12px)" }}
  >
    <div className="flex flex-col gap-2 px-4 py-2.5">
      {/* Tabs — 50/50 */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { k: "upcoming" as TabKey, label: "Προσεχείς" },
          { k: "finished" as TabKey, label: "Τελειωμένοι" },
        ].map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`relative border-2 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-all active:scale-[0.98] ${
                active
                  ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                  : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tournament picker */}
      <div className="flex items-stretch gap-2">
        <button
          onClick={onOpenSheet}
          className="flex min-w-0 flex-1 items-center gap-2 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/75 transition-colors active:border-[#fb923c]/60"
        >
          <span className="shrink-0 text-[#F3EFE6]/40">ΔΙΟΡΓ·</span>
          <span
            className={`truncate ${
              selectedTournament ? "text-[#fb923c]" : "text-[#F3EFE6]/75"
            }`}
          >
            {selectedTournament?.name ?? "Όλα τα τουρνουά"}
          </span>
          <span className="ml-auto shrink-0 text-[#F3EFE6]/55">▾</span>
        </button>
        {selectedTournament && (
          <button
            onClick={onClearTournament}
            aria-label="Καθαρισμός φίλτρου"
            className="shrink-0 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 font-mono text-[14px] text-[#F3EFE6]/70 transition-colors active:border-[#fb923c] active:text-[#fb923c]"
          >
            ×
          </button>
        )}
      </div>
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Meta line
// ───────────────────────────────────────────────────────────────────────
const MetaLine: React.FC<{
  shown: number;
  total: number;
  tournamentName: string | null;
  onClear?: () => void;
}> = ({ shown, total, tournamentName, onClear }) => (
  <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
    <span className="truncate">
      {pad2(shown)} / {pad2(total)} αγώνες
      {tournamentName && (
        <>
          {" · "}
          <span className="text-[#F3EFE6]/75">{tournamentName}</span>
        </>
      )}
    </span>
    {onClear && (
      <button
        onClick={onClear}
        className="shrink-0 text-[#F3EFE6]/60 transition-colors active:text-[#fb923c]"
      >
        Καθαρ. ×
      </button>
    )}
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Match card — the centrepiece
// ───────────────────────────────────────────────────────────────────────
const MatchCard: React.FC<{ m: MatchRow; index: number }> = ({ m, index }) => {
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
  let aWon = false;
  let bWon = false;
  if (finished && aScore !== null && bScore !== null) {
    if (aScore > bScore) {
      outcomeColor = "#fb923c";
      outcomeLabel = "ΝΙΚΗ Α";
      aWon = true;
    } else if (bScore > aScore) {
      outcomeColor = "#fb923c";
      outcomeLabel = "ΝΙΚΗ Β";
      bWon = true;
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
    ? `Αγωνιστ. ${m.matchday}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.04, 0.35),
        duration: 0.3,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      <Link
        href={`/matches/${m.id}`}
        className="group relative block overflow-hidden border-2 border-[#F3EFE6]/15 bg-[#0a0a14] active:bg-[#13131d] transition-colors"
      >
        {/* Left outcome stripe */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{
            background: outcomeLabel ? outcomeColor : "rgba(243,239,230,0.15)",
          }}
        />

        {/* Header strip */}
        <div className="flex items-center justify-between gap-2 border-b border-[#F3EFE6]/10 bg-[#13131d] px-3 py-1.5 pl-4 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/70">
          <span className="flex items-center gap-1.5">
            <span className="text-[#F3EFE6]/45">
              {elWeekday(m.match_date)}
            </span>
            <span>{elDay(m.match_date)}</span>
            <span className="text-[#F3EFE6]/45">
              {elMonthShort(m.match_date)}
            </span>
            {m.match_date && (
              <>
                <span className="text-[#F3EFE6]/25">·</span>
                <span>{elTime(m.match_date)}</span>
              </>
            )}
          </span>
          {matchdayLabel && (
            <span className="shrink-0 text-[#F3EFE6]/55">{matchdayLabel}</span>
          )}
        </div>

        {/* Body */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 pl-4">
          <div className="flex items-center justify-end gap-2 min-w-0">
            <span
              className="truncate text-right font-[var(--f-display)] text-sm font-semibold italic"
              style={{
                color: bWon ? "rgba(243,239,230,0.45)" : "#F3EFE6",
              }}
            >
              {A?.name ?? "Ομάδα Α"}
            </span>
            {A?.logo ? (
              <img
                src={A.logo}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/team-placeholder.svg";
                }}
              />
            ) : (
              <span className="h-8 w-8 shrink-0 rounded-full border border-dashed border-[#F3EFE6]/30" />
            )}
          </div>

          <div className="shrink-0">
            {finished ? (
              <div className="flex items-center gap-1 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1 font-[var(--f-brutal)] text-lg leading-none tabular-nums">
                <span className={aWon ? "text-[#fb923c]" : "text-[#F3EFE6]"}>
                  {aScore ?? 0}
                </span>
                <span className="text-[#F3EFE6]/30">:</span>
                <span className={bWon ? "text-[#fb923c]" : "text-[#F3EFE6]"}>
                  {bScore ?? 0}
                </span>
              </div>
            ) : (
              <div className="border-2 border-dashed border-[#F3EFE6]/30 px-2.5 py-1 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/70">
                {m.match_date ? elTime(m.match_date) : "ΤΒΑ"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {B?.logo ? (
              <img
                src={B.logo}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/team-placeholder.svg";
                }}
              />
            ) : (
              <span className="h-8 w-8 shrink-0 rounded-full border border-dashed border-[#F3EFE6]/30" />
            )}
            <span
              className="truncate font-[var(--f-display)] text-sm font-semibold italic"
              style={{
                color: aWon ? "rgba(243,239,230,0.45)" : "#F3EFE6",
              }}
            >
              {B?.name ?? "Ομάδα Β"}
            </span>
          </div>
        </div>

        {/* Footer strip */}
        <div className="flex items-center justify-between gap-2 border-t border-[#F3EFE6]/10 bg-[#13131d]/60 px-3 py-1.5 pl-4 font-mono text-[9px] uppercase tracking-[0.22em]">
          <div className="flex min-w-0 items-center gap-2">
            {outcomeLabel && (
              <span
                className="shrink-0 border px-1.5 py-[1px] font-bold"
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
                className="truncate text-[#F3EFE6]/55"
                title={tournament.name}
              >
                {tournament.name}
              </span>
            )}
          </div>
          <span className="shrink-0 font-mono text-[11px] text-[#F3EFE6]/40 transition-colors group-active:text-[#fb923c]">
            →
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Skeleton
// ───────────────────────────────────────────────────────────────────────
const Skeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="overflow-hidden border-2 border-[#F3EFE6]/15 bg-[#0a0a14]"
      >
        <div className="h-6 border-b border-[#F3EFE6]/10 bg-[#13131d]" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
          <div className="flex items-center justify-end gap-2">
            <div className="h-3 w-24 animate-pulse bg-[#F3EFE6]/10" />
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#F3EFE6]/10" />
          </div>
          <div className="h-8 w-14 animate-pulse bg-[#F3EFE6]/10" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#F3EFE6]/10" />
            <div className="h-3 w-24 animate-pulse bg-[#F3EFE6]/10" />
          </div>
        </div>
        <div className="h-6 border-t border-[#F3EFE6]/10 bg-[#13131d]/60" />
      </div>
    ))}
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// State block (empty/error)
// ───────────────────────────────────────────────────────────────────────
const StateBlock: React.FC<{
  kicker: string;
  title: string;
  body: string;
}> = ({ kicker, title, body }) => (
  <div
    className="relative border-2 border-dashed border-[#F3EFE6]/25 p-8 text-center"
    style={{ background: "rgba(19,19,29,0.4)" }}
  >
    <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#fb923c]">
      / 00 · {kicker}
    </span>
    <p className="mt-3 font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6]">
      {title}
    </p>
    <p className="mx-auto mt-2 max-w-[30ch] font-[var(--f-body)] text-[13px] text-[#F3EFE6]/60">
      {body}
    </p>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Pagination — compact
// ───────────────────────────────────────────────────────────────────────
const Pagination: React.FC<{
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}> = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-between gap-3 border-t-2 border-[#F3EFE6]/15 pt-4">
      <button
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className={`border-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          page <= 1
            ? "cursor-not-allowed border-[#F3EFE6]/10 text-[#F3EFE6]/25"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 active:border-[#fb923c] active:text-[#fb923c]"
        }`}
      >
        ← Προηγ.
      </button>

      <div className="flex items-baseline gap-1.5 font-mono text-[11px] tabular-nums text-[#F3EFE6]/85">
        <span className="font-bold text-[#fb923c]">{pad2(page)}</span>
        <span className="text-[#F3EFE6]/30">/</span>
        <span>{pad2(totalPages)}</span>
      </div>

      <button
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className={`border-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          page >= totalPages
            ? "cursor-not-allowed border-[#F3EFE6]/10 text-[#F3EFE6]/25"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 active:border-[#fb923c] active:text-[#fb923c]"
        }`}
      >
        Επόμ. →
      </button>
    </nav>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Tournament bottom sheet
// ───────────────────────────────────────────────────────────────────────
const TournamentSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  tournaments: TournamentOption[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}> = ({ open, onClose, tournaments, selected, onSelect }) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            aria-label="Κλείσιμο"
            onClick={onClose}
            className="absolute inset-0 bg-[#08080f]/80 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 38 }}
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden border-t-2 border-[#F3EFE6]/25 bg-[#0a0a14] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            {/* Grip handle */}
            <div className="flex justify-center pt-3">
              <span className="h-1 w-10 rounded-full bg-[#F3EFE6]/25" />
            </div>

            {/* Header */}
            <div className="flex items-end justify-between gap-3 border-b-2 border-[#F3EFE6]/15 px-5 pb-3 pt-3">
              <div>
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[#fb923c]">
                  <span className="h-[2px] w-5 bg-[#fb923c]" />
                  Φίλτρο
                </div>
                <h3 className="mt-1 font-[var(--f-display)] text-2xl font-black italic leading-none tracking-[-0.02em] text-[#F3EFE6]">
                  Διοργάνωση
                </h3>
              </div>
              <button
                onClick={onClose}
                className="border-2 border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/75 active:border-[#fb923c] active:text-[#fb923c]"
              >
                Κλείσιμο
              </button>
            </div>

            {/* List */}
            <div
              ref={listRef}
              className="max-h-[calc(82vh-96px)] overflow-y-auto overscroll-contain divide-y divide-[#F3EFE6]/10"
            >
              <SheetOption
                label="Όλα τα τουρνουά"
                meta={`${tournaments.length} διαθέσιμα`}
                active={selected === null}
                onClick={() => onSelect(null)}
              />
              {tournaments.map((t) => (
                <SheetOption
                  key={t.id}
                  label={t.name}
                  meta={`N°${pad2(t.id)}`}
                  active={selected === t.id}
                  onClick={() => onSelect(t.id)}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const SheetOption: React.FC<{
  label: string;
  meta?: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, meta, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors ${
      active ? "bg-[#fb923c]/10" : "active:bg-[#13131d]"
    }`}
  >
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center border-2 ${
          active
            ? "border-[#fb923c] bg-[#fb923c]"
            : "border-[#F3EFE6]/30 bg-transparent"
        }`}
      >
        {active && (
          <span className="block h-1.5 w-1.5 bg-[#0a0a14]" aria-hidden />
        )}
      </span>
      <span
        className={`truncate font-[var(--f-display)] text-[15px] font-semibold italic ${
          active ? "text-[#fb923c]" : "text-[#F3EFE6]"
        }`}
      >
        {label}
      </span>
    </div>
    {meta && (
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/45">
        {meta}
      </span>
    )}
  </button>
);

// ───────────────────────────────────────────────────────────────────────
// Colophon
// ───────────────────────────────────────────────────────────────────────
const Colophon: React.FC<{ total: number }> = ({ total }) => (
  <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d]">
    <div className="flex flex-col items-start gap-3 px-5 py-5">
      <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
        Σύνολο αγώνων · {pad2(total)}
      </p>
      <Link
        href="/"
        className="border border-[#F3EFE6]/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] transition-colors active:bg-[#F3EFE6] active:text-[#0a0a14]"
      >
        ← Επιστροφή στην Αρχική
      </Link>
    </div>
  </footer>
);
