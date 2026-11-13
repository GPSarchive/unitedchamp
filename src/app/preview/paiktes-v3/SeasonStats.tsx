// The part of a profile under the player's name: the season in numbers, the
// same numbers per tournament, and earlier seasons.
//
// The card next to it already shows the six season totals, so repeating them
// in a grid adds nothing. Three candidate layouts each answer a different
// question instead; they exist side by side while this is a preview, next to
// the layout that shipped first, and a picker in the profile switches between
// them and remembers the choice:
//   · progress — the client's pick (2026-11-14): the one table below, with the
//     season split by team as well as by tournament, then «Πρόοδος σεζόν»:
//     each stat as progress towards the season's best, the place it gives
//     and what the next place up would take;
//   · standing — "how good are these numbers?": each one against the season's
//     best, with the player's place among everyone;
//   · table    — "just the numbers": season total and tournaments in one
//     table that fits a phone without scrolling sideways;
//   · ledger   — "what kind of season?": grouped lines with per-match rates.
// Once one is chosen, keep it and delete the others and the picker.
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import type { ProfileStatLine } from "../paiktes-v2/data";
import { STAT_KEYS, STAT_LABELS, statValue, type StatKey, type StatTuple } from "../paiktes-v2/model";
import { LINK, SeasonStrip, StatTable } from "../paiktes-v2/[id]/profileParts";
import { ordinal, RANKED_KEYS, type RankedKey, type SeasonStanding } from "./standing";

/** A line of a table: a tournament, a season, or a team (which has a logo, possibly none). */
export type TableLine = ProfileStatLine & { logo?: string | null };

export type StatsLayoutId = "progress" | "standing" | "table" | "ledger" | "current";

const LAYOUTS: { id: StatsLayoutId; label: string; hint: string }[] = [
  {
    id: "progress",
    label: "Πίνακας + πρόοδος",
    hint: "Ο ένας πίνακας, με γραμμές και ανά ομάδα, και από κάτω η πρόοδος της σεζόν σε κάθε κατηγορία.",
  },
  {
    id: "standing",
    label: "Κατάταξη",
    hint: "Κάθε επίδοση δίπλα στην καλύτερη της σεζόν, με τη θέση του παίκτη ανάμεσα σε όλους.",
  },
  {
    id: "table",
    label: "Ένας πίνακας",
    hint: "Σύνολο σεζόν και διοργανώσεις μαζί, σε πίνακα που χωράει στο κινητό χωρίς οριζόντια κύλιση.",
  },
  {
    id: "ledger",
    label: "Ανάλυση",
    hint: "Ομαδοποιημένες γραμμές (επίθεση, αγώνες, διακρίσεις, πειθαρχία) με μέσους όρους ανά αγώνα.",
  },
  { id: "current", label: "Τωρινό", hint: "Όπως ήταν μέχρι τώρα, για σύγκριση." },
];

const BY_ID = new Map(LAYOUTS.map((l) => [l.id, l] as const));
const STORAGE_KEY = "paiktes-v3:stats-layout";

/** The chosen layout, remembered in this browser. */
export function useStatsLayout(): [StatsLayoutId, (id: StatsLayoutId) => void] {
  const [id, setId] = useState<StatsLayoutId>("progress");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && BY_ID.has(saved as StatsLayoutId)) setId(saved as StatsLayoutId);
    } catch {
      // Storage unavailable: the default is fine.
    }
  }, []);
  const choose = (next: StatsLayoutId) => {
    setId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered, still applied.
    }
  };
  return [id, choose];
}

/** Preview only: compare the layouts. Remove once one is chosen. */
export function StatsLayoutPicker({
  value,
  onChange,
}: {
  value: StatsLayoutId;
  onChange: (id: StatsLayoutId) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[13px] text-[#F3EFE6]/65">Διάταξη στατιστικών (προεπισκόπηση)</legend>
      <div className="mt-1.5 flex gap-px overflow-x-auto border border-[#F3EFE6]/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LAYOUTS.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={active}
              title={option.hint}
              className={`h-10 shrink-0 grow whitespace-nowrap px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#fb923c] ${
                active ? "bg-[#fb923c] font-bold text-[#0a0a14]" : "text-[#F3EFE6]/80 hover:bg-[#F3EFE6]/[0.06]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[13px] text-[#F3EFE6]/60">{BY_ID.get(value)?.hint}</p>
    </fieldset>
  );
}

// ── Shared pieces ───────────────────────────────────────────────────────

const HAIRLINE = "border-[#F3EFE6]/15";
const HEADING = "text-xl font-bold";

const CARDS = [
  { index: 6, title: "Κίτρινες κάρτες", one: "κίτρινη κάρτα", many: "κίτρινες κάρτες", color: "#E8B931" },
  { index: 7, title: "Κόκκινες κάρτες", one: "κόκκινη κάρτα", many: "κόκκινες κάρτες", color: "#ef4444" },
  { index: 8, title: "Μπλε κάρτες", one: "μπλε κάρτα", many: "μπλε κάρτες", color: "#60a5fa" },
] as const;

function CardGlyph({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-4 w-3 shrink-0 rounded-[2px]" style={{ background: color }} />;
}

/** The cards a player was shown, as coloured glyphs with a count; `none` when there are none. */
function Cards({ stats, none }: { stats: StatTuple; none: React.ReactNode }) {
  const shown = CARDS.filter((card) => stats[card.index] > 0);
  if (shown.length === 0) return <>{none}</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {shown.map((card) => (
        <span key={card.index} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <CardGlyph color={card.color} />
          <span className="font-bold tabular-nums text-[#F3EFE6]">{stats[card.index]}</span>
          <span className="sr-only">{stats[card.index] === 1 ? card.one : card.many}</span>
        </span>
      ))}
    </span>
  );
}

/** «1,7» — per match, with a Greek decimal comma. null when there is nothing to divide. */
const perMatch = (value: number, matches: number) =>
  matches > 0 && value > 0 ? (value / matches).toFixed(1).replace(".", ",") : null;

const winShare = (wins: number, matches: number) => (matches > 0 ? `${Math.round((wins / matches) * 100)}%` : null);

function LineLabel({ line }: { line: TableLine }) {
  const name = line.href ? (
    <Link href={line.href} className={LINK}>
      {line.label}
    </Link>
  ) : (
    <>{line.label}</>
  );
  if (line.logo === undefined) return name;
  // A team: its logo in front, in the same frame as the team links above.
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden className="h-7 w-7 shrink-0 overflow-hidden border border-[#F3EFE6]/15 bg-[#13131d]">
        {!isPlaceholderPhoto(line.logo) && (
          <PlayerImage
            src={line.logo}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-contain p-0.5"
            animate={false}
          />
        )}
      </span>
      {name}
    </span>
  );
}

// ── Layout 1: standing ──────────────────────────────────────────────────

const RANK_LABELS: Record<RankedKey, { label: string; rate: boolean }> = {
  goals: { label: "Γκολ", rate: true },
  assists: { label: "Ασίστ", rate: true },
  mvp: { label: "Βραβεία MVP", rate: false },
  best_gk: { label: "Βραβεία καλύτερου τερματοφύλακα", rate: false },
};

// The card's gold: the section continues its material instead of starting a new one.
const GOLD_BAR = "linear-gradient(90deg, #B8860B 0%, #D4AF37 45%, #FFE08A 100%)";

/**
 * Bars that grow to their length once, as the last beat of the profile's
 * arrival. Returns where to register each bar's fill; a fill carries its
 * final `scaleX` inline, and is grown to it from nothing.
 * `settleAt` is the `performance.now()` time before which nothing should move.
 */
function useGrowOnce(settleAt: number) {
  const fills = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wait = Math.max(0, settleAt - performance.now());
    const running = fills.current.flatMap((el, i) =>
      el
        ? [
            el.animate([{ transform: "scaleX(0)" }, { transform: el.style.transform }], {
              duration: 720,
              delay: wait + i * 90,
              easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
              fill: "backwards",
            }),
          ]
        : [],
    );
    return () => running.forEach((a) => a.cancel());
  }, [settleAt]);
  return fills;
}

/** How far along the season's best a value is; a sliver at least, so a 1 still shows. */
const reachOf = (value: number, best: number) => (best > 0 ? Math.max(0.03, value / best) : 0);

function StandingRows({
  season,
  standing,
  settleAt,
}: {
  season: StatTuple;
  standing: SeasonStanding;
  /** `performance.now()` time before which nothing should move (the profile is still arriving). */
  settleAt: number;
}) {
  const [matches, wins] = season;
  const rows = RANKED_KEYS.filter((key) => standing[key].value > 0);
  const share = winShare(wins, matches);
  const fills = useGrowOnce(settleAt);

  return (
    <>
      <dl className="mt-3 flex flex-wrap items-baseline gap-x-7 gap-y-1 text-[15px]">
        <div className="flex items-baseline gap-2">
          <dt className="text-[#F3EFE6]/65">Αγώνες</dt>
          <dd className="font-bold tabular-nums">{matches}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-[#F3EFE6]/65">Νίκες</dt>
          <dd>
            <span className="font-bold tabular-nums">{wins}</span>
            {share && wins > 0 ? <span className="ml-1.5 text-[13px] text-[#F3EFE6]/60">{share}</span> : null}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-[#F3EFE6]/65">Κάρτες</dt>
          <dd>
            <Cards stats={season} none={<span className="text-[#F3EFE6]/45">καμία</span>} />
          </dd>
        </div>
      </dl>

      {rows.length === 0 ? (
        <p className="mt-4 text-[15px] text-[#F3EFE6]/75">Χωρίς γκολ, ασίστ ή βραβεία μέχρι στιγμής.</p>
      ) : (
        <ul className={`mt-4 border-b ${HAIRLINE}`}>
          {rows.map((key, i) => {
            const s = standing[key];
            const rate = RANK_LABELS[key].rate ? perMatch(s.value, matches) : null;
            const reach = reachOf(s.value, s.best);
            return (
              <li key={key} className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 border-t py-3.5 ${HAIRLINE}`}>
                <div
                  className={`min-w-[2.75rem] text-[2.5rem] font-bold leading-none tabular-nums ${
                    key === "goals" ? "text-[#fb923c]" : ""
                  }`}
                >
                  {s.value}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
                    <span>{RANK_LABELS[key].label}</span>
                    {s.rank != null && (
                      <span className="whitespace-nowrap">
                        <span className={`font-bold ${s.rank <= 3 ? "text-[#FFD866]" : ""}`}>{ordinal(s.rank)}</span>{" "}
                        <span className="text-[#F3EFE6]/55">από {standing.players}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden bg-[#F3EFE6]/10">
                    <div
                      ref={(el) => {
                        fills.current[i] = el;
                      }}
                      className="h-full origin-left"
                      style={{ transform: `scaleX(${reach.toFixed(3)})`, background: GOLD_BAR }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-[13px] text-[#F3EFE6]/65">
                    {rate && <span>{rate} ανά αγώνα</span>}
                    <span className="ml-auto">
                      {s.rank === 1 ? "Η καλύτερη επίδοση της σεζόν" : `Καλύτερη επίδοση σεζόν: ${s.best}`}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const PHRASES: Record<StatKey, [one: string, many: string]> = {
  matches: ["αγώνας", "αγώνες"],
  wins: ["νίκη", "νίκες"],
  goals: ["γκολ", "γκολ"],
  assists: ["ασίστ", "ασίστ"],
  mvp: ["MVP", "MVP"],
  best_gk: ["βραβείο τερματοφύλακα", "βραβεία τερματοφύλακα"],
};

/** A tournament or season as a line of words: only what there is something to say about. */
function PhraseRows({ caption, lines }: { caption: string; lines: ProfileStatLine[] }) {
  return (
    <section className="mt-9">
      <h3 className={HEADING}>{caption}</h3>
      <ul className={`mt-3 border-b ${HAIRLINE}`}>
        {lines.map((line) => {
          const said = STAT_KEYS.filter((key) => statValue(line.stats, key) > 0);
          return (
            <li key={line.key} className={`border-t py-3 ${HAIRLINE}`}>
              <div className="text-[15px]">
                <LineLabel line={line} />
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[15px] text-[#F3EFE6]/75">
                {said.length === 0 && <span>Χωρίς συμμετοχή</span>}
                {said.map((key) => {
                  const n = statValue(line.stats, key);
                  return (
                    <span key={key} className="whitespace-nowrap">
                      <span
                        className={`font-bold tabular-nums ${key === "goals" ? "text-[#fb923c]" : "text-[#F3EFE6]"}`}
                      >
                        {n}
                      </span>{" "}
                      {PHRASES[key][n === 1 ? 0 : 1]}
                    </span>
                  );
                })}
                <Cards stats={line.stats} none={null} />
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Layout 2: one table ─────────────────────────────────────────────────

/**
 * Season total, then groups of lines (teams, tournaments — or earlier
 * seasons) in one table. Each line's name sits on a row of its own above its
 * numbers, so no column has to be wide enough for a name and the table fits a
 * phone as it is. A group with a title gets a small heading row.
 */
function OneTable({
  caption,
  total = null,
  lines = [],
  groups,
  first = false,
}: {
  caption: string;
  total?: StatTuple | null;
  /** One untitled group; shorthand for `groups`. */
  lines?: TableLine[];
  groups?: { title: string; lines: TableLine[] }[];
  first?: boolean;
}) {
  const sections = (groups ?? [{ title: "", lines }]).filter((group) => group.lines.length > 0);
  const columns = STAT_KEYS.length + 1;

  const row = (line: TableLine, strong: boolean) => (
    <tbody key={line.key} className={`border-t ${HAIRLINE}`}>
      <tr>
        <th
          colSpan={columns}
          scope="rowgroup"
          className={`pt-3 font-normal ${strong ? "text-[13px] text-[#F3EFE6]/65" : ""}`}
        >
          <LineLabel line={line} />
        </th>
      </tr>
      <tr className={strong ? "text-2xl font-bold" : "text-lg"}>
        {STAT_KEYS.map((key) => {
          const value = statValue(line.stats, key);
          return (
            <td
              key={key}
              className={`pb-3 pt-1 tabular-nums ${
                value === 0 ? "font-normal text-[#F3EFE6]/30" : key === "goals" ? "text-[#fb923c]" : ""
              }`}
            >
              {value === 0 ? "–" : value}
            </td>
          );
        })}
        <td className="pb-3 pt-1 text-[15px] font-normal">
          <Cards stats={line.stats} none={<span className="text-[#F3EFE6]/30">–</span>} />
        </td>
      </tr>
    </tbody>
  );

  return (
    <section className={first ? "mt-6" : "mt-9"}>
      <h3 className={HEADING}>{caption}</h3>
      <table className={`mt-3 w-full table-fixed border-collapse border-b text-left text-[15px] ${HAIRLINE}`}>
        <colgroup>
          {STAT_KEYS.map((key) => (
            <col key={key} />
          ))}
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr className="text-[13px] text-[#F3EFE6]/65">
            {STAT_KEYS.map((key) => (
              <th key={key} scope="col" className="pb-2 font-normal">
                <abbr title={STAT_LABELS[key].title} className="no-underline">
                  {STAT_LABELS[key].short}
                </abbr>
              </th>
            ))}
            <th scope="col" className="pb-2 font-normal">
              Κάρτες
            </th>
          </tr>
        </thead>
        {total && row({ key: "total", label: "Σύνολο σεζόν", href: null, stats: total }, true)}
        {sections.map((section) => (
          <Fragment key={section.title || "lines"}>
            {section.title && (
              <tbody>
                <tr>
                  <th colSpan={columns} scope="colgroup" className="pb-1 pt-6 text-[13px] font-normal text-[#F3EFE6]/65">
                    {section.title}
                  </th>
                </tr>
              </tbody>
            )}
            {section.lines.map((line) => row(line, false))}
          </Fragment>
        ))}
      </table>
    </section>
  );
}

// ── Progression ─────────────────────────────────────────────────────────

const PROGRESS: Record<RankedKey, { label: string; unit: [one: string, many: string] }> = {
  goals: { label: "Γκολ", unit: ["γκολ", "γκολ"] },
  assists: { label: "Ασίστ", unit: ["ασίστ", "ασίστ"] },
  mvp: { label: "Βραβεία MVP", unit: ["MVP", "MVP"] },
  best_gk: { label: "Βραβεία τερματοφύλακα", unit: ["βραβείο", "βραβεία"] },
};

/**
 * Bars that fill once, when they first come into view — and not before the
 * profile has finished arriving. Each fill carries its final `scaleX` inline
 * and is grown to it from nothing; until then it waits empty.
 */
function useFillInView(settleAt: number) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const fills = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const running = fills.current.flatMap((el, i) =>
      el
        ? [
            el.animate([{ transform: "scaleX(0)" }, { transform: el.style.transform }], {
              duration: 900,
              delay: i * 120,
              easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
              fill: "backwards",
            }),
          ]
        : [],
    );
    running.forEach((a) => a.pause());
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        timer = window.setTimeout(
          () => running.forEach((a) => a.play()),
          Math.max(0, settleAt - performance.now()),
        );
      },
      { threshold: 0.3 },
    );
    observer.observe(list);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      running.forEach((a) => a.cancel());
    };
  }, [settleAt]);
  return { listRef, fills };
}

/**
 * The season as progress towards the top: in each category the player has
 * something in, how far along the season's best they are, where that puts
 * them, and what the next place up would take.
 */
function Progression({ standing, settleAt }: { standing: SeasonStanding; settleAt: number }) {
  const { listRef, fills } = useFillInView(settleAt);
  const rows = RANKED_KEYS.filter((key) => standing[key].value > 0);
  return (
    <section className="mt-10">
      <h3 className={HEADING}>Πρόοδος σεζόν</h3>
      <p className="mt-1 text-[15px] text-[#F3EFE6]/70">
        Πόσο κοντά στην κορυφή βρίσκεται σε κάθε κατηγορία, ανάμεσα σε {standing.players} παίκτες.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-[15px] text-[#F3EFE6]/75">
          Η πρόοδος ξεκινά με το πρώτο γκολ, την πρώτη ασίστ ή το πρώτο βραβείο.
        </p>
      ) : (
        <ul ref={listRef} className={`mt-4 border-b ${HAIRLINE}`}>
          {rows.map((key, i) => {
            const s = standing[key];
            const { label, unit } = PROGRESS[key];
            const top = s.rank === 1;
            const step = s.next ? s.next.value - s.value : 0;
            return (
              <li key={key} className={`border-t py-4 ${HAIRLINE}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px]">{label}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    <span className={`text-2xl font-bold ${key === "goals" ? "text-[#fb923c]" : ""}`}>{s.value}</span>
                    <span className="text-[15px] text-[#F3EFE6]/55">
                      <span aria-hidden> / </span>
                      <span className="sr-only"> από τα </span>
                      {s.best}
                      <span className="sr-only"> της καλύτερης επίδοσης της σεζόν</span>
                    </span>
                  </span>
                </div>
                <div aria-hidden className="mt-2.5 h-2 overflow-hidden bg-[#F3EFE6]/10">
                  <div
                    ref={(el) => {
                      fills.current[i] = el;
                    }}
                    className="h-full origin-left"
                    style={{ transform: `scaleX(${reachOf(s.value, s.best).toFixed(3)})`, background: GOLD_BAR }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[13px]">
                  <span>
                    <span className={`text-[15px] font-bold ${top ? "text-[#FFD866]" : ""}`}>
                      {s.rank != null ? ordinal(s.rank) : ""}
                    </span>
                    <span className="text-[#F3EFE6]/55"> στη σεζόν</span>
                  </span>
                  {top ? (
                    <span className="text-[#FFD866]">{s.shared ? "Μοιράζεται την κορυφή" : "Στην κορυφή της σεζόν"}</span>
                  ) : s.next ? (
                    <span className="text-[#F3EFE6]/75">
                      <span className="font-bold text-[#F3EFE6]">
                        +{step} {step === 1 ? unit[0] : unit[1]}
                      </span>{" "}
                      για την {ordinal(s.next.rank, "f")} θέση
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Layout 3: ledger ────────────────────────────────────────────────────

type LedgerRow = {
  label: string;
  value: number;
  note?: string | null;
  lit?: boolean;
  card?: string;
  /** Said in place of the number, e.g. «καμία». */
  words?: string;
};

function Ledger({ season }: { season: StatTuple }) {
  const [matches, wins, goals, assists, mvp, bestGk] = season;
  const rate = (value: number) => {
    const per = perMatch(value, matches);
    return per ? `${per} ανά αγώνα` : null;
  };
  const share = winShare(wins, matches);
  // Awards and cards list only what there is: a row per colour of card the
  // player never saw is three lines of nothing on a phone.
  const awards: LedgerRow[] = [
    { label: "Βραβεία MVP", value: mvp },
    { label: "Βραβεία καλύτερου τερματοφύλακα", value: bestGk },
  ].filter((row) => row.value > 0);
  const shown: LedgerRow[] = CARDS.filter((card) => season[card.index] > 0).map((card) => ({
    label: card.title,
    value: season[card.index],
    card: card.color,
  }));
  const groups: { title: string; rows: LedgerRow[] }[] = [
    {
      title: "Επίθεση",
      rows: [
        { label: "Γκολ", value: goals, note: rate(goals), lit: true },
        { label: "Ασίστ", value: assists, note: rate(assists) },
        { label: "Γκολ και ασίστ μαζί", value: goals + assists, note: rate(goals + assists) },
      ],
    },
    {
      title: "Αγώνες",
      rows: [
        { label: "Συμμετοχές", value: matches },
        { label: "Νίκες", value: wins, note: share && wins > 0 ? `${share} των αγώνων` : null },
      ],
    },
    ...(awards.length > 0 ? [{ title: "Διακρίσεις", rows: awards }] : []),
    {
      title: "Πειθαρχία",
      rows: shown.length > 0 ? shown : [{ label: "Κάρτες", value: 0, words: "καμία" }],
    },
  ];
  return (
    <div className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group.title}>
          <h4 className="text-[13px] text-[#F3EFE6]/65">{group.title}</h4>
          <dl className={`mt-1.5 border-b ${HAIRLINE}`}>
            {group.rows.map((row) => (
              <div key={row.label} className={`flex items-baseline justify-between gap-4 border-t py-2.5 ${HAIRLINE}`}>
                <dt className="flex min-w-0 items-baseline gap-2 text-[15px] text-[#F3EFE6]/85">
                  {row.card && (
                    <span className="self-center">
                      <CardGlyph color={row.card} />
                    </span>
                  )}
                  {row.label}
                </dt>
                <dd className="flex items-baseline gap-3 whitespace-nowrap">
                  {row.note && <span className="text-[13px] text-[#F3EFE6]/60">{row.note}</span>}
                  {row.words ? (
                    <span className="text-[15px] text-[#F3EFE6]/60">{row.words}</span>
                  ) : (
                    <span
                      className={`min-w-[1.25rem] text-right text-xl font-bold tabular-nums ${
                        row.value === 0 ? "font-normal text-[#F3EFE6]/30" : row.lit ? "text-[#fb923c]" : ""
                      }`}
                    >
                      {row.value === 0 ? "–" : row.value}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

// ── The section ─────────────────────────────────────────────────────────

export default function SeasonStats({
  layout,
  seasonLabel,
  season,
  standing,
  teams,
  tournaments,
  history,
  settleAt,
}: {
  layout: StatsLayoutId;
  seasonLabel: string | null;
  /** Active-season totals; null = no appearances yet. */
  season: StatTuple | null;
  standing: SeasonStanding | null;
  /** One line per team the player has played for this season, most matches first. */
  teams: TableLine[];
  /** One line per tournament of the active season the player has stats in. */
  tournaments: ProfileStatLine[];
  /** One line per earlier season, newest first. */
  history: ProfileStatLine[];
  settleAt: number;
}) {
  const title = seasonLabel ? `Σεζόν ${seasonLabel}` : "Τρέχουσα σεζόν";
  const noSeason = (
    <p className="mt-3 text-[15px] text-[#F3EFE6]/75">Δεν έχει καταγραφεί συμμετοχή σε αγώνα αυτή τη σεζόν.</p>
  );

  if (layout === "current") {
    return (
      <>
        <section className="mt-6">
          <h3 className={HEADING}>{title}</h3>
          {season ? <SeasonStrip stats={season} /> : noSeason}
        </section>
        {tournaments.length > 0 && (
          <StatTable caption="Ανά διοργάνωση" firstColumn="Διοργάνωση" lines={tournaments} />
        )}
        {history.length > 0 && <StatTable caption="Προηγούμενες σεζόν" firstColumn="Σεζόν" lines={history} />}
      </>
    );
  }

  if (layout === "progress") {
    return (
      <>
        {season ? (
          <>
            <OneTable
              caption={title}
              total={season}
              groups={[
                { title: "Ανά ομάδα", lines: teams },
                { title: "Ανά διοργάνωση", lines: tournaments },
              ]}
              first
            />
            {standing && <Progression standing={standing} settleAt={settleAt} />}
          </>
        ) : (
          <section className="mt-6">
            <h3 className={HEADING}>{title}</h3>
            {noSeason}
          </section>
        )}
        {history.length > 0 && <OneTable caption="Προηγούμενες σεζόν" lines={history} />}
      </>
    );
  }

  if (layout === "table") {
    return (
      <>
        {season ? (
          <OneTable caption={title} total={season} lines={tournaments} first />
        ) : (
          <section className="mt-6">
            <h3 className={HEADING}>{title}</h3>
            {noSeason}
          </section>
        )}
        {history.length > 0 && <OneTable caption="Προηγούμενες σεζόν" lines={history} />}
      </>
    );
  }

  if (layout === "ledger" || !standing) {
    return (
      <>
        <section className="mt-6">
          <h3 className={HEADING}>{title}</h3>
          {season ? <Ledger season={season} /> : noSeason}
        </section>
        {tournaments.length > 0 && <OneTable caption="Ανά διοργάνωση" lines={tournaments} />}
        {history.length > 0 && <OneTable caption="Προηγούμενες σεζόν" lines={history} />}
      </>
    );
  }

  return (
    <>
      <section className="mt-6">
        <h3 className={HEADING}>{title}</h3>
        {season ? <StandingRows season={season} standing={standing} settleAt={settleAt} /> : noSeason}
      </section>
      {tournaments.length > 0 && <PhraseRows caption="Ανά διοργάνωση" lines={tournaments} />}
      {history.length > 0 && <PhraseRows caption="Προηγούμενες σεζόν" lines={history} />}
    </>
  );
}
