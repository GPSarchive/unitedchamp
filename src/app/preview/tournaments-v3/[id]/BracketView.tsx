// The knockout tree: every tie as a small card (two teams, the score of each
// meeting), each standing level with the middle of the two it comes from, with
// lines joining them. Drawn from the last tie backwards (model.buildBracket),
// by plain nested boxes and the lines in tournament.module.css — no measuring,
// no script, so it is there on first paint and prints.
//
// It is as wide as its rounds; on a phone it scrolls sideways.
import Link from "next/link";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import type { Base } from "./data";
import { buildBracket, isThirdPlace, type Bracket, type BracketNode, type TTeam, type Tie } from "./model";
import { MATCH_PATH } from "./paths";
import styles from "./tournament.module.css";
import { Crest, FOCUS } from "./ui";

function TieSide({
  team,
  scores,
  won,
  lost,
  champion,
}: {
  team: TTeam | null;
  /** One number per meeting played so far in the tie; null = that meeting is still to come. */
  scores: (number | null)[];
  won: boolean;
  lost: boolean;
  champion: boolean;
}) {
  return (
    <span className={`flex items-center gap-2 px-2.5 py-1.5 ${lost ? "text-[#F3EFE6]/55" : ""}`}>
      <Crest team={team} className="h-6 w-6 text-[12px]" sizes="24px" />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] ${won ? "font-bold" : ""} ${champion ? "text-[#FFE08A]" : ""} ${
          team ? "" : "italic text-[#F3EFE6]/50"
        }`}
      >
        {team?.name ?? "Αναμένεται"}
      </span>
      {scores.map((score, i) => (
        <span key={i} className="w-5 shrink-0 text-center text-[15px] font-bold tabular-nums">
          {score ?? <span className="font-normal text-[#F3EFE6]/40">–</span>}
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
  const scores = (side: "a" | "b") => (started ? tie.legs.map((l) => (l.score ? l.score[side] : null)) : []);
  const top = [label, pending(tie)].filter(Boolean).join(", ");
  return (
    <Link
      href={`${MATCH_PATH}/${tie.matchId}`}
      className={`block border bg-[#0e0e1a] transition-colors hover:border-[#fb923c] ${
        champion ? "border-[#D4AF37]/70" : tie.a || tie.b ? "border-[#F3EFE6]/20" : "border-dashed border-[#F3EFE6]/25"
      } ${FOCUS}`}
    >
      {top ? (
        <span className="block truncate border-b border-[#F3EFE6]/10 px-2.5 py-1 text-[13px] text-[#F3EFE6]/65">
          {top}
        </span>
      ) : null}
      <TieSide
        team={tie.a}
        scores={scores("a")}
        won={tie.winner === "a"}
        lost={tie.winner === "b"}
        champion={champion === "a"}
      />
      <span aria-hidden className="block border-t border-[#F3EFE6]/10" />
      <TieSide
        team={tie.b}
        scores={scores("b")}
        won={tie.winner === "b"}
        lost={tie.winner === "a"}
        champion={champion === "b"}
      />
      {tie.pens || champion ? (
        <span className="block border-t border-[#F3EFE6]/10 px-2.5 py-1 text-[13px]">
          {tie.pens ? (
            <span className="text-[#F3EFE6]/75">
              Πέναλτι {tie.pens.a}–{tie.pens.b}
            </span>
          ) : null}
          {tie.pens && champion ? <span aria-hidden>, </span> : null}
          {champion ? <span className="font-bold text-[#FFE08A]">πρωταθλήτρια</span> : null}
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
    <>
      {bracket.columns > 1 ? (
        <p className="mb-3 text-[13px] text-[#F3EFE6]/65 md:hidden">
          Σύρετε στο πλάι για να δείτε όλους τους γύρους.
        </p>
      ) : null}
      {/* Scrolls sideways, edge to edge on a phone. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
        <div className={`${styles.tree} w-max`}>
          {bracket.roundNames.length > 0 ? (
            <div className={styles.rounds}>
              {bracket.roundNames.map((name, column) => (
                <div key={column} className={`${styles.round} pb-2 text-[17px] font-bold`}>
                  {name}
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid justify-items-start gap-3">
            {bracket.roots.map((root) => (
              <Node key={root.tie.key} node={root} bracket={bracket} championId={championId} />
            ))}
          </div>
        </div>
      </div>
    </>
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
    <div className="grid gap-12">
      {shown.map(({ stage, bracket }) => (
        <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="min-w-0">
          <h2 id={`stage-${stage.id}`} className={shown.length > 1 ? "mb-4 text-2xl font-bold italic" : "sr-only"}>
            {shown.length > 1 ? stage.name : "Νοκ άουτ"}
          </h2>
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
