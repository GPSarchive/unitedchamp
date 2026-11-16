// Under the «Βαθμολογία» table: the course of the four teams at the top of it
// (owner, 2026-11-16), as a grid of cards — two across on a phone, four on a
// desk. Each card: the team's colour along the top, its place and crest, its
// name, its points as a filled line climbing match by match with the total at
// the end, its last five results as marks, and its last result.
//
// The four lines share one scale (the most points and the most matches among
// the four), so the cards compare at a glance: a steeper, higher line is the
// better run. Server component; the measures come from ./progress.
import Link from "next/link";
import type { StageTables, TMatch, TTeam } from "../../../tournaments-v3/[id]/model";
import { MATCH_PATH, TEAM_PATH } from "../paths";
import { FOCUS, SAFFRON } from "../tokens";
import { Crest } from "../ui";
import { FormMarks, OutcomeMark } from "./TeamCourse";
import { pointsRun, teamResults, type TeamResult } from "./progress";

/** How many teams from the top of the table. */
const TOP = 4;

const ORANGE = "#fb923c";

/**
 * The points line, filled underneath, from nothing before the first match.
 * `steps` (matches) and `ceiling` (points) are shared by the four cards, so a
 * team that has played fewer matches stops short.
 */
function Spark({ values, steps, ceiling, colour, id }: { values: number[]; steps: number; ceiling: number; colour: string; id: string }) {
  const W = 160;
  const H = 64;
  const pad = 4;
  const x = (i: number) => pad + (i / steps) * (W - 2 * pad);
  const y = (v: number) => pad + (1 - v / ceiling) * (H - 2 * pad);
  const pts = [0, ...values].map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  const base = H - pad;
  const area = `M${pad},${base} L${line.split(" ").join(" L")} L${lx.toFixed(1)},${base} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="block h-auto w-full overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.38" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={W - pad} y1={base} y2={base} stroke="rgb(243 239 230 / 0.18)" strokeWidth={1} />
      <path d={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={colour} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3.5} fill={colour} stroke="#0e0e1a" strokeWidth={1.5} />
    </svg>
  );
}

function Card({
  team,
  rank,
  points,
  results,
  run,
  steps,
  ceiling,
  colour,
  champion,
}: {
  team: TTeam;
  rank: number;
  points: number;
  results: TeamResult[];
  run: number[];
  steps: number;
  ceiling: number;
  colour: string | null;
  champion: boolean;
}) {
  const line = colour ?? ORANGE;
  const last = results.at(-1);
  const form = results.slice(-5).map((r) => r.outcome);
  return (
    <li
      className="flex min-w-0 flex-col border-2 border-[#F3EFE6]/20 bg-[#0e0e1a]"
      style={champion ? { borderColor: SAFFRON } : undefined}
    >
      <span aria-hidden className="block h-1.5" style={{ background: colour ?? "rgb(243 239 230 / 0.2)" }} />
      <Link
        href={`${TEAM_PATH}/${team.id}`}
        className={`block px-3 pt-3 transition-colors hover:text-[#fb923c] md:px-3.5 ${FOCUS}`}
      >
        <span className="flex items-start justify-between gap-2">
          <span
            className={`text-[2.4rem] font-bold italic leading-[0.85] tabular-nums ${rank === 1 ? "text-[#fb923c]" : ""}`}
          >
            {rank}
            <span className="sr-only">η θέση: </span>
          </span>
          <Crest team={team} className="h-10 w-10 text-base" sizes="40px" />
        </span>
        {/* Two lines at most, the same height on every card so the charts line up. */}
        <span className="mt-2.5 block min-h-[2.3em] text-[15px] font-bold italic leading-[1.15] [overflow-wrap:anywhere] line-clamp-2">
          {team.name}
        </span>
      </Link>

      <div className="mt-2 px-3 md:px-3.5">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Spark values={run} steps={steps} ceiling={ceiling} colour={line} id={`spark-${team.id}`} />
          </div>
          <span className="shrink-0 pb-0.5 text-right leading-none">
            <span className="block text-[1.6rem] font-bold tabular-nums">{points}</span>
            <span className="block text-[11px] text-[#F3EFE6]/60">βαθμοί</span>
          </span>
        </div>
        <span className="sr-only">
          Πορεία βαθμών: {run.join(", ")}.
        </span>
      </div>

      {form.length > 0 ? (
        <div className="mt-3 px-3 md:px-3.5">
          <FormMarks outcomes={form} className="h-5 w-5 text-[11px]" />
        </div>
      ) : null}

      {/* Pushes the last result to the card's foot, so the four feet line up. */}
      <span aria-hidden className="block min-h-3 flex-1" />
      {last ? (
        <Link
          href={`${MATCH_PATH}/${last.match.id}`}
          title={`${last.opponent?.name ?? "Αντίπαλος"} ${last.own}–${last.opp}`}
          className={`flex items-center gap-2 border-t border-[#F3EFE6]/15 bg-[#151522] px-3 py-2 transition-colors hover:bg-[#1c1c2b] md:px-3.5 ${FOCUS}`}
        >
          <OutcomeMark outcome={last.outcome} className="h-6 w-6 text-[13px]" />
          <Crest team={last.opponent} className="h-6 w-6 text-[11px]" sizes="24px" />
          <span className="sr-only">Τελευταίος αγώνας με {last.opponent?.name ?? "αντίπαλο"}:</span>
          <span className="ml-auto text-lg font-bold leading-none tabular-nums">
            {last.own}–{last.opp}
          </span>
        </Link>
      ) : null}
    </li>
  );
}

export default function TopTeams({
  stage,
  matches,
  colours,
  championId,
  headingId,
}: {
  /** The table stage whose table is just above: it must have a single table. */
  stage: StageTables;
  matches: TMatch[];
  colours: Map<number, string>;
  championId: number | null;
  headingId: string;
}) {
  const rows = stage.tables[0].rows.slice(0, TOP).filter((row) => row.played > 0);
  if (rows.length === 0) return null;

  const teams = rows.map((row) => {
    const results = teamResults(matches, row.team.id);
    return { row, results, run: pointsRun(results, stage.stage.id) };
  });
  // One scale for all four: the most matches played, the most points (rounded up to a multiple of 3).
  const steps = Math.max(1, ...teams.map((t) => t.run.length));
  const ceiling = Math.max(3, Math.ceil(Math.max(...teams.map((t) => t.run.at(-1) ?? 0)) / 3) * 3);

  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h3 id={headingId} className="sr-only">
        Η πορεία των {rows.length} πρώτων
      </h3>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {teams.map(({ row, results, run }) => (
          <Card
            key={row.team.id}
            team={row.team}
            rank={row.rank}
            points={row.points}
            results={results}
            run={run}
            steps={steps}
            ceiling={ceiling}
            colour={colours.get(row.team.id) ?? null}
            champion={championId === row.team.id}
          />
        ))}
      </ul>
    </section>
  );
}
