// app/components/DashboardPageComponents/TournamentCURD/util/generators/groupsIntake.ts
import type { DraftMatch } from "../../TournamentWizard";
import type { StageConfig, IntakeMapping } from "@/app/lib/types";

/**
 * Compute slots per group based on KO → Groups intake mappings.
 * ⚠️ Sizes each group by the COUNT of unique slots mapped (not max index + 1),
 * so non-contiguous slot_idx values won't inflate the group size.
 */
export function computeIntakeSlotsPerGroup(
  cfg: StageConfig,
  groupsCount: number
): number[] {
  const rows: IntakeMapping[] = (cfg.groups_intake ?? []) as any;
  const buckets: number[][] = Array.from({ length: Math.max(1, groupsCount) }, () => []);
  rows.forEach((r) => {
    const gi = Math.max(0, Math.min(groupsCount - 1, r.group_idx ?? 0));
    const s = Math.max(0, r.slot_idx ?? 0);
    if (!buckets[gi].includes(s)) buckets[gi].push(s);
  });
  return buckets.map((arr) => arr.length);
}

/**
 * Generate a SKELETON round-robin for a group with N slots (unknown teams).
 * team_a_id/team_b_id are left null; only matchday/round-robin shape is produced.
 */
export function genGroupSkeletonRoundRobin(opts: {
  stageIdx: number;
  groupIdx: number;
  slotsCount: number;
  repeats: number;
}): DraftMatch[] {
  const { stageIdx, groupIdx, slotsCount, repeats } = opts;
  const n = slotsCount;
  if (n < 2) return [];

  // odd -> add BYE
  const hasBye = n % 2 === 1;
  const m = hasBye ? n + 1 : n;
  const rounds = m - 1;
  const half = m / 2;

  // build an index list (0..m-1), last acts like BYE if odd
  let arr = Array.from({ length: m }, (_v, i) => i);

  const out: DraftMatch[] = [];

  const pushRound = (baseMd: number) => {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      // skip BYE matches
      if (hasBye && (a === m - 1 || b === m - 1)) continue;

      out.push({
        stageIdx,
        groupIdx,
        matchday: baseMd,
        team_a_id: null, // unknown until KO finishes
        team_b_id: null, // unknown until KO finishes
        match_date: null,
      });
    }
  };

  // Base single round
  for (let r = 0; r < rounds; r++) {
    pushRound(r + 1);
    // rotate (keep first fixed)
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }

  // Extra repeats: duplicate the base layout (home/away undefined for skeletons)
  for (let rep = 2; rep <= repeats; rep++) {
    for (let r = 0; r < rounds; r++) {
      const baseMd = r + 1;
      const md = (rep - 1) * rounds + baseMd;
      const countInBase = out.filter(
        (m) => m.matchday === baseMd && m.groupIdx === groupIdx && m.stageIdx === stageIdx
      ).length;

      for (let i = 0; i < countInBase; i++) {
        out.push({
          stageIdx,
          groupIdx,
          matchday: md,
          team_a_id: null,
          team_b_id: null,
          match_date: null,
        });
      }
    }
  }

  return out;
}
