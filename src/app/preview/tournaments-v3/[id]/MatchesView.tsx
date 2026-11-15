// The tournament's matches: what is still to be played on one side, what has
// been played on the other. Fixtures with a date go by day; everything else
// goes by round — a league matchday or a knockout round — so a match played
// late still sits with its matchday. Rounds open and close; the two latest
// start open.
import { formatMatchDate, nowWallClockIso } from "@/app/lib/datetime";
import type { Base } from "./data";
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
} from "./model";
import { FOCUS, MatchRow, plural, type When } from "./ui";

const LONG_DAY = { weekday: "long", day: "numeric", month: "long" } as const;

/** How many rounds of results start open. */
const OPEN_ROUNDS = 2;
/** How many days of the programme show at once; the rest sit behind «Υπόλοιπο πρόγραμμα». */
const OPEN_DAYS = 3;

const MORE =
  "mt-4 inline-flex h-11 cursor-pointer list-none items-center border border-[#F3EFE6]/25 px-5 text-[15px] hover:border-[#fb923c] hover:text-[#fb923c] group-open:hidden [&::-webkit-details-marker]:hidden";

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

function Rows({ matches, when, ctx }: { matches: TMatch[]; when: When; ctx: LabelContext }) {
  return (
    <ul>
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} when={when} note={matchNote(m, ctx)} />
      ))}
    </ul>
  );
}

/** A round that opens and closes: its name, how many matches, and the matches. */
function Round({ group, when, ctx, open }: { group: MatchGroup; when: When; ctx: LabelContext; open: boolean }) {
  return (
    <details open={open} className="group border-b border-[#F3EFE6]/15">
      <summary
        className={`flex cursor-pointer list-none items-center gap-3 py-3 hover:text-[#fb923c] [&::-webkit-details-marker]:hidden ${FOCUS}`}
      >
        <h3 className="min-w-0 flex-1 text-[17px] font-bold">{group.title}</h3>
        <span className="shrink-0 text-[13px] text-[#F3EFE6]/65">{plural(group.matches.length, "αγώνας", "αγώνες")}</span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="h-3 w-3 shrink-0 text-[#F3EFE6]/65 transition-transform group-open:rotate-180"
        >
          <path d="M1.5 4 6 8.5 10.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </summary>
      <div className="pb-3">
        <Rows matches={group.matches} when={when} ctx={ctx} />
      </div>
    </details>
  );
}

function Heading({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-[#fb923c] pb-2">
      <h2 id={id} className="text-2xl font-bold italic">
        {title}
      </h2>
      {note ? <span className="shrink-0 text-[13px] text-[#F3EFE6]/65">{note}</span> : null}
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
    <div key={group.key} className="mt-5">
      <h3 className="text-[15px] text-[#F3EFE6]/75 first-letter:uppercase">
        {formatMatchDate(group.title, LONG_DAY)}
      </h3>
      <Rows matches={group.matches} when="time" ctx={ctx} />
    </div>
  );

  return (
    <div className={`grid gap-x-12 gap-y-10 ${both ? "lg:grid-cols-2" : ""}`}>
      {/* On a phone the two lists are one under the other: a way straight to the second. */}
      {both ? (
        <p className="-mb-4 text-[15px] lg:hidden">
          <a
            href="#results"
            className={`text-[#F3EFE6]/80 underline decoration-[#fb923c] decoration-2 underline-offset-4 hover:text-[#fb923c] ${FOCUS}`}
          >
            Στα αποτελέσματα
          </a>
        </p>
      ) : null}

      {toCome > 0 ? (
        <section aria-labelledby="programme" className="min-w-0">
          <Heading
            id="programme"
            title="Πρόγραμμα"
            note={lists.upcoming.length > 0 ? plural(lists.upcoming.length, "αγώνας", "αγώνες") : undefined}
          />

          {days.length === 0 ? (
            <p className="py-5 text-[15px] text-[#F3EFE6]/65">Δεν υπάρχουν αγώνες με ημερομηνία.</p>
          ) : (
            <>
              {days.slice(0, OPEN_DAYS).map(day)}
              {laterDays.length > 0 ? (
                <details className="group">
                  <summary className={`${MORE} ${FOCUS}`}>
                    Υπόλοιπο πρόγραμμα (
                    {plural(
                      laterDays.reduce((n, d) => n + d.matches.length, 0),
                      "αγώνας",
                      "αγώνες",
                    )}
                    )
                  </summary>
                  {laterDays.map(day)}
                </details>
              ) : null}
            </>
          )}

          {lists.awaiting.length > 0 ? (
            <div className="mt-9">
              <h3 className="text-[17px] font-bold">Αναμένεται το αποτέλεσμα</h3>
              <Rows matches={lists.awaiting} when="datetime" ctx={ctx} />
            </div>
          ) : null}

          {lists.postponed.length > 0 ? (
            <div className="mt-9">
              <h3 className="text-[17px] font-bold">Αναβλήθηκαν</h3>
              <p className="mt-1 text-[13px] text-[#F3EFE6]/65">Η νέα ημερομηνία θα ανακοινωθεί.</p>
              {groupByRound(lists.postponed, ctx, stageOrder, false).map((group) => (
                <Round key={group.key} group={group} when="none" ctx={ctx} open />
              ))}
            </div>
          ) : null}

          {lists.undated.length > 0 ? (
            <div className="mt-9">
              <h3 className="text-[17px] font-bold">Χωρίς ημερομηνία ακόμα</h3>
              {groupByRound(lists.undated, ctx, stageOrder, false).map((group, index) => (
                <Round key={group.key} group={group} when="none" ctx={ctx} open={index === 0} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {lists.results.length > 0 ? (
        <section aria-labelledby="results" className="min-w-0 scroll-mt-4">
          <Heading id="results" title="Αποτελέσματα" note={plural(lists.results.length, "αγώνας", "αγώνες")} />
          {results.map((group, index) => (
            <Round key={group.key} group={group} when="date" ctx={ctx} open={index < OPEN_ROUNDS} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
