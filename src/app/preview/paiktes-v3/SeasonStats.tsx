// The part of a profile under the player's name, chosen out of five candidate
// layouts (the others, and the picker between them, are in this file's git
// history):
//   · one table: the season total, then the season split by team and by
//     tournament — each line's name on a row of its own above its numbers,
//     so it fits a phone without scrolling sideways;
//   · «Πρόοδος σεζόν»: each stat as progress towards the season's best, the
//     place it gives and what the next place up would take;
//   · earlier seasons, in the same kind of table.
// The card next to it already shows the six season totals as a grid, so this
// section adds what the card cannot: the breakdown and the context.
"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import type { ProfileStatLine } from "../paiktes-v2/data";
import { STAT_KEYS, statValue, type StatKey, type StatTuple } from "../paiktes-v2/model";
import { LINK } from "../paiktes-v2/[id]/profileParts";
import { ordinal, RANKED_KEYS, type RankedKey, type SeasonStanding } from "./standing";

/** A line of a table: a tournament, a season, or a team (which has a logo, possibly none). */
export type TableLine = ProfileStatLine & { logo?: string | null };

// ── Shared pieces ───────────────────────────────────────────────────────

const HAIRLINE = "border-[#F3EFE6]/15";
const HEADING = "text-xl font-bold";

/** Column heads, written out; only the goalkeeper award is shortened (explained on hover). */
const COLUMNS: Record<StatKey, { label: string; title?: string }> = {
  matches: { label: "Αγώνες" },
  wins: { label: "Νίκες" },
  goals: { label: "Γκολ" },
  assists: { label: "Ασίστ" },
  mvp: { label: "MVP", title: "Βραβεία MVP" },
  best_gk: { label: "Τερμ.", title: "Βραβεία καλύτερου τερματοφύλακα" },
};

const CARDS = [
  { index: 6, one: "κίτρινη κάρτα", many: "κίτρινες κάρτες", color: "#E8B931" },
  { index: 7, one: "κόκκινη κάρτα", many: "κόκκινες κάρτες", color: "#ef4444" },
  { index: 8, one: "μπλε κάρτα", many: "μπλε κάρτες", color: "#60a5fa" },
] as const;

function CardGlyph({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-4 w-3 shrink-0 rounded-[2px]" style={{ background: color }} />;
}

/** The cards a player was shown, as coloured glyphs with a count; `none` when there are none. */
function Cards({ stats, none }: { stats: StatTuple; none: React.ReactNode }) {
  const shown = CARDS.filter((card) => stats[card.index] > 0);
  if (shown.length === 0) return <>{none}</>;
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
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

// ── The table ───────────────────────────────────────────────────────────

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
              className={`pb-3 pt-1 text-center tabular-nums ${
                value === 0 ? "font-normal text-[#F3EFE6]/30" : key === "goals" ? "text-[#fb923c]" : ""
              }`}
            >
              {value === 0 ? "–" : value}
            </td>
          );
        })}
        <td className="pb-3 pt-1 text-center text-[15px] font-normal">
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
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="text-[13px] text-[#F3EFE6]/65">
            {STAT_KEYS.map((key) => (
              <th key={key} scope="col" className="pb-2 text-center font-normal">
                {COLUMNS[key].title ? (
                  <abbr title={COLUMNS[key].title} className="no-underline">
                    {COLUMNS[key].label}
                  </abbr>
                ) : (
                  COLUMNS[key].label
                )}
              </th>
            ))}
            <th scope="col" className="pb-2 text-center font-normal">
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

// The card's gold: the section continues its material instead of starting a new one.
const GOLD_BAR = "linear-gradient(90deg, #B8860B 0%, #D4AF37 45%, #FFE08A 100%)";

/** How far along the season's best a value is; a sliver at least, so a 1 still shows. */
const reachOf = (value: number, best: number) => (best > 0 ? Math.max(0.03, value / best) : 0);

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

// ── The section ─────────────────────────────────────────────────────────

export default function SeasonStats({
  seasonLabel,
  season,
  standing,
  teams,
  tournaments,
  history,
  settleAt,
}: {
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
  /** `performance.now()` time before which nothing should move (the profile is still arriving). */
  settleAt: number;
}) {
  const title = seasonLabel ? `Σεζόν ${seasonLabel}` : "Τρέχουσα σεζόν";
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
          <p className="mt-3 text-[15px] text-[#F3EFE6]/75">Δεν έχει καταγραφεί συμμετοχή σε αγώνα αυτή τη σεζόν.</p>
        </section>
      )}
      {history.length > 0 && <OneTable caption="Προηγούμενες σεζόν" lines={history} />}
    </>
  );
}
