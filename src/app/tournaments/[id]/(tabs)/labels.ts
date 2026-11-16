// What a match's round is called, shared by the tournament's tabs: a knockout
// match's round comes from its stage's tree, a league/group match's is its
// matchday («3η αγωνιστική», owner, 2026-11-16). The «Αγώνες» tab itself is matches/.
import type { Base } from "@/app/preview/tournaments-v3/[id]/data";
import {
  buildBracket,
  knockoutRounds,
  roundLabel,
  type KnockoutRound,
  type LabelContext,
  type TMatch,
} from "@/app/preview/tournaments-v3/[id]/model";

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

/**
 * The round a match belongs to, for a note under it: a knockout round
 * («Ημιτελικά») or the matchday («3η αγωνιστική»), after the stage when there
 * are two of a kind.
 */
export const roundNote = (m: TMatch, ctx: LabelContext) => roundLabel(m, ctx);
