// Pieces of a player's profile shared by the v2 player page and the v3
// profile overlay: the season strip and the per-tournament / per-season table.
// No hooks — usable from server and client components alike.
import Link from "next/link";
import type { ProfileStatLine } from "../data";
import { STAT_KEYS, STAT_LABELS, statValue, type StatKey, type StatTuple } from "../model";

export const LINK =
  "underline decoration-[#F3EFE6]/30 underline-offset-4 hover:text-[#fb923c] hover:decoration-[#fb923c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]";

/** Labels of the season strip: short enough to stay on one line per cell. */
const STRIP_LABELS: Record<StatKey, string> = {
  matches: "Αγώνες",
  wins: "Νίκες",
  goals: "Γκολ",
  assists: "Ασίστ",
  mvp: "MVP",
  best_gk: "Καλύτερος τερμ.",
};

const CARDS = [
  { index: 6, label: "Κίτρινες κάρτες", color: "#E8B931" },
  { index: 7, label: "Κόκκινες κάρτες", color: "#ef4444" },
  { index: 8, label: "Μπλε κάρτες", color: "#60a5fa" },
] as const;

function CardGlyph({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-3 rounded-[2px] align-[-2px]"
      style={{ background: color }}
    />
  );
}

function StatCell({ value, lit = false }: { value: number; lit?: boolean }) {
  return (
    <td
      className={`px-2 py-3 text-center tabular-nums ${
        value === 0 ? "text-[#F3EFE6]/35" : lit ? "font-bold text-[#fb923c]" : "text-[#F3EFE6]/90"
      }`}
    >
      {value}
    </td>
  );
}

/** One line per tournament or season, same columns as the directory. */
export function StatTable({
  caption,
  firstColumn,
  lines,
}: {
  caption: string;
  firstColumn: string;
  lines: ProfileStatLine[];
}) {
  // The first column sticks only where the table can scroll sideways (phones);
  // from `sm` up the table fits, so the cell needs no background of its own.
  const sticky = "sticky left-0 bg-[#0a0a14] sm:static sm:bg-transparent";
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">{caption}</h2>
      {/* `relative`: keeps the sr-only (absolute) header labels inside this
          scroller — otherwise they widen the whole page on phones. */}
      <div className="relative mt-3 overflow-x-auto border-y border-[#F3EFE6]/15">
        <table className="w-full min-w-[36rem] table-fixed border-collapse text-[15px]">
          <colgroup>
            <col />
            {[...STAT_KEYS, ...CARDS].map((_, i) => (
              <col key={i} className="w-12 sm:w-14" />
            ))}
          </colgroup>
          <thead>
            <tr className="text-[13px] text-[#F3EFE6]/65">
              <th scope="col" className={`${sticky} py-2.5 pl-1 pr-3 text-left font-normal`}>
                {firstColumn}
              </th>
              {STAT_KEYS.map((key) => (
                <th key={key} scope="col" className="px-2 py-2.5 text-center font-normal">
                  <abbr title={STAT_LABELS[key].title} className="no-underline">
                    {STAT_LABELS[key].short}
                  </abbr>
                </th>
              ))}
              {CARDS.map((card) => (
                <th key={card.index} scope="col" className="px-2 py-2.5 text-center font-normal">
                  <CardGlyph color={card.color} />
                  <span className="sr-only">{card.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key} className="border-t border-[#F3EFE6]/[0.08]">
                <th scope="row" className={`${sticky} py-3 pl-1 pr-3 text-left font-normal`}>
                  {line.href ? (
                    <Link href={line.href} className={LINK}>
                      {line.label}
                    </Link>
                  ) : (
                    line.label
                  )}
                </th>
                {STAT_KEYS.map((key) => (
                  <StatCell key={key} value={statValue(line.stats, key)} lit={key === "goals"} />
                ))}
                {CARDS.map((card) => (
                  <StatCell key={card.index} value={line.stats[card.index]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SeasonStrip({ stats }: { stats: StatTuple }) {
  return (
    <>
      <dl className="mt-3 grid grid-cols-3 border-l border-t border-[#F3EFE6]/15 sm:grid-cols-6">
        {STAT_KEYS.map((key) => {
          const value = statValue(stats, key);
          return (
            <div key={key} className="border-b border-r border-[#F3EFE6]/15 px-3 py-3">
              <dt className="truncate text-[13px] text-[#F3EFE6]/65" title={STAT_LABELS[key].title}>
                {STRIP_LABELS[key]}
              </dt>
              <dd
                className={`mt-1 text-3xl font-bold leading-none tabular-nums ${
                  value === 0 ? "text-[#F3EFE6]/35" : key === "goals" ? "text-[#fb923c]" : ""
                }`}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-[#F3EFE6]/75">
        {CARDS.map((card) => (
          <li key={card.index} className="flex items-center gap-2">
            <CardGlyph color={card.color} />
            <span>
              {card.label}: <span className="font-bold tabular-nums text-[#F3EFE6]">{stats[card.index]}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
