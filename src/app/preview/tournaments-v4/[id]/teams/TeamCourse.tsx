// A team's course through the tournament, shown: where it stands and its last
// five results as marks, its points as a line climbing match by match, its
// last result, and the few rows of the table around it.
//
// The player area's home page shows the same four things for a player's team
// over the season (branch feat/player-profile-area: «Η σεζόν», «Πορεία
// βαθμών», «Τελευταίο αποτέλεσμα», «Βαθμολογία»); these are the same measures
// and the same marks, redrawn for this page. Server components.
import Link from "next/link";
import { formatMatchDate } from "@/app/lib/datetime";
import type { StageTables, TTeam } from "../../../tournaments-v3/[id]/model";
import { MATCH_PATH } from "../paths";
import { FOCUS, LABEL, NAME } from "../tokens";
import { Crest, StandingsTable } from "../ui";
import { pointsRun, record, standingIn, tableWindow, type Outcome, type TeamResult } from "./progress";

// The player area's result colours (--pa-win / --pa-draw / --pa-loss): a state,
// never a decoration, and always with its letter inside.
const OUTCOME: Record<Outcome, { letter: string; word: string; colour: string }> = {
  W: { letter: "Ν", word: "Νίκη", colour: "#3ecf7a" },
  D: { letter: "Ι", word: "Ισοπαλία", colour: "#8d8b88" },
  L: { letter: "Η", word: "Ήττα", colour: "#f0564a" },
};

export function OutcomeMark({ outcome, className = "h-6 w-6 text-[13px]" }: { outcome: Outcome; className?: string }) {
  const { letter, word, colour } = OUTCOME[outcome];
  return (
    <span
      title={word}
      className={`inline-flex shrink-0 items-center justify-center font-black leading-none text-[#0a0a14] ${className}`}
      style={{ background: colour }}
    >
      <span aria-hidden>{letter}</span>
      <span className="sr-only">{word}</span>
    </span>
  );
}

/** The last results as marks, oldest first. */
export function FormMarks({ outcomes, className }: { outcomes: Outcome[]; className?: string }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`Τελευταίοι αγώνες, από τον παλαιότερο: ${outcomes.map((o) => OUTCOME[o].word).join(", ")}`}>
      {outcomes.map((o, i) => (
        <OutcomeMark key={i} outcome={o} className={className} />
      ))}
    </span>
  );
}

function niceMax(v: number): number {
  if (v <= 6) return 6;
  const step = v <= 15 ? 3 : v <= 30 ? 6 : v <= 60 ? 12 : 15;
  return Math.ceil(v / step) * step;
}

/**
 * The team's points after each match as one line climbing left to right, its
 * total written at the end. Every point can be hovered for its match number
 * and points; the numbers are also in the table beside it.
 */
function PointsChart({ values, colour }: { values: number[]; colour: string }) {
  const W = 340;
  const H = 150;
  const pad = { l: 24, r: 30, t: 12, b: 24 };
  const steps = values.length;
  const top = niceMax(Math.max(0, ...values));
  const x = (i: number) => pad.l + (steps === 1 ? 0 : (i / (steps - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const ticks = [0, top / 3, (2 * top) / 3, top].map(Math.round);
  const last = steps - 1;
  const quiet = { fill: "rgb(243 239 230 / 0.65)", fontSize: 11 } as const;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Πορεία βαθμών: ${values[last]} βαθμοί σε ${steps} αγώνες`}
      className="h-auto w-full max-w-[26rem] overflow-visible"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(243 239 230 / 0.12)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" style={quiet}>
            {t}
          </text>
        </g>
      ))}
      <text x={pad.l} y={H - 6} style={quiet}>
        1ος αγώνας
      </text>
      {steps > 1 ? (
        <text x={x(last)} y={H - 6} textAnchor="end" style={quiet}>
          {steps}ος
        </text>
      ) : null}
      <polyline
        points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
        fill="none"
        stroke={colour}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => (
        <g key={i}>
          {/* The dot, ringed in the panel's colour so it stands clear of the line. */}
          <circle cx={x(i)} cy={y(v)} r={i === last ? 4.5 : 3} fill={colour} stroke="#0e0e1a" strokeWidth={i === last ? 2 : 1.5} />
          {/* A larger target than the dot. */}
          <circle cx={x(i)} cy={y(v)} r={10} fill="transparent">
            <title>{`${i + 1}ος αγώνας: ${v} ${v === 1 ? "βαθμός" : "βαθμοί"}`}</title>
          </circle>
        </g>
      ))}
      <text x={x(last) + 9} y={y(values[last]) + 4} style={{ fill: "#F3EFE6", fontWeight: 700, fontSize: 13 }}>
        {values[last]}
      </text>
    </svg>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className={`${LABEL} order-last mt-1.5 text-[#F3EFE6]/65`}>{label}</dt>
      <dd className="text-[1.75rem] font-bold leading-none tabular-nums">{value}</dd>
    </div>
  );
}

const TITLE = `${NAME} mb-2.5 text-[#F3EFE6]/70`;

/**
 * Everything about the team's course in one band: on a phone one thing under
 * the other, on a desk three side by side. Nothing when the team has neither
 * a result nor a place in a table yet.
 */
export default function Progress({
  team,
  results,
  tables,
  colour,
}: {
  team: TTeam;
  /** The team's finished matches in the tournament, earliest first (progress.teamResults). */
  results: TeamResult[];
  /** The tournament's tables, in competition order. */
  tables: StageTables[];
  /** The colour of the team's line: its own, or the site's orange. */
  colour: string;
}) {
  const standing = standingIn(tables, team.id);
  if (results.length === 0 && !standing) return null;
  const run = standing ? pointsRun(results, standing.stage.id) : [];
  const { won, drawn, lost } = standing ? standing.row : record(results);
  const last = results.at(-1);
  const form = results.slice(-5).map((r) => r.outcome);

  return (
    <div className="grid gap-x-8 gap-y-7 border-b border-[#F3EFE6]/20 px-4 py-5 md:px-5 lg:grid-cols-3">
      <div className="min-w-0">
        <dl className="grid grid-cols-3 gap-3">
          {standing ? <Stat value={`${standing.row.rank}η`} label="θέση" /> : null}
          {standing ? <Stat value={standing.row.points} label="βαθμοί" /> : null}
          <Stat value={`${won}-${drawn}-${lost}`} label="νίκες-ισοπαλίες-ήττες" />
        </dl>
        {form.length > 0 ? (
          <p className="mt-4 flex items-center gap-3">
            <span className={`${LABEL} text-[#F3EFE6]/65`}>Τελευταίοι πέντε</span>
            <FormMarks outcomes={form} />
          </p>
        ) : null}
        {last ? (
          <>
            <h4 className={`${TITLE} mt-6`}>Τελευταίο αποτέλεσμα</h4>
            <Link
              href={`${MATCH_PATH}/${last.match.id}`}
              className={`flex items-center gap-3 bg-[#F3EFE6]/[0.05] px-3 py-2.5 transition-colors hover:bg-[#F3EFE6]/[0.09] ${FOCUS}`}
            >
              <OutcomeMark outcome={last.outcome} className="h-9 w-9 text-xl" />
              <Crest team={last.opponent} className="h-7 w-7 text-[13px]" sizes="28px" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold leading-[1.15] [overflow-wrap:anywhere]">
                  {last.opponent?.name ?? "Αντίπαλος"}
                </span>
                <span className={`${LABEL} block text-[#F3EFE6]/65`}>
                  {[
                    last.match.date ? formatMatchDate(last.match.date, { day: "numeric", month: "long" }) : null,
                    last.pens ? `πέναλτι ${last.pens.own}–${last.pens.opp}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </span>
              <span className="shrink-0 text-[1.75rem] font-bold leading-none tabular-nums">
                {last.own}–{last.opp}
              </span>
            </Link>
          </>
        ) : null}
      </div>

      {run.length > 0 ? (
        <div className="min-w-0">
          <h4 className={TITLE}>Πορεία βαθμών</h4>
          <PointsChart values={run} colour={colour} />
        </div>
      ) : null}

      {standing ? (
        <div className="min-w-0">
          <h4 className={TITLE}>Βαθμολογία{standing.table.groupName ? `, ${standing.table.groupName}` : ""}</h4>
          <div className="border border-[#F3EFE6]/20">
            {/* Called as a plain function on purpose, not as <StandingsTable>. As a
                component here — one per team, each handed a freshly cut table —
                it made the dev server run out of memory while packing the page
                (found 2026-11-15: every part rendered once, then the process
                grew past 16 GB). Drawn inline it costs nothing extra. */}
            {StandingsTable({
              table: tableWindow(standing.table, standing.index),
              caption: `Βαθμολογία γύρω από την ομάδα ${team.name}`,
              advancers: null,
              compact: true,
              highlight: team.id,
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
