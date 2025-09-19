// app/components/DashboardPageComponents/TournamentCURD/util/generators/roundRobin.ts
import type { DraftMatch } from "../../TournamentWizard";

/** Standard round-robin (circle method). Produces real team-id matches. */
export function genRoundRobin(opts: {
  stageIdx: number;
  groupIdx: number | null;
  teamIds: number[];
  repeats: number;
  startDate: Date | null; // ignored for generation
  intervalDays: number;   // ignored for generation
}): DraftMatch[] {
  const { stageIdx, groupIdx, repeats } = opts;
  const ids = opts.teamIds.slice();
  const n = ids.length;
  if (n < 2) return [];

  // odd teams → add BYE sentinel (-1)
  const hasBye = n % 2 === 1;
  if (hasBye) ids.push(-1);

  const m = ids.length;
  const rounds = m - 1; // matchdays per single round
  const half = m / 2;
  let arr = ids.slice();

  const out: DraftMatch[] = [];

  // Base single round
  for (let r = 0; r < rounds; r++) {
    const md = r + 1;
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a !== -1 && b !== -1) {
        out.push({
          stageIdx,
          groupIdx,
          matchday: md,
          team_a_id: a,
          team_b_id: b,
          match_date: null,
        });
      }
    }
    // rotate (keep first fixed)
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }

  // Extra repeats: alternate home/away each repeat
  for (let rep = 2; rep <= repeats; rep++) {
    for (let r = 0; r < rounds; r++) {
      const baseMd = r + 1;
      const md = (rep - 1) * rounds + baseMd;
      const baseRows = out.filter(
        (m) => m.matchday === baseMd && m.groupIdx === groupIdx && m.stageIdx === stageIdx
      );
      baseRows.forEach((m) =>
        out.push({
          stageIdx,
          groupIdx,
          matchday: md,
          team_a_id: rep % 2 === 0 ? m.team_b_id! : m.team_a_id!,
          team_b_id: rep % 2 === 0 ? m.team_a_id! : m.team_b_id!,
          match_date: null,
        })
      );
    }
  }

  return out;
}
