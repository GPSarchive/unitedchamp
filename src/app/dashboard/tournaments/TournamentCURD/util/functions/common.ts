//app/dashboard/tournaments/TournamentCURD/util/functions/common.ts
import type { DraftMatch } from "../../TournamentWizard";

export function shuffleArray<T>(a: T[]): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pairArray<T>(arr: T[]): [T, T | null][] {
  const out: [T, T | null][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push([arr[i], arr[i + 1] ?? null]);
  return out;
}

/** Build seed positions for a power-of-two bracket. */
export function buildSeedPositions(n: number): number[] {
  let p = [1];
  while (p.length < n) {
    const m = p.length;
    const next: number[] = [];
    for (const x of p) next.push(x, 2 * m + 1 - x);
    p = next;
  }
  return p;
}

/** Wire knockout source references between successive rounds (W winners). */
export function wireKnockoutSources(draft: DraftMatch[]) {
  const rounds = new Map<number, { idx: number; pos: number }[]>();
  draft.forEach((m, i) => {
    const r = m.round ?? 0;
    const arr = rounds.get(r) ?? [];
    arr.push({ idx: i, pos: m.bracket_pos ?? arr.length + 1 });
    rounds.set(r, arr);
  });

  const roundNums = [...rounds.keys()].sort((a, b) => a - b);
  for (let i = 0; i < roundNums.length - 1; i++) {
    const r = roundNums[i];
    const nextR = roundNums[i + 1];

    const curr = (rounds.get(r) ?? []).sort((a, b) => a.pos - b.pos);
    const next = (rounds.get(nextR) ?? []).sort((a, b) => a.pos - b.pos);

    for (let j = 0; j < next.length; j++) {
      const target = draft[next[j].idx];
      const aSrc = curr[2 * j]?.idx;
      const bSrc = curr[2 * j + 1]?.idx;
      if (aSrc != null) {
        target.home_source_match_idx = aSrc;
        target.home_source_outcome = "W";
      }
      if (bSrc != null) {
        target.away_source_match_idx = bSrc;
        target.away_source_outcome = "W";
      }
    }
  }
}
