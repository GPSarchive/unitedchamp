// The server part of the «Αγώνες» tab: shapes the matches (postponed matches
// left out, a knockout match named by its round, never a matchday) and draws
// each knockout stage's tree, then hands everything to MatchesClient as plain
// data, so the page stays ISR. Also drawn on the first tab while a tournament
// has neither a table nor a tree.
import { nowWallClockIso } from "@/app/lib/datetime";
import type { Base } from "@/app/preview/tournaments-v3/[id]/data";
import { buildBracket, matchNote } from "@/app/preview/tournaments-v3/[id]/model";
import KnockoutTree from "../BracketView";
import { labelContext } from "../labels";
import { teamsWithMatches, type StageInfo, type ViewMatch } from "./model";
import { stageStates, stageTitle } from "../stages";
import MatchesClient from "./MatchesClient";

export default function MatchesTab({ base }: { base: Base }) {
  const ctx = labelContext(base);
  const states = stageStates(base);
  const listed = base.matches.filter((m) => m.status !== "postponed");

  const withMatches = base.stages.filter((s) => listed.some((m) => m.stageId === s.id));
  // Two stages called the same («Νοκ άουτ» twice, when neither was named) are told apart by a number, in playing order.
  const titles = withMatches.map(stageTitle);
  const named = (index: number) => {
    const same = titles.filter((t) => t === titles[index]).length;
    return same > 1 ? `${titles[index]} ${titles.slice(0, index + 1).filter((t) => t === titles[index]).length}` : titles[index];
  };
  const stages: StageInfo[] = withMatches.map((s, index) => ({
    id: s.id,
    n: index + 1,
    title: named(index),
    state: states.get(s.id) ?? "next",
  }));
  const stageIndex = new Map(stages.map((s, index) => [s.id, index]));

  // A match with no date yet is not listed (owner, 2026-11-16); the knockout trees below still draw every tie.
  const matches: ViewMatch[] = listed.filter((m) => m.date).map((m) => ({
    m,
    stage: m.stageId != null ? (stageIndex.get(m.stageId) ?? -1) : -1,
    round: m.ko ? ctx.knockout.get(m.id)?.name || null : null,
    note: matchNote(m, ctx),
  }));

  const trees = withMatches
    .filter((s) => s.kind === "knockout")
    .map((s) => ({ stage: stages[stageIndex.get(s.id)!], bracket: buildBracket(listed.filter((m) => m.stageId === s.id)) }))
    .filter((t) => t.bracket !== null);

  return (
    <MatchesClient
      matches={matches}
      stages={stages}
      teams={teamsWithMatches(base.teams, matches)}
      serverNow={nowWallClockIso()}
      trees={
        trees.length > 0 ? (
          <div className="grid gap-10">
            {trees.map(({ stage, bracket }) => (
              <section key={stage.id} aria-labelledby={`tree-${stage.id}`} className="min-w-0">
                <h2 id={`tree-${stage.id}`} className="mb-3 text-lg font-bold leading-tight">
                  {stage.title}
                </h2>
                {/* The tree's own frame, quietened: no heavy border, the same flat surface as the match list. */}
                <div className="[&>*]:rounded-xl [&>*]:border-0! [&>*]:bg-[#12121e]!">
                  <KnockoutTree bracket={bracket!} championId={base.winner?.id ?? null} />
                </div>
              </section>
            ))}
          </div>
        ) : null
      }
    />
  );
}
