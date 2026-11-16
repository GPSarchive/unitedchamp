// The tournament's first tab: its table — every league and group table, the
// latest stage first — with the next matches and the latest results beside it.
// Under the table of the stage being played (a single table): the course of
// its top four teams (drawn by tournaments-v4's teams/TopTeams).
// A tournament that is only a knockout shows its tree here instead; one that
// has neither yet shows its matches.
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowWallClockIso } from "@/app/lib/datetime";
import { loadBase, loadTables } from "../../tournaments-v3/[id]/data";
import {
  matchNote,
  roundLabel,
  splitMatches,
  type LabelContext,
  type StageTables,
  type TMatch,
} from "../../tournaments-v3/[id]/model";
import BracketView from "./BracketView";
import MatchesView, { labelContext } from "./MatchesView";
import TopTeams from "@/app/tournaments/[id]/(tabs)/teams/TopTeams";
import { loadColours } from "./extra";
import { TOURNAMENT_PATH } from "./paths";
import { BUTTON } from "./tokens";
import { MatchRow, Panel, Rubric, StandingsTable, parseId, plural } from "./ui";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

/** How many matches each of the two side lists shows. */
const BESIDE = 5;

function qualifiers(stage: StageTables): string | null {
  const n = stage.stage.advancers;
  if (n === null) return null;
  // Nothing to say when everybody goes through.
  if (stage.tables.every((t) => n >= t.rows.length)) return null;
  const who = n === 1 ? "η πρώτη" : `οι ${n} πρώτες`;
  const verb = n === 1 ? "προκρίνεται" : "προκρίνονται";
  return stage.tables.length > 1
    ? `Από κάθε όμιλο ${verb} ${who} στα νοκ άουτ: όσες είναι πάνω από τη διακεκομμένη γραμμή.`
    : `Στα νοκ άουτ ${verb} ${who}: όσες είναι πάνω από τη διακεκομμένη γραμμή.`;
}

function Stage({ stage, named, under }: { stage: StageTables; named: boolean; under?: React.ReactNode }) {
  const note = qualifiers(stage);
  const side = stage.tables.length > 1;
  const teams = stage.tables.reduce((n, t) => n + t.rows.length, 0);
  return (
    <section aria-labelledby={`stage-${stage.stage.id}`} className="min-w-0">
      <Rubric
        id={`stage-${stage.stage.id}`}
        // The stage's own name only when the tournament has more than one table stage.
        kicker={named ? (side ? "Όμιλοι" : "Πρωτάθλημα") : null}
        title={named ? stage.stage.name : "Βαθμολογία"}
        meta={plural(teams, "ομάδα", "ομάδες")}
      />
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
      {note ? <p className="mt-4 max-w-xl text-[15px] leading-snug text-[#F3EFE6]/70">{note}</p> : null}
      {under}
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
    <section aria-labelledby={id}>
      <Panel id={id} heading="h2" title={title}>
        {matches.length === 0 ? (
          <p className="px-4 py-5 text-[15px] text-[#F3EFE6]/65 md:px-5">{empty}</p>
        ) : (
          <ul>
            {matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                day
                note={[roundLabel(m, ctx), matchNote(m, ctx)].filter(Boolean).join(", ") || null}
              />
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  const [stages, colours] = await Promise.all([loadTables(id), loadColours(id)]);

  if (stages.length === 0) {
    return base.stages.some((s) => s.kind === "knockout") ? <BracketView base={base} /> : <MatchesView base={base} />;
  }

  const ctx = labelContext(base);
  const lists = splitMatches(base.matches, nowWallClockIso());
  const toCome = lists.upcoming.length + lists.awaiting.length + lists.postponed.length + lists.undated.length;
  return (
    <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="grid min-w-0 content-start gap-14">
        {/* The stage being played first; the ones before it underneath. */}
        {[...stages].reverse().map((stage) => (
          <Stage
            key={stage.stage.id}
            stage={stage}
            named={stages.length > 1}
            under={
              // The latest table stage, when it is one table (a league, not groups): its top teams' course.
              stage === stages.at(-1) && stage.tables.length === 1 ? (
                <TopTeams
                  stage={stage}
                  matches={base.matches}
                  colours={colours}
                  championId={base.winner?.id ?? null}
                  headingId={`top-${stage.stage.id}`}
                />
              ) : null
            }
          />
        ))}
      </div>

      <aside className="grid min-w-0 content-start gap-6 lg:pt-2">
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
