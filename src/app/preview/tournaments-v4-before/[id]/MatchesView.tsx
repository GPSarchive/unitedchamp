// The tournament's matches: what is still to be played on one side, what has
// been played on the other. Fixtures with a date go by day; everything else
// goes by round — a league matchday or a knockout round — so a match played
// late still sits with its matchday. Rounds open and close; the two latest
// start open. Every day and every round is a panel of its own.
import { formatMatchDate, nowWallClockIso } from "@/app/lib/datetime";
import type { Base } from "../../tournaments-v3/[id]/data";
import {
  buildBracket,
  groupByDay,
  groupByRound,
  knockoutRounds,
  matchNote,
  splitMatches,
  type KnockoutRound,
  type LabelContext,
  type MatchGroup,
  type TMatch,
} from "../../tournaments-v3/[id]/model";
import { BUTTON, FOCUS, LABEL } from "./tokens";
import { Chevron, MatchRow, Panel, Rubric, plural } from "./ui";

const LONG_DAY = { weekday: "long", day: "numeric", month: "long" } as const;

/** How many rounds of results start open. */
const OPEN_ROUNDS = 2;
/** How many days of the programme show at once; the rest sit behind «Υπόλοιπο πρόγραμμα». */
const OPEN_DAYS = 3;

const matchesOf = (n: number) => plural(n, "αγώνας", "αγώνες");

/** What a match's round is called: a knockout match's comes from its stage's tree. */
export function labelContext(base: Base): LabelContext {
  const knockout = new Map<number, KnockoutRound>();
  for (const stage of base.stages) {
    if (stage.kind !== "knockout") continue;
    const bracket = buildBracket(base.matches.filter((m) => m.stageId === stage.id));
    if (bracket) for (const [matchId, round] of knockoutRounds(bracket)) knockout.set(matchId, round);
  }
  return { stages: new Map(base.stages.map((s) => [s.id, s])), knockout };
}

function Rows({ matches, day, ctx }: { matches: TMatch[]; day: boolean; ctx: LabelContext }) {
  return (
    <ul>
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} day={day} note={matchNote(m, ctx)} />
      ))}
    </ul>
  );
}

/** A round that opens and closes: its name and how many matches on the strip, the matches under it. */
function Round({ group, day, ctx, open }: { group: MatchGroup; day: boolean; ctx: LabelContext; open: boolean }) {
  return (
    <details open={open} className="group border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
      <summary
        className={`flex cursor-pointer list-none items-center gap-3 bg-[#13131d] px-4 py-3 hover:text-[#fb923c] md:px-5 [&::-webkit-details-marker]:hidden ${FOCUS}`}
      >
        <h3 className={`${LABEL} min-w-0 flex-1`}>{group.title}</h3>
        <span className={`${LABEL} shrink-0 text-[#F3EFE6]/60`}>{matchesOf(group.matches.length)}</span>
        <Chevron className="text-[#F3EFE6]/65" />
      </summary>
      <div className="border-t-2 border-[#F3EFE6]/20">
        <Rows matches={group.matches} day={day} ctx={ctx} />
      </div>
    </details>
  );
}

/** A smaller heading inside the programme: what kind of unplayed matches follow. */
function Sub({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 mt-10">
      <h3 className="text-2xl font-bold italic leading-tight">{title}</h3>
      {note ? <p className="mt-1 text-[15px] text-[#F3EFE6]/65">{note}</p> : null}
    </div>
  );
}

export default function MatchesView({ base }: { base: Base }) {
  const ctx = labelContext(base);
  const stageOrder = base.stages.map((s) => s.id);
  const lists = splitMatches(base.matches, nowWallClockIso());
  const days = groupByDay(lists.upcoming);
  const results = groupByRound(lists.results, ctx, stageOrder, true);
  const toCome = lists.upcoming.length + lists.awaiting.length + lists.postponed.length + lists.undated.length;

  if (toCome + lists.results.length === 0) {
    return <p className="text-[17px] text-[#F3EFE6]/70">Οι αγώνες της διοργάνωσης δεν έχουν οριστεί ακόμα.</p>;
  }

  const both = toCome > 0 && lists.results.length > 0;
  const laterDays = days.slice(OPEN_DAYS);
  const day = (group: MatchGroup) => (
    <Panel
      key={group.key}
      title={formatMatchDate(group.title, LONG_DAY)}
      meta={matchesOf(group.matches.length)}
      className="min-w-0"
    >
      <Rows matches={group.matches} day={false} ctx={ctx} />
    </Panel>
  );

  return (
    <div className={`grid gap-x-10 gap-y-14 ${both ? "lg:grid-cols-2" : ""}`}>
      {/* On a phone the two lists are one under the other: a way straight to the second. */}
      {both ? (
        <p className="-mb-8 lg:hidden">
          <a href="#results" className={BUTTON}>
            Στα αποτελέσματα
          </a>
        </p>
      ) : null}

      {toCome > 0 ? (
        <section aria-labelledby="programme" className="min-w-0">
          <Rubric
            id="programme"
            title="Πρόγραμμα"
            meta={lists.upcoming.length > 0 ? matchesOf(lists.upcoming.length) : null}
          />

          {days.length === 0 ? (
            <p className="text-[15px] text-[#F3EFE6]/65">Δεν υπάρχουν αγώνες με ημερομηνία.</p>
          ) : (
            <div className="grid gap-4">
              {days.slice(0, OPEN_DAYS).map(day)}
              {laterDays.length > 0 ? (
                <details className="group grid gap-4">
                  <summary
                    className={`${BUTTON} w-max cursor-pointer list-none group-open:hidden [&::-webkit-details-marker]:hidden`}
                  >
                    Υπόλοιπο πρόγραμμα ({matchesOf(laterDays.reduce((n, d) => n + d.matches.length, 0))})
                  </summary>
                  <div className="grid gap-4">{laterDays.map(day)}</div>
                </details>
              ) : null}
            </div>
          )}

          {lists.awaiting.length > 0 ? (
            <>
              <Sub title="Αναμένεται το αποτέλεσμα" />
              <Panel>
                <Rows matches={lists.awaiting} day ctx={ctx} />
              </Panel>
            </>
          ) : null}

          {lists.postponed.length > 0 ? (
            <>
              <Sub title="Αναβλήθηκαν" note="Η νέα ημερομηνία θα ανακοινωθεί." />
              <div className="grid gap-3">
                {groupByRound(lists.postponed, ctx, stageOrder, false).map((group) => (
                  <Round key={group.key} group={group} day={false} ctx={ctx} open />
                ))}
              </div>
            </>
          ) : null}

          {lists.undated.length > 0 ? (
            <>
              <Sub title="Χωρίς ημερομηνία ακόμα" />
              <div className="grid gap-3">
                {groupByRound(lists.undated, ctx, stageOrder, false).map((group, index) => (
                  <Round key={group.key} group={group} day={false} ctx={ctx} open={index === 0} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {lists.results.length > 0 ? (
        <section aria-labelledby="results" className="min-w-0 scroll-mt-4">
          <Rubric id="results" title="Αποτελέσματα" meta={matchesOf(lists.results.length)} />
          <div className="grid gap-3">
            {results.map((group, index) => (
              <Round key={group.key} group={group} day ctx={ctx} open={index < OPEN_ROUNDS} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
