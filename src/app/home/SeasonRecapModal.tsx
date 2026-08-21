"use client";

// SeasonRecapModal — the "Ετήσια Έκδοση" season-recap overlay.
//
// Design: a printed annual-edition sheet over the home page. Masthead with a
// colophon data strip, the Γενική Κατάταξη podium built from typography
// (plinth height encodes rank), a chronological honours rail, the four
// individual awards, and the season record book.
//
// Behaviour: `SeasonRecapOverlay` owns open state. Auto-opens during August
// (once per season, localStorage-guarded); a launcher chip is available in
// the July–September window. `initialOpen` exists for previews.
//
// The overlay portals to document.body, which is OUTSIDE the page wrapper
// that carries the next/font CSS variables — pass the page's font-variable
// class string via `fontClassName` or --f-display/--f-body won't resolve.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Trophy, X, ScrollText } from "lucide-react";
import { parseIsoPreserveClock } from "@/app/lib/datetime";
import type { SeasonRecapData, RecapAward, RecapMatchRecord } from "@/app/home/seasonRecap";

/**
 * The UltraChamp poster PNG carries baked-in white margins; these percentages
 * crop the visible area to the poster's black frame (measured bounding box
 * x 156–940, y 160–1256 of a 1206×1388 file).
 */
const LOGO_CROP = {
  aspectRatio: "784 / 1096",
  img: { width: "153.83%", height: "126.64%", left: "-19.9%", top: "-14.6%" },
} as const;

/* ────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */

const GR_MONTHS_SHORT = [
  "ΙΑΝ", "ΦΕΒ", "ΜΑΡ", "ΑΠΡ", "ΜΑΪ", "ΙΟΥΝ",
  "ΙΟΥΛ", "ΑΥΓ", "ΣΕΠ", "ΟΚΤ", "ΝΟΕ", "ΔΕΚ",
];

function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const p = parseIsoPreserveClock(iso);
  if (!p) return null;
  return `${GR_MONTHS_SHORT[p.M - 1]} ’${String(p.y).slice(2)}`;
}

function dayLabel(iso: string | null): string | null {
  if (!iso) return null;
  const p = parseIsoPreserveClock(iso);
  if (!p) return null;
  return `${String(p.d).padStart(2, "0")}.${String(p.M).padStart(2, "0")}.${String(p.y).slice(2)}`;
}

const nf = new Intl.NumberFormat("el-GR");

/** Count-up that settles on the target; renders the target directly under reduced motion. */
function useCountUp(target: number, run: boolean, durationMs = 1400): number {
  const [value, setValue] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (!run || done.current) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      done.current = true;
      return;
    }
    done.current = true;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, durationMs]);
  return value;
}

/* ────────────────────────────────────────────────────────────────────
   Small pieces
   ──────────────────────────────────────────────────────────────────── */

/** <img> that falls back (once) to a placeholder if the source 404s or is CSP-blocked. */
const SafeImg: React.FC<
  React.ImgHTMLAttributes<HTMLImageElement> & { fallback?: string }
> = ({ fallback = "/team-placeholder.svg", src, onError, ...rest }) => {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      alt={rest.alt ?? ""}
      src={failed ? fallback : (src as string)}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
};

const SectionRule: React.FC<{ eyebrow: string; index: string }> = ({ eyebrow, index }) => (
  <div className="mt-16 mb-8 border-t-2 border-[#F3EFE6]/15 pt-4 relative">
    <div aria-hidden className="absolute -top-[2px] left-0 h-[2px] w-16 bg-[#fb923c]" />
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#fb923c]">
        {eyebrow}
      </span>
      <span className="font-mono text-[10px] tracking-[0.32em] text-[#F3EFE6]/40">
        {index}
      </span>
    </div>
  </div>
);

const ColophonItem: React.FC<{ value: number; label: string; run: boolean }> = ({
  value,
  label,
  run,
}) => {
  const n = useCountUp(value, run);
  return (
    <span className="whitespace-nowrap">
      <span className="text-[#F3EFE6] font-bold tabular-nums">{nf.format(n)}</span>{" "}
      <span className="text-[#F3EFE6]/55">{label}</span>
    </span>
  );
};

const AwardCard: React.FC<{
  eyebrow: string;
  unit: string;
  award: RecapAward;
}> = ({ eyebrow, unit, award }) => (
  <div className="group relative flex items-stretch gap-5 border border-[#F3EFE6]/12 bg-white/[0.03] p-5 hover:border-[#fb923c]/40 transition-colors">
    <div className="relative h-24 w-20 shrink-0 overflow-hidden border border-[#F3EFE6]/20 bg-[#0d0d17]">
      <SafeImg
        src={award.photo ?? award.teamLogo ?? "/player-placeholder.svg"}
        fallback="/player-placeholder.svg"
        alt={award.name}
        className="h-full w-full object-cover object-top"
        loading="lazy"
      />
    </div>
    <div className="min-w-0 flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#fb923c]">
        {eyebrow}
      </span>
      <span className="mt-1 font-[var(--f-display)] font-black italic text-white leading-tight text-lg md:text-xl line-clamp-2">
        {award.name}
      </span>
      <span className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F3EFE6]/50 truncate">
        {award.teamName ?? "—"} · {award.matches} αγ.
      </span>
    </div>
    <div className="ml-auto flex flex-col items-end justify-center pl-3 border-l border-[#F3EFE6]/10">
      <span className="font-mono font-bold text-3xl md:text-4xl text-[#fb923c] tabular-nums leading-none">
        {award.value}
      </span>
      <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/45">
        {unit}
      </span>
    </div>
  </div>
);

/** One record as a display plaque: eyebrow, oversized gradient number, detail. */
const RecordPlaque: React.FC<{
  eyebrow: string;
  value: number;
  unit: string;
  date?: string | null;
  children: React.ReactNode;
}> = ({ eyebrow, value, unit, date, children }) => (
  <div
    className="relative overflow-hidden border border-[#F3EFE6]/15 bg-white/[0.02] px-5 py-7 text-center flex flex-col"
    style={{
      backgroundImage:
        "repeating-linear-gradient(-45deg, rgba(243,239,230,0.045) 0 1px, transparent 1px 8px)",
    }}
  >
    <span aria-hidden className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#fb923c]" />
    <span aria-hidden className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#fb923c]" />
    <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
      {eyebrow}
    </div>
    <div
      className="mt-3 font-[var(--f-display)] font-black italic leading-none text-transparent bg-clip-text tabular-nums"
      style={{
        fontSize: "clamp(3.25rem, 6vw, 4.75rem)",
        backgroundImage: "linear-gradient(180deg, #ffd9b0 0%, #fb923c 55%, #c2410c 100%)",
        filter: "drop-shadow(0 8px 28px rgba(251,146,60,0.3))",
      }}
    >
      {value}
    </div>
    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/45">
      {unit}
    </div>
    <div className="mt-4 text-sm md:text-base text-[#F3EFE6] leading-snug">{children}</div>
    {date && (
      <div className="mt-auto pt-2 font-mono text-[10px] tracking-[0.2em] text-[#F3EFE6]/40">
        {date}
      </div>
    )}
  </div>
);

const RecordScore: React.FC<{ rec: RecapMatchRecord }> = ({ rec }) => (
  <span className="text-[#F3EFE6]">
    {rec.teamAName}{" "}
    <span className="text-[#fb923c] font-bold tabular-nums">
      {rec.scoreA}–{rec.scoreB}
    </span>{" "}
    {rec.teamBName}
  </span>
);

/* ────────────────────────────────────────────────────────────────────
   The modal sheet
   ──────────────────────────────────────────────────────────────────── */

export const SeasonRecapModal: React.FC<{
  data: SeasonRecapData;
  onClose: () => void;
}> = ({ data, onClose }) => {
  const [entered, setEntered] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Escape closes; lock body scroll while open; move focus into the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const { totals, podium, honours, awards, records } = data;

  // Podium display order: 2 — 1 — 3 on desktop.
  const podiumOrdered = useMemo(() => {
    if (podium.length < 3) return podium.map((t, i) => ({ team: t, rank: i + 1 }));
    return [
      { team: podium[1], rank: 2 },
      { team: podium[0], rank: 1 },
      { team: podium[2], rank: 3 },
    ];
  }, [podium]);

  const plinthHeight = (rank: number) => (rank === 1 ? 148 : rank === 2 ? 104 : 76);
  const rankColor = (rank: number) =>
    rank === 1 ? "#fb923c" : rank === 2 ? "#F3EFE6" : "rgba(243,239,230,0.45)";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-stretch justify-center md:py-6 md:px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Ετήσια ανασκόπηση σεζόν ${data.seasonDisplay}`}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-[#05050a]/90 backdrop-blur-sm transition-opacity duration-500 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="absolute -top-40 -left-40 h-[45rem] w-[45rem] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)" }}
        />
        <div
          className="absolute -bottom-52 -right-40 h-[42rem] w-[42rem] rounded-full opacity-[0.13] blur-3xl"
          style={{ background: "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)" }}
        />
      </div>

      {/* Sheet */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`relative w-full max-w-[1060px] bg-[#0b0b14] text-white outline-none border border-[#F3EFE6]/25 shadow-[0_40px_120px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden transition-all duration-500 motion-reduce:transition-none ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* inner hairline + corner ticks (printed-edition frame) */}
        <div aria-hidden className="pointer-events-none absolute inset-[6px] border border-[#F3EFE6]/10 z-10" />
        {[
          "top-0 left-0 border-t-2 border-l-2",
          "top-0 right-0 border-t-2 border-r-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ].map((pos) => (
          <span key={pos} aria-hidden className={`pointer-events-none absolute z-20 h-5 w-5 border-[#fb923c] ${pos}`} />
        ))}

        {/* Top bar */}
        <div className="relative z-20 flex items-center justify-between gap-4 px-5 md:px-10 py-4 border-b border-[#F3EFE6]/15 bg-[#0b0b14]/95">
          <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.32em] text-[#fb923c]">
            UltraChamp — Ετήσια Έκδοση
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block font-mono text-[10px] tracking-[0.32em] text-[#F3EFE6]/45">
              ΣΕΖΟΝ {data.seasonDisplay}
            </span>
            <button
              onClick={onClose}
              aria-label="Κλείσιμο ανασκόπησης"
              className="flex h-8 w-8 items-center justify-center border border-[#F3EFE6]/25 text-[#F3EFE6]/70 hover:border-[#fb923c] hover:text-[#fb923c] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#fb923c]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="relative overflow-y-auto overscroll-contain px-5 md:px-10 pb-10">
          {/* subtle grain */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
            <filter id="srn">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#srn)" />
          </svg>

          {/* ═══ Masthead ═══ */}
          <div className="pt-10 md:pt-12 text-center">
            <div
              className="relative mx-auto mb-6 w-[74px] md:w-[92px]"
              style={{ aspectRatio: LOGO_CROP.aspectRatio }}
            >
              <div
                aria-hidden
                className="absolute -inset-8 opacity-35 blur-2xl"
                style={{
                  background:
                    "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
                }}
              />
              <div className="relative h-full w-full overflow-hidden shadow-[0_14px_44px_rgba(0,0,0,0.6)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/UltraChampLogo3.png"
                  alt="UltraChamp"
                  className="absolute max-w-none"
                  style={LOGO_CROP.img}
                />
              </div>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#F3EFE6]/50">
              Οκτώβριος — Ιούλιος · Όλη η χρονιά σε μία σελίδα
            </p>
            <h2
              className="mt-4 font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.03em] text-white"
              style={{ fontSize: "clamp(3.5rem, 11vw, 8rem)" }}
            >
              {data.seasonDisplay.split("/")[0]}
              <span className="text-[#fb923c]">/</span>
              {data.seasonDisplay.split("/")[1]}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#F3EFE6]/75 text-sm md:text-base leading-relaxed">
              Κάθε γκολ, κάθε τίτλος, κάθε ρεκόρ της σεζόν — το συγκεντρωτικό δελτίο της χρονιάς.
            </p>
          </div>

          {/* Colophon strip */}
          <div className="mt-8 border-y-2 border-[#F3EFE6]/20 py-3 relative">
            <div aria-hidden className="absolute inset-x-0 top-[3px] border-t border-[#F3EFE6]/10" />
            <div aria-hidden className="absolute inset-x-0 bottom-[3px] border-b border-[#F3EFE6]/10" />
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[11px] md:text-xs uppercase tracking-[0.14em]">
              <ColophonItem value={totals.matches} label="αγώνες" run={entered} />
              <span className="text-[#fb923c]">·</span>
              <ColophonItem value={totals.goals} label="γκολ" run={entered} />
              <span className="text-[#fb923c]">·</span>
              <ColophonItem value={totals.assists} label="ασίστ" run={entered} />
              <span className="text-[#fb923c]">·</span>
              <ColophonItem value={totals.teams} label="ομάδες" run={entered} />
              <span className="text-[#fb923c]">·</span>
              <ColophonItem value={totals.players} label="παίκτες" run={entered} />
              <span className="text-[#fb923c]">·</span>
              <ColophonItem value={totals.tournaments} label="διοργανώσεις" run={entered} />
            </div>
          </div>

          {/* ═══ Podium ═══ */}
          {podium.length > 0 && (
            <>
              <SectionRule eyebrow="Γενική Κατάταξη — Το Βάθρο" index="Ι" />
              <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-6 md:gap-4 pt-2">
                {podiumOrdered.map(({ team, rank }) => (
                  <div
                    key={team.teamId}
                    className={`flex flex-col items-center text-center md:order-none ${
                      rank === 1 ? "order-1" : rank === 2 ? "order-2" : "order-3"
                    }`}
                  >
                    {team.logo ? (
                      <SafeImg
                        src={team.logo}
                        alt=""
                        className={`${
                          rank === 1 ? "h-20 w-20 md:h-24 md:w-24" : "h-14 w-14 md:h-16 md:w-16"
                        } object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]`}
                        loading="lazy"
                      />
                    ) : (
                      <Trophy className="h-12 w-12 text-[#F3EFE6]/30" />
                    )}
                    <div
                      className="mt-3 font-[var(--f-display)] font-black italic leading-none text-white"
                      style={{ fontSize: rank === 1 ? "clamp(1.6rem,3vw,2.3rem)" : "clamp(1.2rem,2.2vw,1.7rem)" }}
                    >
                      {team.name}
                    </div>
                    <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em]">
                      <span className="font-bold tabular-nums" style={{ color: rankColor(rank) }}>
                        {nf.format(team.points)} π.
                      </span>
                      {team.titles > 0 && (
                        <span className="text-[#F3EFE6]/45">
                          {" "}· {team.titles} {team.titles === 1 ? "τίτλος" : "τίτλοι"}
                        </span>
                      )}
                    </div>
                    {/* Plinth */}
                    <div
                      className="mt-4 w-full max-w-[240px] border border-[#F3EFE6]/15 relative overflow-hidden transition-transform duration-700 motion-reduce:transition-none origin-bottom"
                      style={{
                        height: plinthHeight(rank),
                        transform: entered ? "scaleY(1)" : "scaleY(0)",
                        transitionDelay: `${rank * 120}ms`,
                        background:
                          "repeating-linear-gradient(-45deg, rgba(243,239,230,0.06) 0 1px, transparent 1px 7px)",
                      }}
                    >
                      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: rankColor(rank) }} />
                      <span
                        className="absolute inset-0 flex items-center justify-center font-mono font-bold tabular-nums"
                        style={{ color: rankColor(rank), fontSize: rank === 1 ? "2.6rem" : "1.9rem", opacity: 0.9 }}
                      >
                        {rank === 1 ? "1ος" : rank === 2 ? "2ος" : "3ος"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ Honours rail ═══ */}
          {honours.length > 0 && (
            <>
              <SectionRule eyebrow="Οι Κατακτήσεις της Χρονιάς" index="ΙΙ" />
              <ol className="relative ml-2 border-l border-[#F3EFE6]/15">
                {honours.map((h) => (
                  <li key={h.tournamentId} className="relative pl-6 md:pl-8 pb-7 last:pb-0">
                    <span
                      aria-hidden
                      className="absolute -left-[5px] top-[6px] h-[9px] w-[9px] bg-[#0b0b14] border-2 border-[#fb923c]"
                    />
                    <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.28em] text-[#F3EFE6]/45">
                      {monthLabel(h.firstDate) ?? "—"}
                      {h.lastDate && monthLabel(h.lastDate) !== monthLabel(h.firstDate)
                        ? ` — ${monthLabel(h.lastDate)}`
                        : ""}{" "}
                      · {h.matches} αγώνες
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="font-[var(--f-display)] font-black italic text-white text-xl md:text-2xl leading-tight">
                        {h.name}
                      </span>
                      {h.winnerName ? (
                        <span className="inline-flex items-center gap-2 border border-[#fb923c]/40 bg-[#fb923c]/10 px-3 py-1">
                          <Trophy className="h-3.5 w-3.5 text-[#fb923c]" />
                          {h.winnerLogo && (
                            <SafeImg src={h.winnerLogo} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                          )}
                          <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.18em] text-[#fb923c] font-bold">
                            {h.winnerName}
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/40 border border-[#F3EFE6]/15 px-3 py-1">
                          Σε εξέλιξη
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {/* ═══ Awards ═══ */}
          {(awards.scorer || awards.assister || awards.mvp || awards.gk) && (
            <>
              <SectionRule eyebrow="Τα Βραβεία της Σεζόν" index="ΙΙΙ" />
              {awards.scorer &&
                awards.assister &&
                awards.mvp &&
                awards.scorer.playerId === awards.assister.playerId &&
                awards.scorer.playerId === awards.mvp.playerId && (
                  <p className="-mt-3 mb-6 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.24em] text-[#fb923c]">
                    Τριπλό στέμμα — ο {awards.scorer.name} τερμάτισε πρώτος σε γκολ, ασίστ και MVP.
                  </p>
                )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {awards.scorer && <AwardCard eyebrow="Πρώτος Σκόρερ" unit="γκολ" award={awards.scorer} />}
                {awards.assister && <AwardCard eyebrow="Βασιλιάς των Ασίστ" unit="ασίστ" award={awards.assister} />}
                {awards.mvp && <AwardCard eyebrow="MVP" unit="βραβεία mvp" award={awards.mvp} />}
                {awards.gk && <AwardCard eyebrow="Κορυφαίος Τερματοφύλακας" unit="βραβεία gk" award={awards.gk} />}
              </div>
            </>
          )}

          {/* ═══ Record book ═══ */}
          <SectionRule eyebrow="Το Βιβλίο των Ρεκόρ" index="IV" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {records.highestScoring && (
              <RecordPlaque
                eyebrow="Ο χορταστικότερος αγώνας"
                value={records.highestScoring.scoreA + records.highestScoring.scoreB}
                unit="γκολ σε έναν αγώνα"
                date={dayLabel(records.highestScoring.date)}
              >
                <RecordScore rec={records.highestScoring} />
              </RecordPlaque>
            )}
            {records.bestHaul && (
              <RecordPlaque
                eyebrow="Η μεγαλύτερη ατομική παράσταση"
                value={records.bestHaul.goals}
                unit="γκολ από έναν παίκτη"
                date={dayLabel(records.bestHaul.date)}
              >
                <span className="font-bold">{records.bestHaul.playerName}</span>
                {records.bestHaul.teamName && (
                  <span className="text-[#F3EFE6]/70"> · {records.bestHaul.teamName}</span>
                )}
                {records.bestHaul.opponentName && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F3EFE6]/50">
                    κόντρα σε {records.bestHaul.opponentName} · τελικό{" "}
                    <span className="text-[#fb923c] font-bold">
                      {records.bestHaul.scoreA}–{records.bestHaul.scoreB}
                    </span>
                  </div>
                )}
              </RecordPlaque>
            )}
            {records.mostTeamWins && (
              <RecordPlaque
                eyebrow="Οι περισσότερες νίκες"
                value={records.mostTeamWins.wins}
                unit="νίκες μέσα στη σεζόν"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {records.mostTeamWins.teamLogo && (
                    <SafeImg
                      src={records.mostTeamWins.teamLogo}
                      alt=""
                      className="h-6 w-6 object-contain"
                      loading="lazy"
                    />
                  )}
                  <span className="font-bold">{records.mostTeamWins.teamName}</span>
                </span>
              </RecordPlaque>
            )}
            {records.mostAppearances && (
              <RecordPlaque
                eyebrow="Οι περισσότερες συμμετοχές"
                value={records.mostAppearances.matches}
                unit="αγώνες στη σεζόν"
              >
                <span className="font-bold">{records.mostAppearances.playerName}</span>
              </RecordPlaque>
            )}
          </div>

          {/* ═══ Footer ═══ */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <Link
              href="/geniki-katataxi"
              onClick={onClose}
              className="group inline-flex items-center gap-3 border-2 border-[#fb923c] bg-[#fb923c] px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.28em] text-[#08080f] hover:bg-transparent hover:text-[#fb923c] transition-colors"
            >
              Πλήρης Γενική Κατάταξη
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-3 border border-[#F3EFE6]/25 px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.28em] text-[#F3EFE6]/70 hover:border-[#F3EFE6]/60 hover:text-white transition-colors"
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────
   Overlay controller — launcher chip + auto-open window
   ──────────────────────────────────────────────────────────────────── */

function dismissKey(seasonLabel: string) {
  return `ultrachamp-season-recap-${seasonLabel}-dismissed`;
}

export default function SeasonRecapOverlay({
  data,
  fontClassName = "",
}: {
  data: SeasonRecapData | null;
  /** The page's next/font variable classes — the portal escapes the page wrapper that defines them. */
  fontClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inWindow, setInWindow] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!data) return;
    const month = new Date().getMonth() + 1; // 1-12
    // Launcher visible July–September; auto-open only during August,
    // once per season per browser.
    setInWindow(month >= 7 && month <= 9);
    if (month === 8) {
      let seen = false;
      try {
        seen = localStorage.getItem(dismissKey(data.seasonLabel)) === "1";
      } catch {}
      if (!seen) setOpen(true);
    }
  }, [data]);

  const close = useCallback(() => {
    setOpen(false);
    if (data) {
      try {
        localStorage.setItem(dismissKey(data.seasonLabel), "1");
      } catch {}
    }
  }, [data]);

  if (!data || !mounted || !inWindow) return null;

  return createPortal(
    <div className={`${fontClassName} font-[var(--f-body)]`}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[110] inline-flex items-center gap-2.5 border border-[#fb923c]/60 bg-[#0b0b14]/95 backdrop-blur px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#fb923c] shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:bg-[#fb923c] hover:text-[#08080f] transition-colors"
          aria-label={`Άνοιγμα ανασκόπησης σεζόν ${data.seasonDisplay}`}
        >
          <ScrollText className="h-3.5 w-3.5" />
          Ανασκόπηση {data.seasonDisplay}
        </button>
      )}
      {open && <SeasonRecapModal data={data} onClose={close} />}
    </div>,
    document.body
  );
}
