// The tournament's matches, stage by stage in playing order (the same numbered
// stages as the first tab). A table stage lists its rounds — matchdays —
// each a panel that opens and closes, played and unplayed matches together;
// the latest round with a result and the next one to be played start open.
// A knockout stage is drawn as its tree, with the same matches as a list
// under it. Postponed matches are not listed.
import type { Base } from "../../tournaments-v3/[id]/data";
import {
  buildBracket,
  groupByRound,
  knockoutRounds,
  matchNote,
  type KnockoutRound,
  type LabelContext,
  type MatchGroup,
  type TMatch,
} from "../../tournaments-v3/[id]/model";
import KnockoutTree from "./BracketView";
import { StageDisc, StageRail, stageStates, stageTitle } from "./stages";
import { FOCUS, LABEL, NAME } from "./tokens";
import { Chevron, MatchRow, Panel, Rubric, plural } from "./ui";

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
    <details open={open} className="group border-2 border-[#F3EFE6]/20 bg-[#0e0e1a]">
      <summary
        className={`flex cursor-pointer list-none items-baseline gap-3 bg-[#151522] px-4 py-3 transition-colors hover:text-[#fb923c] md:px-5 [&::-webkit-details-marker]:hidden ${FOCUS}`}
      >
        <h3 className={`${NAME} min-w-0 flex-1 first-letter:uppercase`}>{group.title}</h3>
        <span className={`${LABEL} shrink-0 text-[#F3EFE6]/65`}>{matchesOf(group.matches.length)}</span>
        <Chevron className="self-center text-[#F3EFE6]/65" />
      </summary>
      <div className="border-t border-[#F3EFE6]/20">
        <Rows matches={group.matches} day={day} ctx={ctx} />
      </div>
    </details>
  );
}

/** The rounds of one stage, in playing order, each a panel that opens and closes. */
function Rounds({ groups, ctx, open }: { groups: MatchGroup[]; ctx: LabelContext; open: (index: number) => boolean }) {
  return (
    <div className="grid gap-3">
      {groups.map((group, index) => (
        <Round key={group.key} group={group} day ctx={ctx} open={open(index)} />
      ))}
    </div>
  );
}

export default function MatchesView({ base }: { base: Base }) {
  const ctx = labelContext(base);
  const stageOrder = base.stages.map((s) => s.id);
  // Postponed matches are left out, as on the live page: the ones in the data
  // are old rows that were never tidied up, not matches waiting for a date.
  const matches = base.matches.filter((m) => m.status !== "postponed");
  const states = stageStates(base);

  const blocks = base.stages
    .map((stage) => {
      const own = matches.filter((m) => m.stageId === stage.id);
      return {
        stage,
        state: states.get(stage.id) ?? ("next" as const),
        matches: own,
        // Under its own stage heading a round does not repeat the stage's name.
        groups: groupByRound(own, ctx, stageOrder, false).map((g) => ({
          ...g,
          title: g.title.startsWith(stage.name + ", ") ? g.title.slice(stage.name.length + 2) : g.title,
        })),
        bracket: stage.kind === "knockout" ? buildBracket(own) : null,
      };
    })
    .filter((b) => b.matches.length > 0);
  // Matches entered without a stage: listed last, on their own.
  const loose = matches.filter((m) => m.stageId === null || !stageOrder.includes(m.stageId));

  if (blocks.length === 0 && loose.length === 0) {
    return <p className="text-[17px] text-[#F3EFE6]/70">Οι αγώνες της διοργάνωσης δεν έχουν οριστεί ακόμα.</p>;
  }

  const many = blocks.length > 1;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 md:gap-14">
      {many ? <StageRail stages={blocks} /> : null}

      {blocks.map((block, index) => {
        const { stage, groups, bracket } = block;
        // In a table stage two rounds start open: the latest one with a result and the first one still to be played.
        const played = groups.map((g) => g.matches.some((m) => m.status === "finished")).lastIndexOf(true);
        const toPlay = groups.findIndex((g) => g.matches.some((m) => m.status !== "finished"));
        return (
          // The margin clears the site's fixed top bar when the rail leads here.
          <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="min-w-0 scroll-mt-24 md:scroll-mt-40">
            <Rubric
              id={`stage-${stage.id}`}
              mark={many ? <StageDisc n={index + 1} state={block.state} /> : undefined}
              title={many ? stageTitle(stage) : "Αγώνες"}
              meta={matchesOf(block.matches.length)}
            />
            {bracket ? (
              // A knockout stage is its tree (every tie opens its match); the same matches as a list sit under it, closed.
              <div className="grid gap-5">
                <KnockoutTree bracket={bracket} championId={base.winner?.id ?? null} />
                <Rounds groups={groups} ctx={ctx} open={() => false} />
              </div>
            ) : (
              <div className="max-w-3xl">
                <Rounds groups={groups} ctx={ctx} open={(i) => i === played || i === toPlay} />
              </div>
            )}
          </section>
        );
      })}

      {loose.length > 0 ? (
        <section aria-labelledby="loose" className="min-w-0">
          <Rubric id="loose" title={blocks.length > 0 ? "Άλλοι αγώνες" : "Αγώνες"} meta={matchesOf(loose.length)} />
          <Panel className="max-w-3xl">
            <Rows matches={loose} day ctx={ctx} />
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
