// The tournament's first tab: its stages, in the order they are played —
// a groups stage as its tables, a knockout stage as its tree — one under the
// other, first stage first, with a rail on top that numbers them left to
// right (1 → 2 → 3) and leads to each. So a reader sees that the knockout came
// after the groups, and where the tournament is now, without reading it.
// Beside them: the next matches and the latest results. Under the table of
// the stage being played (a single table): the course of its top four teams.
//
// A tournament of one stage shows just that stage; one with no table and no
// tree yet shows its matches.
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowWallClockIso } from "@/app/lib/datetime";
import { loadBase, loadTables } from "@/app/preview/tournaments-v3/[id]/data";
import {
  buildBracket,
  matchNote,
  splitMatches,
  type Bracket,
  type LabelContext,
  type StageTables,
  type TMatch,
  type TStage,
} from "@/app/preview/tournaments-v3/[id]/model";
import KnockoutTree from "./BracketView";
import MatchesTab from "./matches/MatchesTab";
import { labelContext, roundNote } from "./labels";
import { loadColours } from "./extra";
import { TOURNAMENT_PATH } from "./paths";
import { StageDisc, StageRail, stageStates, stageTitle, type StageState } from "./stages";
import TopTeams from "./teams/TopTeams";
import { BUTTON } from "./tokens";
import { MatchRow, Panel, Rubric, StandingsTable, parseId, plural } from "./ui";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

/** How many matches each of the two side lists shows. */
const BESIDE = 5;

/** One stage as it is drawn: its tables, its tree, or (a knockout whose pairs are not known yet) neither. */
type Block = { stage: TStage; state: StageState; tables: StageTables | null; bracket: Bracket | null };

function Tables({ stage }: { stage: StageTables }) {
  const side = stage.tables.length > 1;
  return (
    <div className={side ? "grid gap-6 xl:grid-cols-2" : ""}>
      {stage.tables.map((table) => (
        <Panel
          key={table.key}
          title={table.groupName}
          meta={table.groupName ? plural(table.rows.length, "ομάδα", "ομάδες") : null}
          className="min-w-0"
        >
          <StandingsTable
            table={table}
            caption={[stage.stage.name, table.groupName].filter(Boolean).join(", ")}
            advancers={stage.stage.advancers}
            compact={side}
          />
        </Panel>
      ))}
    </div>
  );
}

function StageSection({
  block,
  number,
  championId,
  under,
}: {
  block: Block;
  /** Drawn under the stage's table: its top teams' course. */
  under?: React.ReactNode;
  /** Its place in the order, when the tournament has more than one stage. */
  number: number | null;
  championId: number | null;
}) {
  const { stage, tables, bracket } = block;
  const teams = tables ? tables.tables.reduce((n, t) => n + t.rows.length, 0) : 0;
  return (
    // The margin clears the site's fixed top bar when the rail leads here.
    <section aria-labelledby={`stage-${stage.id}`} className="min-w-0 scroll-mt-24 md:scroll-mt-40">
      <Rubric
        id={`stage-${stage.id}`}
        mark={number !== null ? <StageDisc n={number} state={block.state} /> : undefined}
        title={number !== null ? stageTitle(stage) : stage.kind === "knockout" ? "Νοκ άουτ" : "Βαθμολογία"}
        meta={tables ? plural(teams, "ομάδα", "ομάδες") : null}
      />
      {tables ? (
        <>
          <Tables stage={tables} />
          {under}
        </>
      ) : bracket ? (
        <KnockoutTree bracket={bracket} championId={championId} />
      ) : (
        <p className="text-[17px] text-[#F3EFE6]/70">Τα ζευγάρια θα οριστούν όταν ολοκληρωθεί η προηγούμενη φάση.</p>
      )}
    </section>
  );
}

function Beside({
  id,
  title,
  matches,
  empty,
  ctx,
}: {
  id: string;
  title: string;
  matches: TMatch[];
  empty: string;
  ctx: LabelContext;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <Panel id={id} heading="h2" title={title}>
        {matches.length === 0 ? (
          <p className="px-4 py-5 text-[15px] text-[#F3EFE6]/70 md:px-5">{empty}</p>
        ) : (
          <ul>
            {matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                day
                note={[roundNote(m, ctx), matchNote(m, ctx)].filter(Boolean).join(", ") || null}
              />
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}

export default async function StagesPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  const [tables, colours] = await Promise.all([loadTables(id), loadColours(id)]);
  // The latest table stage, when it is one table (a league, not groups), gets its top teams' course under it.
  const latestTable = tables.at(-1);
  const topOf = latestTable && latestTable.tables.length === 1 ? latestTable : null;

  const states = stageStates(base);
  const tablesOf = new Map(tables.map((t) => [t.stage.id, t]));
  // A knockout stage that was set up and never given a match is shown (as the
  // stage to come) only while the tournament is still being played.
  const live = base.winner === null && !base.season?.archived;
  const blocks = base.stages
    .map((stage): Block | null => {
      const state = states.get(stage.id) ?? "next";
      if (stage.kind !== "knockout") {
        const own = tablesOf.get(stage.id) ?? null;
        return own ? { stage, state, tables: own, bracket: null } : null;
      }
      const bracket = buildBracket(base.matches.filter((m) => m.stageId === stage.id));
      return bracket || live ? { stage, state, tables: null, bracket } : null;
    })
    .filter((b): b is Block => b !== null);

  if (!blocks.some((b) => b.tables || b.bracket)) return <MatchesTab base={base} />;

  const many = blocks.length > 1;
  const ctx = labelContext(base);
  const lists = splitMatches(base.matches, nowWallClockIso());
  // Postponed matches are not shown anywhere (see matches/MatchesTab), so they do not count as "to come".
  const toCome = lists.upcoming.length + lists.awaiting.length + lists.undated.length;
  return (
    <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      {/* One column that may not grow past the screen, whatever a stage holds. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-12 md:gap-14">
        {many ? <StageRail stages={blocks} /> : null}
        {blocks.map((block, index) => (
          <StageSection
            key={block.stage.id}
            block={block}
            number={many ? index + 1 : null}
            championId={base.winner?.id ?? null}
            under={
              topOf && topOf.stage.id === block.stage.id ? (
                <TopTeams
                  stage={topOf}
                  matches={base.matches}
                  colours={colours}
                  championId={base.winner?.id ?? null}
                  headingId={`top-${block.stage.id}`}
                />
              ) : null
            }
          />
        ))}
      </div>

      {/* The same: a long name in a match row must not make the side lists wider than the tables. */}
      <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6 lg:pt-1">
        {/* A tournament with nothing left to play, or already won, has no "next". */}
        {lists.upcoming.length > 0 || (toCome > 0 && !base.winner) ? (
          <Beside
            id="next"
            title="Επόμενοι αγώνες"
            matches={lists.upcoming.slice(0, BESIDE)}
            empty="Δεν υπάρχουν αγώνες με ημερομηνία."
            ctx={ctx}
          />
        ) : null}
        <Beside
          id="latest"
          title="Τελευταία αποτελέσματα"
          matches={lists.results.slice(0, BESIDE)}
          empty="Δεν έχει παιχτεί ακόμα αγώνας."
          ctx={ctx}
        />
        <p>
          <Link href={`${TOURNAMENT_PATH}/${base.id}/matches`} scroll={false} className={BUTTON}>
            Όλοι οι αγώνες
          </Link>
        </p>
      </aside>
    </div>
  );
}
