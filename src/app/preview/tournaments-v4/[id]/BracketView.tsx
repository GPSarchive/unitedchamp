// A knockout stage, drawn so that it reads as a knockout before a word is
// read: pairs of teams joined by lines that narrow, round by round, to one
// final, with the winner's crest in a ring standing on that final.
//
// Every tie keeps the teams' names. Where the rounds have room (a desk) the
// whole tree shows at once; where they do not (a phone) the frame scrolls
// sideways and opens on the round being played, or on the final once the
// stage is over (TreeScroller), so the first look already shows pairs joining
// into the next round. Drawn from the last tie backwards (model.buildBracket
// of tournaments-v3), by plain nested boxes and the lines in
// dispatch.module.css.
//
// A stage of one round only has nothing to narrow to: there every tie is drawn
// with a line to the ring of the team that went through.
import Link from "next/link";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import {
  isThirdPlace,
  type Bracket,
  type BracketNode,
  type Pair,
  type TTeam,
  type Tie,
} from "../../tournaments-v3/[id]/model";
import styles from "./dispatch.module.css";
import { MATCH_PATH } from "./paths";
import { FOCUS, LABEL, SAFFRON } from "./tokens";
import TreeScroller from "./TreeScroller";
import { Crest } from "./ui";


// A tie has two looks, chosen by its own width (the classes starting `@[11rem]:`):
// narrow, it is crests and scores; from 11rem up the teams' names have room and show.
function TieSide({
  team,
  scores,
  pens,
  won,
  lost,
}: {
  team: TTeam | null;
  /** One per meeting played so far in the tie: this side's goals and whether it won that meeting; null = still to come. */
  scores: ({ goals: number; won: boolean } | null)[];
  /** This side's count in the shootout that settled the tie, if there was one. */
  pens: { goals: number; won: boolean } | null;
  won: boolean;
  lost: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 px-1.5 py-1.5 @[11rem]:gap-2 @[11rem]:py-2 @[11rem]:pl-2.5 @[11rem]:pr-2 ${
        lost ? "text-[#F3EFE6]/50" : ""
      } ${won ? "bg-[#F3EFE6]/[0.08]" : ""}`}
    >
      <span className={lost ? "opacity-55" : ""}>
        <Crest team={team} className="h-7 w-7 text-[12px] @[11rem]:h-6 @[11rem]:w-6" sizes="28px" />
      </span>
      {/* The name: read out always, shown where the tie is wide enough; a long one takes a second line. */}
      <span
        className={`sr-only @[11rem]:not-sr-only @[11rem]:min-w-0 @[11rem]:flex-1 @[11rem]:text-base @[11rem]:leading-[1.15] @[11rem]:[overflow-wrap:anywhere] ${
          team ? "font-bold" : "italic text-[#F3EFE6]/55"
        }`}
      >
        {team?.name ?? "Αναμένεται"}
      </span>
      {/* The meetings' scores, each in a tile of its own so two legs never read as one number; the
          number that won its meeting in orange. A shootout follows in brackets, as on a scoreboard. */}
      {scores.length > 0 ? (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {scores.map((score, i) => (
            <span
              key={i}
              className={`flex h-6 min-w-[1.4rem] items-center justify-center bg-[#F3EFE6]/[0.09] px-0.5 text-base font-bold leading-none tabular-nums @[11rem]:h-7 @[11rem]:min-w-[1.7rem] @[11rem]:text-lg ${
                score?.won ? "text-[#fb923c]" : ""
              }`}
            >
              {score ? score.goals : <span className="font-normal text-[#F3EFE6]/40">–</span>}
            </span>
          ))}
          {pens ? (
            <span
              className={`hidden text-[12px] font-bold leading-none tabular-nums @[5.5rem]:inline @[11rem]:text-sm ${
                pens.won ? "text-[#fb923c]" : "text-[#F3EFE6]/60"
              }`}
            >
              <span className="sr-only">πέναλτι </span>({pens.goals})
            </span>
          ) : null}
        </span>
      ) : null}
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
  if (!leg.date) return null;
  return `${which}${formatMatchDate(leg.date, { weekday: "short", day: "numeric", month: "short" })}, ${formatMatchTime(leg.date)}`;
}

function TieCard({
  tie,
  label,
  champion,
}: {
  tie: Tie;
  label: string | null;
  /** The tournament was won here. */
  champion: boolean;
}) {
  const started = tie.legs.some((l) => l.score);
  const other = (side: "a" | "b") => (side === "a" ? "b" : "a");
  const scores = (side: keyof Pair) =>
    started
      ? tie.legs.map((l) => (l.score ? { goals: l.score[side], won: l.score[side] > l.score[other(side)] } : null))
      : [];
  const pens = (side: keyof Pair) =>
    tie.pens ? { goals: tie.pens[side], won: tie.pens[side] > tie.pens[other(side)] } : null;
  const top = [label, pending(tie)].filter(Boolean).join(", ");
  const strip = `${LABEL} hidden truncate px-2.5 py-1.5 text-[#F3EFE6]/70 @[11rem]:block`;
  return (
    <Link
      href={`${MATCH_PATH}/${tie.matchId}`}
      // A narrow tie shows crests only: the pointer still gets the two names.
      title={tie.a || tie.b ? `${tie.a?.name ?? "Αναμένεται"} – ${tie.b?.name ?? "Αναμένεται"}` : undefined}
      className={`block border-2 bg-[#0e0e1a] transition-colors hover:border-[#fb923c] ${
        champion ? "" : tie.a || tie.b ? "border-[#F3EFE6]/30" : "border-dashed border-[#F3EFE6]/25"
      } ${FOCUS}`}
      style={champion ? { borderColor: SAFFRON } : undefined}
    >
      {top ? <span className={`${strip} border-b border-[#F3EFE6]/15 bg-[#151522]`}>{top}</span> : null}
      <TieSide
        team={tie.a}
        scores={scores("a")}
        pens={pens("a")}
        won={tie.winner === "a"}
        lost={tie.winner === "b"}
      />
      <span aria-hidden className="block border-t border-[#F3EFE6]/15" />
      <TieSide
        team={tie.b}
        scores={scores("b")}
        pens={pens("b")}
        won={tie.winner === "b"}
        lost={tie.winner === "a"}
      />
    </Link>
  );
}

/**
 * The ring a tie's winner stands in: the crest of the team that went through,
 * or an empty dashed ring while nobody has. Saffron when it is the tournament's
 * champion, and only then.
 */
function Ring({ team, champion, size }: { team: TTeam | null; champion: boolean; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border-2 bg-[#0a0a14] p-1.5 ${size} ${
        team ? "" : "border-dashed border-[#F3EFE6]/35"
      }`}
      style={
        team
          ? {
              borderColor: champion ? SAFFRON : "rgb(243 239 230 / 0.6)",
              boxShadow: champion ? "0 0 0 4px rgb(232 185 49 / 0.22)" : undefined,
            }
          : undefined
      }
    >
      {team ? (
        <>
          <Crest team={team} className="h-full w-full text-sm" sizes="56px" />
          <span className="sr-only">
            {champion ? "Πρωταθλητές" : "Νικητές"}: {team.name}
          </span>
        </>
      ) : null}
    </span>
  );
}

const winnerOf = (tie: Tie) => (tie.winner === "a" ? tie.a : tie.winner === "b" ? tie.b : null);

function Node({ node, bracket, championId }: { node: BracketNode; bracket: Bracket; championId: number | null }) {
  const { tie, feeders } = node;
  // The tie that closes the tree carries the ring. The ring turns saffron only
  // when that tie's own winner is the team the tournament records: never guessed.
  const final = bracket.top.length === 1 && bracket.top[0] === tie.key;
  const winner = winnerOf(tie);
  const champion = final && championId !== null && winner?.id === championId;
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
      <div data-col={node.column} className={`${styles.slot} ${feeders.length > 0 ? styles.fed : ""}`}>
        {final ? (
          // Standing on the final, joined to it by a short line.
          <span className="pointer-events-none absolute bottom-full left-1/2 flex -translate-x-1/2 flex-col items-center">
            <Ring team={winner} champion={champion} size={`h-11 w-11 @[11rem]:h-14 @[11rem]:w-14`} />
            <span aria-hidden className="h-2.5 w-[2px] bg-[#F3EFE6]/50" />
          </span>
        ) : null}
        <TieCard tie={tie} label={isThirdPlace(node, bracket) ? "Μικρός τελικός" : null} champion={champion} />
      </div>
    </div>
  );
}

/** «Προημιτελικά» has no room over a narrow round: there the short form shows. */
const SHORT: Record<string, string> = { Ημιτελικά: "Ημιτ.", Προημιτελικά: "Προημ." };
const shortRound = (name: string) => SHORT[name] ?? name.replace(/^Φάση των /, "Οι ");

const leaves = (node: BracketNode): number =>
  node.feeders.length === 0 ? 1 : node.feeders.reduce((n, f) => n + leaves(f), 0);

/** A stage of one round: each tie with a line to the ring of the team that went through. */
function Duels({ bracket, championId }: { bracket: Bracket; championId: number | null }) {
  const lone = bracket.roots.length === 1;
  return (
    <ul className={`grid gap-x-8 gap-y-3 ${lone ? "" : "sm:grid-cols-2"}`}>
      {bracket.roots.map(({ tie }) => {
        const winner = winnerOf(tie);
        const champion = lone && championId !== null && winner?.id === championId;
        return (
          <li key={tie.key} className="flex min-w-0 items-center">
            <div className="@container min-w-0 max-w-[17rem] flex-1">
              <TieCard tie={tie} label={null} champion={champion} />
            </div>
            <span aria-hidden className="h-[2px] w-4 shrink-0 bg-[#F3EFE6]/50 md:w-6" />
            <Ring team={winner} champion={champion} size="h-12 w-12" />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The column the frame opens on: the earliest round with a tie still to be
 * decided, or the last column when every tie is.
 */
function focusColumn(bracket: Bracket): number {
  let open = bracket.columns - 1;
  const walk = (node: BracketNode) => {
    if (node.tie.winner === null && node.column < open) open = node.column;
    node.feeders.forEach(walk);
  };
  bracket.roots.forEach(walk);
  return open;
}

/** One knockout stage in its frame. */
export default function KnockoutTree({ bracket, championId }: { bracket: Bracket; championId: number | null }) {
  const frame = "border-2 border-[#F3EFE6]/20 bg-[#0c0c17] px-3 py-5 md:px-6 md:py-7";
  if (bracket.columns <= 1) {
    return (
      <div className={frame}>
        <Duels bracket={bracket} championId={championId} />
      </div>
    );
  }
  // The ring stands above the final: a small tree has no height to spare for it.
  const room = bracket.top.length === 1 && leaves(bracket.roots[0]) < 4;
  return (
    // Wider than the screen, the frame scrolls, and opens where the stage stands.
    <TreeScroller
      focus={focusColumn(bracket)}
      last={bracket.columns - 1}
      className={`${frame} overflow-x-auto overscroll-x-contain`}
    >
      <div className={styles.bracket}>
        <div className={styles.tree} style={{ "--cols": bracket.columns } as React.CSSProperties}>
          {bracket.roundNames.length > 0 ? (
            <div className={styles.rounds}>
              {bracket.roundNames.map((name, column) => (
                <div key={column} className={`${styles.round} pb-3 text-center text-[13px] font-bold leading-tight text-[#F3EFE6]/70`}>
                  <span className="@[6.5rem]:hidden">{shortRound(name)}</span>
                  <span className="hidden @[6.5rem]:inline">{name}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className={`grid justify-items-start gap-4 ${room ? "pt-14" : ""}`}>
            {bracket.roots.map((root) => (
              <Node key={root.tie.key} node={root} bracket={bracket} championId={championId} />
            ))}
          </div>
        </div>
      </div>
    </TreeScroller>
  );
}
