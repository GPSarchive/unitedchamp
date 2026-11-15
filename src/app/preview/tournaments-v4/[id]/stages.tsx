// A tournament's stages in the order they are played: what each is called,
// how far it has got, the numbered disc that stands for it, and the rail that
// lays them out left to right (first stage first), so a reader can tell that
// the knockout came after the groups without being told.
import type { Base } from "../../tournaments-v3/[id]/data";
import type { StageKind, TStage } from "../../tournaments-v3/[id]/model";
import { FOCUS, NAME } from "./tokens";

const KIND: Record<StageKind, string> = { league: "Πρωτάθλημα", groups: "Όμιλοι", knockout: "Νοκ άουτ" };

/** A name nobody chose («Stage 2», «Φάση 1»): the stage is then called by what it is. */
const GENERIC = /^(stage|φάση|φαση|phase|round)\s*\d*$/i;

export const stageTitle = (stage: TStage) => (GENERIC.test(stage.name.trim()) ? KIND[stage.kind] : stage.name);

export type StageState = "done" | "now" | "next";

/**
 * How far each stage has got. A stage is over when every match of it has been
 * played, or when the tournament has moved on (a later stage has a result, a
 * winner is recorded, the season is archived); the first one that is not over
 * is the one being played.
 */
export function stageStates(base: Base): Map<number, StageState> {
  const closed = base.winner !== null || Boolean(base.season?.archived);
  const played = (stageId: number) => base.matches.some((m) => m.stageId === stageId && m.status === "finished");
  const states = new Map<number, StageState>();
  let open = false;
  base.stages.forEach((stage, index) => {
    const matches = base.matches.filter((m) => m.stageId === stage.id && m.status !== "postponed");
    const over =
      closed ||
      (matches.length > 0 && matches.every((m) => m.status === "finished")) ||
      base.stages.slice(index + 1).some((later) => played(later.id));
    states.set(stage.id, over ? "done" : open ? "next" : "now");
    if (!over) open = true;
  });
  return states;
}

const DISC: Record<StageState, string> = {
  done: "bg-[#F3EFE6] text-[#0a0a14]",
  now: "bg-[#fb923c] text-[#0a0a14]",
  next: "border-2 border-[#F3EFE6]/40 text-[#F3EFE6]/70",
};

const STATE_WORD: Record<StageState, string> = { done: "ολοκληρώθηκε", now: "σε εξέλιξη", next: "ακολουθεί" };

/** The stage's number in a disc: filled when over, orange while being played, hollow when still to come. */
export function StageDisc({ n, state, className = "" }: { n: number; state: StageState; className?: string }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold leading-none tabular-nums ${DISC[state]} ${className}`}
    >
      {n}
    </span>
  );
}

/** A small drawing of what the stage is: ranked rows for a table, joined pairs for a knockout. */
function Pictogram({ kind }: { kind: StageKind }) {
  return (
    <svg aria-hidden viewBox="0 0 28 18" className="h-[18px] w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
      {kind === "knockout" ? (
        <path d="M2 3h8v5H2M2 11h8v5H2M10 5.5h8v8h-8M18 9.5h8" strokeLinejoin="round" />
      ) : (
        <path d="M2 3.5h3M8 3.5h18M2 9h3M8 9h13M2 14.5h3M8 14.5h9" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * The stages left to right, joined by a line with an arrow head: 1 → 2 → 3.
 * Each one leads to its place on the page.
 */
export function StageRail({ stages }: { stages: { stage: TStage; state: StageState }[] }) {
  return (
    <nav aria-label="Οι φάσεις της διοργάνωσης με τη σειρά">
      <ol className="flex items-start">
        {stages.map(({ stage, state }, index) => (
          <li key={stage.id} className="relative flex min-w-0 flex-1 flex-col items-center">
            {index > 0 ? (
              // From the disc before to this one, pointing this way.
              <span
                aria-hidden
                className={`absolute left-[calc(-50%+1.5rem)] top-[calc(1.125rem-1px)] flex w-[calc(100%-3rem)] items-center ${
                  state === "next" ? "text-[#F3EFE6]/30" : "text-[#F3EFE6]/75"
                }`}
              >
                <span className="h-[2px] flex-1 bg-current" />
                <svg viewBox="0 0 8 12" className="-ml-1 h-3 w-2" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 1l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : null}
            <a
              href={`#stage-${stage.id}`}
              className={`group flex max-w-full flex-col items-center gap-2 px-1 text-center ${FOCUS} ${
                state === "next" ? "text-[#F3EFE6]/60" : "text-[#F3EFE6]"
              }`}
            >
              <StageDisc n={index + 1} state={state} />
              <Pictogram kind={stage.kind} />
              <span className={`${NAME} [overflow-wrap:anywhere] group-hover:text-[#fb923c]`}>
                {stageTitle(stage)}
                <span className="sr-only">, {STATE_WORD[state]}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
