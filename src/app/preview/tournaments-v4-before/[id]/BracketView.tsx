// The knockout tree: every tie as a small bordered card (two teams, the score
// of each meeting in its own square), each standing level with the middle of
// the two it comes from, with lines joining them. Drawn from the last tie
// backwards (model.buildBracket of tournaments-v3), by plain nested boxes and
// the lines in dispatch.module.css — no measuring, no script, so it is there
// on first paint and prints.
//
// It is as wide as its rounds; on a phone it scrolls sideways inside its panel.
import Link from "next/link";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import type { Base } from "../../tournaments-v3/[id]/data";
import {
  buildBracket,
  isThirdPlace,
  type Bracket,
  type BracketNode,
  type Pair,
  type TTeam,
  type Tie,
} from "../../tournaments-v3/[id]/model";
import styles from "./dispatch.module.css";
import { MATCH_PATH } from "./paths";
import { FOCUS, LABEL } from "./tokens";
import { Crest, Rubric } from "./ui";

const SAFFRON = "#E8B931";

function TieSide({
  team,
  scores,
  won,
  lost,
}: {
  team: TTeam | null;
  /** One per meeting played so far in the tie: this side's goals and whether it won that meeting; null = still to come. */
  scores: ({ goals: number; won: boolean } | null)[];
  won: boolean;
  lost: boolean;
}) {
  return (
    <span className={`flex items-center gap-2 px-2.5 py-2 ${lost ? "text-[#F3EFE6]/50" : ""} ${won ? "bg-[#13131d]" : ""}`}>
      <Crest team={team} className="h-6 w-6 text-[12px]" sizes="24px" />
      {/* A long name takes a second line instead of being cut. */}
      <span
        className={`min-w-0 flex-1 text-base leading-[1.15] [overflow-wrap:anywhere] ${
          team ? "font-bold" : "italic text-[#F3EFE6]/50"
        }`}
      >
        {team?.name ?? "Αναμένεται"}
      </span>
      {scores.map((score, i) => (
        <span
          key={i}
          className={`flex h-6 w-6 shrink-0 items-center justify-center border text-sm font-bold tabular-nums ${
            score?.won ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]" : "border-[#F3EFE6]/25"
          }`}
        >
          {score ? score.goals : <span className="font-normal text-[#F3EFE6]/40">–</span>}
        </span>
      ))}
    </span>
  );
}

/** What is still to come in the tie, if anything: «Δευ 16 Νοε, 22:00», «Ρεβάνς: …», «Αναβλήθηκε». */
function pending(tie: Tie): string | null {
  const index = tie.legs.findIndex((l) => l.status !== "finished");
  if (index === -1) return null;
  const leg = tie.legs[index];
  const which = tie.legs.length > 1 ? (index === 0 ? "1ος αγώνας: " : "Ρεβάνς: ") : "";
  if (leg.status === "postponed") return `${which}Αναβλήθηκε`;
  if (!leg.date) return tie.a || tie.b ? `${which}Χωρίς ημερομηνία ακόμα` : null;
  return `${which}${formatMatchDate(leg.date, { weekday: "short", day: "numeric", month: "short" })}, ${formatMatchTime(leg.date)}`;
}

function TieCard({
  tie,
  label,
  champion,
}: {
  tie: Tie;
  label: string | null;
  /** The side that won the tournament here, on its final. */
  champion: "a" | "b" | null;
}) {
  const started = tie.legs.some((l) => l.score);
  const other = (side: "a" | "b") => (side === "a" ? "b" : "a");
  const scores = (side: keyof Pair) =>
    started
      ? tie.legs.map((l) => (l.score ? { goals: l.score[side], won: l.score[side] > l.score[other(side)] } : null))
      : [];
  const top = [label, pending(tie)].filter(Boolean).join(", ");
  return (
    <Link
      href={`${MATCH_PATH}/${tie.matchId}`}
      className={`block border-2 bg-[#0a0a14] transition-colors hover:border-[#fb923c] ${
        champion ? "" : tie.a || tie.b ? "border-[#F3EFE6]/20" : "border-dashed border-[#F3EFE6]/25"
      } ${FOCUS}`}
      style={champion ? { borderColor: SAFFRON, boxShadow: `6px 6px 0 0 ${SAFFRON}` } : undefined}
    >
      {top ? (
        <span className={`${LABEL} block truncate border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-2.5 py-1.5 text-[10px] text-[#F3EFE6]/65`}>
          {top}
        </span>
      ) : null}
      <TieSide team={tie.a} scores={scores("a")} won={tie.winner === "a"} lost={tie.winner === "b"} />
      <span aria-hidden className="block border-t border-[#F3EFE6]/15" />
      <TieSide team={tie.b} scores={scores("b")} won={tie.winner === "b"} lost={tie.winner === "a"} />
      {tie.pens || champion ? (
        <span className={`${LABEL} flex justify-between gap-3 border-t-2 border-[#F3EFE6]/15 px-2.5 py-1.5 text-[10px]`}>
          {champion ? (
            <span className="font-bold" style={{ color: SAFFRON }}>
              Πρωταθλήτρια
            </span>
          ) : null}
          {tie.pens ? (
            <span className="text-[#F3EFE6]/70">
              Πέναλτι {tie.pens.a}–{tie.pens.b}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}

function Node({ node, bracket, championId }: { node: BracketNode; bracket: Bracket; championId: number | null }) {
  const { tie, feeders } = node;
  // The tournament's winner is marked on the tie that closes the tree, and only
  // when that tie's own winner is the team the tournament records: never guessed.
  const final = bracket.top.length === 1 && bracket.top[0] === tie.key;
  const winner = tie.winner === "a" ? tie.a : tie.winner === "b" ? tie.b : null;
  const champion = final && championId !== null && winner?.id === championId ? tie.winner : null;
  return (
    <div className={styles.node}>
      {feeders.length > 0 ? (
        <div className={styles.feeders}>
          {feeders.map((feeder) => (
            <div key={feeder.tie.key} className={styles.feeder}>
              <Node node={feeder} bracket={bracket} championId={championId} />
            </div>
          ))}
        </div>
      ) : node.column > 0 ? (
        // Nothing drawn before it: leave the earlier rounds' room, so it stands in its own column.
        <div aria-hidden className={styles.spacer} style={{ "--skip": node.column } as React.CSSProperties} />
      ) : null}
      <div className={`${styles.slot} ${feeders.length > 0 ? styles.fed : ""}`}>
        <TieCard tie={tie} label={isThirdPlace(node, bracket) ? "Μικρός τελικός" : null} champion={champion} />
      </div>
    </div>
  );
}

function Tree({ bracket, championId }: { bracket: Bracket; championId: number | null }) {
  return (
    <div className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14]/60">
      {bracket.columns > 1 ? (
        <p className={`${LABEL} border-b-2 border-[#F3EFE6]/20 bg-[#13131d] px-4 py-2.5 text-[#F3EFE6]/65 md:hidden`}>
          Σύρετε στο πλάι για όλους τους γύρους
        </p>
      ) : null}
      {/* Scrolls sideways inside the panel; the bottom padding leaves room for the winner's shadow. */}
      <div className="overflow-x-auto px-4 pb-6 pt-5 md:px-6 md:pb-8 md:pt-6">
        <div className={`${styles.tree} w-max`}>
          {bracket.roundNames.length > 0 ? (
            <div className={styles.rounds}>
              {bracket.roundNames.map((name, column) => (
                <div key={column} className={`${styles.round} ${LABEL} pb-3 font-bold text-[#fb923c]`}>
                  {name}
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid justify-items-start gap-4">
            {bracket.roots.map((root) => (
              <Node key={root.tie.key} node={root} bracket={bracket} championId={championId} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BracketView({ base }: { base: Base }) {
  const stages = base.stages
    .filter((s) => s.kind === "knockout")
    .map((stage) => ({ stage, bracket: buildBracket(base.matches.filter((m) => m.stageId === stage.id)) }));
  if (stages.length === 0) {
    return <p className="text-[17px] text-[#F3EFE6]/70">Η διοργάνωση δεν έχει φάση νοκ άουτ.</p>;
  }
  // A stage that was set up and never given a match says nothing: leave it out, unless it is all there is.
  const shown = stages.some((s) => s.bracket) ? stages.filter((s) => s.bracket) : stages.slice(0, 1);
  return (
    <div className="grid gap-14">
      {shown.map(({ stage, bracket }) => (
        <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="min-w-0">
          <Rubric
            id={`stage-${stage.id}`}
            kicker={shown.length > 1 ? "Νοκ άουτ" : null}
            title={shown.length > 1 ? stage.name : "Νοκ άουτ"}
          />
          {bracket ? (
            <Tree bracket={bracket} championId={base.winner?.id ?? null} />
          ) : (
            <p className="text-[17px] text-[#F3EFE6]/70">
              Τα ζευγάρια των νοκ άουτ θα οριστούν όταν ολοκληρωθεί η προηγούμενη φάση.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
