"use client";

import * as React from "react";

/**
 * Two-legged KO decider panel — the penalty input for leg 2.
 *
 * Lives INSIDE the `#stats-form`, alongside the StatsEditor. The leg-2 score is
 * not stored as a field; it is computed on submit from each player's goals/own
 * goals. So whether penalties are required depends on what the admin is CURRENTLY
 * typing into the stats editor, not on the last-saved score.
 *
 * This component watches the live goal inputs in the form, combines them with
 * leg-1's (already finished) score, and reveals the penalty inputs ONLY when the
 * live result would leave the two legs level on wins (1–1 or both drawn) — the
 * exact case where the server REQUIRES penalties to finish the tie. The pen
 * inputs get the HTML `required` attribute in that case, so the admin can't save
 * a level tie without entering the shootout result.
 *
 * Leg-win counting must mirror `decideTwoLeggedTie` in
 * util/functions/twoLeggedTie.ts (the server's single source of truth).
 */

type Props = {
  teamAId: number;
  teamBId: number;
  teamAName: string;
  teamBName: string;
  /** Leg-1 score in LEG-2's (team_a/team_b) orientation. Null until leg 1 is finished. */
  leg1AScore: number | null;
  leg1BScore: number | null;
  /** Whether leg 1 has a stored score yet (tie cannot resolve until it does). */
  leg1Ready: boolean;
  savedPenaltyA: number | null;
  savedPenaltyB: number | null;
  /**
   * "decider" (default): leg 2 of a two-legged tie — pens required when the
   * live leg WINS are level. "single": a one-off KO match — pens required when
   * the live SCORE is level (leg-1 props are ignored). Both mirror the exact
   * cases where the server (decideTwoLeggedTie / decideSingleLegKO) demands a
   * shootout to finish.
   */
  mode?: "decider" | "single";
};

/** Sum goals + own-goals from the live form into leg-2 A/B scores (mirrors the server). */
function readLiveLeg2Score(
  form: HTMLFormElement,
  teamAId: number,
  teamBId: number,
): { a: number; b: number } {
  let aGoals = 0;
  let bGoals = 0;
  // Field names are players[<teamId>][<playerId>][goals|own_goals]. There are
  // duplicate hidden "0" defaults + the real input; reading via elements[name]
  // would only see one. Walk all number-bearing inputs instead.
  const goalsRe = /^players\[(\d+)\]\[\d+\]\[goals\]$/;
  const ownRe = /^players\[(\d+)\]\[\d+\]\[own_goals\]$/;
  for (const el of Array.from(form.elements)) {
    const input = el as HTMLInputElement;
    if (!input.name) continue;
    let m = goalsRe.exec(input.name);
    if (m) {
      const tid = Number(m[1]);
      const n = Number(input.value) || 0;
      if (tid === teamAId) aGoals += n;
      else if (tid === teamBId) bGoals += n;
      continue;
    }
    m = ownRe.exec(input.name);
    if (m) {
      const tid = Number(m[1]);
      const n = Number(input.value) || 0;
      // Own goal by team A counts for team B, and vice versa.
      if (tid === teamAId) bGoals += n;
      else if (tid === teamBId) aGoals += n;
    }
  }
  return { a: aGoals, b: bGoals };
}

export default function TwoLeggedPenaltyPanel({
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  leg1AScore,
  leg1BScore,
  leg1Ready,
  savedPenaltyA,
  savedPenaltyB,
  mode = "decider",
}: Props) {
  const isSingle = mode === "single";
  const [live, setLive] = React.useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Recompute the live leg-2 score from the form on every input change.
  React.useEffect(() => {
    const form = rootRef.current?.closest("form") as HTMLFormElement | null;
    if (!form) return;
    const recompute = () =>
      setLive(readLiveLeg2Score(form, teamAId, teamBId));
    recompute();
    form.addEventListener("input", recompute);
    return () => form.removeEventListener("input", recompute);
  }, [teamAId, teamBId]);

  const leg2Winner =
    live.a > live.b ? teamAId : live.b > live.a ? teamBId : null;
  const leg1Winner =
    leg1Ready && leg1AScore != null && leg1BScore != null
      ? leg1AScore > leg1BScore
        ? teamAId
        : leg1BScore > leg1AScore
          ? teamBId
          : null
      : null;

  const winsA =
    (leg1Winner === teamAId ? 1 : 0) + (leg2Winner === teamAId ? 1 : 0);
  const winsB =
    (leg1Winner === teamBId ? 1 : 0) + (leg2Winner === teamBId ? 1 : 0);

  // Penalties are required exactly when the server would refuse to finish
  // without them: single-leg — the live SCORE is level; decider — leg 1 has a
  // score and the live leg WINS are level.
  const penaltiesRequired = isSingle
    ? live.a === live.b
    : leg1Ready && winsA === winsB;

  const aggA = leg1Ready && leg1AScore != null ? leg1AScore + live.a : null;
  const aggB = leg1Ready && leg1BScore != null ? leg1BScore + live.b : null;

  return (
    <div
      ref={rootRef}
      className={`mt-4 rounded-lg border p-4 ${
        penaltiesRequired
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-cyan-400/25 bg-cyan-400/5"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          penaltiesRequired ? "text-amber-200" : "text-cyan-200"
        }`}
      >
        {isSingle ? "Νοκ-άουτ (μονός αγώνας)" : "Δεύτερο σκέλος (νοκ-άουτ διπλών αγώνων)"}
      </p>
      <p className="mt-1 text-xs text-white/60">
        {isSingle ? (
          <>
            Ο νικητής κρίνεται στο σκορ· αν ο αγώνας λήξει <strong>ισόπαλος</strong>,
            αποφασίζουν τα <strong>πέναλτι</strong>.{" "}
            Σκορ (βάσει των στατιστικών που εισάγεις):{" "}
            <strong className="text-white/80">
              {teamAName} {live.a} – {live.b} {teamBName}
            </strong>
            .{" "}
            {penaltiesRequired ? (
              <strong className="text-amber-200">
                Ισόπαλο σκορ — συμπλήρωσε υποχρεωτικά τα πέναλτι πριν την
                αποθήκευση.
              </strong>
            ) : (
              "Υπάρχει νικητής στο σκορ — τα πέναλτι δεν χρειάζονται."
            )}
          </>
        ) : (
          <>
            Ο νικητής κρίνεται στις <strong>νίκες σκελών</strong>: όποια ομάδα κερδίσει
            περισσότερα σκέλη προκρίνεται. Αν κάθε ομάδα κερδίσει από ένα σκέλος (1–1),
            αποφασίζουν τα <strong>πέναλτι</strong>.
            {leg1Ready ? (
              <>
                {" "}Νίκες σκελών (βάσει των στατιστικών που εισάγεις):{" "}
                <strong className="text-white/80">
                  {teamAName} {winsA} – {winsB} {teamBName}
                </strong>
                {" "}(συνολικό σκορ {aggA ?? "–"}–{aggB ?? "–"}, δεν κρίνει).{" "}
                {penaltiesRequired ? (
                  <strong className="text-amber-200">
                    Ισοπαλία σε νίκες — συμπλήρωσε υποχρεωτικά τα πέναλτι πριν την
                    αποθήκευση.
                  </strong>
                ) : (
                  "Υπάρχει νικητής στα σκέλη — τα πέναλτι δεν χρειάζονται."
                )}
              </>
            ) : (
              <> Ολοκλήρωσε πρώτα το πρώτο σκέλος για να κριθεί ο νικητής.</>
            )}
          </>
        )}
      </p>

      {/* Penalty inputs appear ONLY when the live result leaves the legs level on
          wins. When a team is winning on legs, pens are irrelevant and the server
          clears any stray value — so we don't even offer the inputs. */}
      {penaltiesRequired && (
        <div className="mt-3 flex items-center gap-2">
          <span className="w-28 truncate text-xs text-white/70">
            Πέναλτι {teamAName}
          </span>
          <input
            type="number"
            min={0}
            name="penalty_a"
            required
            defaultValue={savedPenaltyA ?? ""}
            aria-required
            className="w-16 rounded bg-zinc-900 px-2 py-1.5 text-center text-white border border-amber-400/60"
          />
          <span className="text-white/50">–</span>
          <input
            type="number"
            min={0}
            name="penalty_b"
            required
            defaultValue={savedPenaltyB ?? ""}
            aria-required
            className="w-16 rounded bg-zinc-900 px-2 py-1.5 text-center text-white border border-amber-400/60"
          />
          <span className="w-28 truncate text-xs text-white/70">
            Πέναλτι {teamBName}
          </span>
        </div>
      )}
    </div>
  );
}
