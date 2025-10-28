// app/dashboard/tournaments/TournamentCURD/util/functions/groupsIntake.ts
import type { DraftMatch } from "../../TournamentWizard";
import type { StageConfig, IntakeMapping } from "@/app/lib/types";

/**
 * Normalize slot_idx to be 1-based within each group (no holes, stable-ish order).
 * Returns normalized rows and whether anything changed.
 */
export function normalizeIntakeRows(
  rows: IntakeMapping[],
  groupsCount: number
): { rows: IntakeMapping[]; changed: boolean } {
  const buckets: IntakeMapping[][] = Array.from(
    { length: Math.max(1, groupsCount) },
    () => []
  );

  rows.forEach((r) => {
    const gi = clamp(0, groupsCount - 1, r.group_idx ?? 0);
    buckets[gi].push({ ...r, group_idx: gi });
  });

  const out: IntakeMapping[] = [];
  buckets.forEach((arr) => {
    // stable-ish: by slot, then round, then bracket_pos, then outcome (W before L)
    arr.sort(
      (a, b) =>
        (toInt(a.slot_idx) ?? 0) - (toInt(b.slot_idx) ?? 0) ||
        (toInt(a.round) ?? 0) - (toInt(b.round) ?? 0) ||
        (toInt(a.bracket_pos) ?? 0) - (toInt(b.bracket_pos) ?? 0) ||
        ((a.outcome === "W" ? 0 : 1) - (b.outcome === "W" ? 0 : 1))
    );
    // 1-based slot_idx
    arr.forEach((r, i) => out.push({ ...r, slot_idx: i + 1 }));
  });

  const changed = JSON.stringify(rows) !== JSON.stringify(out);
  return { rows: out, changed };
}

/**
 * Validate KO → Groups intake mappings.
 * - Ensures each (round, bracket_pos) exists in KO source
 * - Ensures group_idx is within bounds
 * - Warns if the same source (round, bracket_pos, outcome) is used multiple times
 */
export function validateKoIntake(
  rows: IntakeMapping[],
  koMatchesLite: Array<{ round: number; bracket_pos: number }>,
  groupsCount: number
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const koSet = new Set(koMatchesLite.map(k => key(k.round, k.bracket_pos)));
  const dupSourceCounter = new Map<string, number>();

  rows.forEach((r, i) => {
    const idx = i + 1;
    const gi = r.group_idx ?? 0;
    const rd = r.round ?? 0;
    const bp = r.bracket_pos ?? 0;
    const out = r.outcome ?? "W";

    // group bounds
    if (gi < 0 || gi >= Math.max(1, groupsCount)) {
      errors.push(
        `Γραμμή #${idx}: Ο όμιλος (${gi + 1}) είναι εκτός ορίων. Επιτρεπτό 1..${Math.max(1, groupsCount)}.`
      );
    }

    // KO existence
    if (!koSet.has(key(rd, bp))) {
      errors.push(
        `Γραμμή #${idx}: Δεν υπάρχει KO αγώνας με round=${rd} και bracket_pos=${bp}.`
      );
    }

    // duplicate source (same KO slot + outcome used more than once)
    const srcKey = `${rd}:${bp}:${out}`;
    dupSourceCounter.set(srcKey, (dupSourceCounter.get(srcKey) ?? 0) + 1);
  });

  // report duplicates as warnings (allowed but suspicious)
  for (const [src, count] of dupSourceCounter.entries()) {
    if (count > 1) {
      const [rd, bp, out] = src.split(":");
      warnings.push(
        `Το KO slot (round=${rd}, pos=${bp}, outcome=${out}) χρησιμοποιείται ${count} φορές στις χαρτογραφήσεις.`
      );
    }
  }

  return { errors, warnings };
}

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
    const gi = clamp(0, groupsCount - 1, r.group_idx ?? 0);
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
        is_ko: false,
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
          match_date: null,is_ko:true
        });
      }
    }
  }

  return out;
}


/* ----------------------------- helpers ----------------------------- */

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));
const toInt = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const key = (round: number, bp: number) => `${round}|${bp}`;
