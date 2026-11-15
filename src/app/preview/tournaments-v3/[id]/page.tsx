// The tournament's first tab: its table — every league and group table, the
// latest stage first — with the next matches and the latest results beside it.
// A tournament that is only a knockout shows its tree here instead; one that
// has neither yet shows its matches.
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowWallClockIso } from "@/app/lib/datetime";
import BracketView from "./BracketView";
import { loadBase, loadTables } from "./data";
import MatchesView, { labelContext } from "./MatchesView";
import { matchNote, roundLabel, splitMatches, type LabelContext, type StageTables, type TMatch } from "./model";
import { TOURNAMENT_PATH } from "./paths";
import { FOCUS, MatchRow, StandingsTable, parseId, type When } from "./ui";

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

function Stage({ stage, named }: { stage: StageTables; named: boolean }) {
  const note = qualifiers(stage);
  const side = stage.tables.length > 1;
  return (
    <section aria-labelledby={`stage-${stage.stage.id}`} className="min-w-0">
      <h2 id={`stage-${stage.stage.id}`} className={named ? "mb-3 text-2xl font-bold italic" : "sr-only"}>
        {named ? stage.stage.name : "Βαθμολογία"}
      </h2>
      <div className={side ? "grid gap-x-8 gap-y-8 sm:grid-cols-2" : ""}>
        {stage.tables.map((table) => (
          <div key={table.key} className="min-w-0">
            {table.groupName ? <h3 className="border-b-2 border-[#fb923c] pb-1.5 text-[17px] font-bold">{table.groupName}</h3> : null}
            <StandingsTable
              table={table}
              caption={[stage.stage.name, table.groupName].filter(Boolean).join(", ")}
              advancers={stage.stage.advancers}
              compact={side}
            />
          </div>
        ))}
      </div>
      {note ? <p className="mt-3 max-w-xl text-[13px] leading-snug text-[#F3EFE6]/65">{note}</p> : null}
    </section>
  );
}

function Beside({
  id,
  title,
  matches,
  when,
  empty,
  ctx,
}: {
  id: string;
  title: string;
  matches: TMatch[];
  when: When;
  empty: string;
  ctx: LabelContext;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="border-b-2 border-[#fb923c] pb-2 text-xl font-bold italic">
        {title}
      </h2>
      {matches.length === 0 ? (
        <p className="py-4 text-[15px] text-[#F3EFE6]/65">{empty}</p>
      ) : (
        <ul>
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              when={when}
              note={[roundLabel(m, ctx), matchNote(m, ctx)].filter(Boolean).join(", ") || null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  const stages = await loadTables(id);

  if (stages.length === 0) {
    return base.stages.some((s) => s.kind === "knockout") ? <BracketView base={base} /> : <MatchesView base={base} />;
  }

  const ctx = labelContext(base);
  const lists = splitMatches(base.matches, nowWallClockIso());
  const toCome = lists.upcoming.length + lists.awaiting.length + lists.postponed.length + lists.undated.length;
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="grid min-w-0 content-start gap-12">
        {/* The stage being played first; the ones before it underneath. */}
        {[...stages].reverse().map((stage) => (
          <Stage key={stage.stage.id} stage={stage} named={stages.length > 1} />
        ))}
      </div>

      <aside className="grid min-w-0 content-start gap-10">
        {/* A tournament with nothing left to play has no "next". */}
        {toCome > 0 ? (
          <Beside
            id="next"
            title="Επόμενοι αγώνες"
            matches={lists.upcoming.slice(0, BESIDE)}
            when="datetime"
            empty="Δεν υπάρχουν αγώνες με ημερομηνία."
            ctx={ctx}
          />
        ) : null}
        <Beside
          id="latest"
          title="Τελευταία αποτελέσματα"
          matches={lists.results.slice(0, BESIDE)}
          when="date"
          empty="Δεν έχει παιχτεί ακόμα αγώνας."
          ctx={ctx}
        />
        <p>
          <Link
            href={`${TOURNAMENT_PATH}/${base.id}/matches`}
            scroll={false}
            className={`inline-flex h-11 items-center border border-[#F3EFE6]/25 px-5 text-[15px] hover:border-[#fb923c] hover:text-[#fb923c] ${FOCUS}`}
          >
            Όλοι οι αγώνες
          </Link>
        </p>
      </aside>
    </div>
  );
}
