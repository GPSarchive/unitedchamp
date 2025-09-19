// app/components/DashboardPageComponents/TournamentCURD/util/Generators.ts
import type { DraftMatch } from "../TournamentWizard";
import type { NewTournamentPayload, StageConfig } from "@/app/lib/types";
import type { TeamDraft } from "../TournamentWizard";

import { shuffleArray } from "./functions/common";
import { genRoundRobin } from "./functions/roundRobin";
import { genKnockoutAnyN } from "./functions/knockoutAnyN";
import {
  genGroupSkeletonRoundRobin,
  computeIntakeSlotsPerGroup,
} from "./functions/groupsIntake";

/**
 * Generate all draft matches for the whole tournament.
 * - League/groups:
 *    • Manual mode (default): Round-robin using admin-assigned groups.
 *    • Intake mode (KO → Groups active): Skeleton round-robin per group (team ids = null).
 * - Knockout:
 *    • From groups: take top N per group (by seed) and build bracket
 *      (2 groups × 2 advancers: build semis explicitly; otherwise go through AnyN).
 *    • Standalone: use global seeding; optional `standalone_bracket_size` trims the field.
 *
 * All KO paths return matches with stable pointers (home/away_source_round + _bracket_pos).
 */
export function generateDraftMatches({
  payload,
  teams,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
}): DraftMatch[] {
  const out: DraftMatch[] = [];
  const teamIds = teams.map((t) => t.id);

  // Ensure stable stage order
  const stages = payload.stages
    .slice()
    .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));

  stages.forEach((stage, stageIdx) => {
    const cfg = ((stage as any)?.config ?? {}) as StageConfig;

    // reads kept for compatibility
    const shuffle: boolean = !!(cfg.shuffle ?? (cfg as any)["τυχαία_σειρά"]);
    const repeatsRaw =
      cfg.rounds_per_opponent ?? (cfg as any)["αγώνες_ανά_αντίπαλο"];
    const doubleRound = !!(cfg.double_round ?? (cfg as any)["διπλός_γύρος"]);
    const repeats: number = Number.isFinite(repeatsRaw)
      ? Math.max(1, Number(repeatsRaw))
      : doubleRound
      ? 2
      : 1;

    /* ---------------- LEAGUE ---------------- */
    if (stage.kind === "league") {
      const list = shuffle ? shuffleArray(teamIds) : teamIds.slice();
      out.push(
        ...genRoundRobin({
          stageIdx,
          groupIdx: null,
          teamIds: list,
          repeats,
          startDate: null,
          intervalDays: 0,
        })
      );
      return;
    }

    /* ---------------- GROUPS ---------------- */
    if (stage.kind === "groups") {
      const groups = stage.groups ?? [];
      const intakeEnabled =
        Number.isFinite((cfg as any).from_knockout_stage_idx) &&
        ((cfg.groups_intake?.length ?? 0) > 0);

      if (intakeEnabled) {
        // KO → Groups intake: build SKELETON schedules based on slots per group
        const slotsPerGroup = computeIntakeSlotsPerGroup(cfg, groups.length);
        slotsPerGroup.forEach((slots, gi) => {
          if (slots >= 2) {
            out.push(
              ...genGroupSkeletonRoundRobin({
                stageIdx,
                groupIdx: gi,
                slotsCount: slots,
                repeats,
              })
            );
          }
        });
        return;
      }

      // Manual mode: use admin assignments
      const hasAssign = teams.some(
        (t) => t.groupsByStage?.[stageIdx] != null
      );
      const assignments: number[][] = groups.map(() => []);
      if (hasAssign) {
        teams.forEach((t) => {
          const gi = t.groupsByStage?.[stageIdx];
          if (gi != null && assignments[gi]) assignments[gi].push(t.id);
        });
      } else {
        const pool = shuffle ? shuffleArray(teamIds) : teamIds.slice();
        pool.forEach((id, i) =>
          assignments[i % Math.max(1, groups.length)].push(id)
        );
      }

      assignments.forEach((ids, gi) => {
        if (ids.length >= 2) {
          const list = shuffle ? shuffleArray(ids) : ids.slice();
          out.push(
            ...genRoundRobin({
              stageIdx,
              groupIdx: gi,
              teamIds: list,
              repeats,
              startDate: null,
              intervalDays: 0,
            })
          );
        }
      });
      return;
    }

    /* ---------------- KNOCKOUT ---------------- */
    if (stage.kind === "knockout") {
      const fromStageIdx: number | undefined = Number.isFinite(
        (cfg as any).from_stage_idx
      )
        ? Number((cfg as any).from_stage_idx)
        : undefined;
      const advancersPerGroup: number = Number.isFinite(
        (cfg as any).advancers_per_group
      )
        ? Math.max(1, Number((cfg as any).advancers_per_group))
        : 2;
      const semisCross: "A1-B2" | "A1-B1" =
        cfg.semis_cross === "A1-B1" ? "A1-B1" : "A1-B2";

      // Optional standalone bracket size (top-N seeds)
      const standaloneBracketSize: number | undefined = Number.isFinite(
        (cfg as any).standalone_bracket_size
      )
        ? Math.max(2, Number((cfg as any).standalone_bracket_size))
        : undefined;

      const srcStage =
        fromStageIdx != null ? payload.stages[fromStageIdx] : undefined;
      const isValidGroupsSource =
        srcStage && srcStage.kind === "groups" && (srcStage.groups?.length ?? 0) > 0;

      if (isValidGroupsSource) {
        const groups = srcStage!.groups ?? [];
        const G = groups.length;

        // Collect entrants per group based on TeamDraft.groupsByStage[fromStageIdx]
        const perGroup: number[][] = Array.from({ length: G }, () => []);
        teams.forEach((t) => {
          const gi = t.groupsByStage?.[fromStageIdx!];
          if (gi != null && gi >= 0 && gi < G) perGroup[gi].push(t.id);
        });

        // sort each group's entrants by seed asc, keep top N
        const byId: Record<number, TeamDraft> = Object.fromEntries(
          teams.map((t) => [t.id, t])
        );
        perGroup.forEach((arr, idx) => {
          arr.sort(
            (a, b) => (byId[a].seed ?? Number.POSITIVE_INFINITY) - (byId[b].seed ?? Number.POSITIVE_INFINITY)
          );
          perGroup[idx] = arr.slice(0, advancersPerGroup);
        });

        const qualifiersFlat = perGroup.flat();

        // Special case: 2 groups, 2 advancers each -> Semis + Final (explicit semis, stable pointers for final)
        if (
          G === 2 &&
          advancersPerGroup === 2 &&
          perGroup[0]?.length >= 2 &&
          perGroup[1]?.length >= 2
        ) {
          const [A1, A2] = perGroup[0];
          const [B1, B2] = perGroup[1];

          const semiPairs =
            semisCross === "A1-B2"
              ? [
                  [A1 ?? null, B2 ?? null], // SF1: A1 vs B2
                  [B1 ?? null, A2 ?? null], // SF2: B1 vs A2
                ]
              : [
                  [A1 ?? null, B1 ?? null], // SF1: A1 vs B1
                  [A2 ?? null, B2 ?? null], // SF2: A2 vs B2
                ];

          const sfStartIdx = out.length;

          semiPairs.forEach((pair, i) => {
            out.push({
              stageIdx,
              round: 1,
              bracket_pos: i + 1,
              team_a_id: pair[0] ?? null,
              team_b_id: pair[1] ?? null,
            });
          });

          // Final (round 2): winners of SF1 & SF2, include stable round/pos
          out.push({
            stageIdx,
            round: 2,
            bracket_pos: 1,
            home_source_match_idx: sfStartIdx + 0,
            home_source_outcome: "W",
            away_source_match_idx: sfStartIdx + 1,
            away_source_outcome: "W",
            // stable pointers for durability:
            home_source_round: 1,
            home_source_bracket_pos: 1,
            away_source_round: 1,
            away_source_bracket_pos: 2,
          });

          return;
        }

        // Generic from-groups: seed globally (by team seed), let AnyN handle byes + stable pointers
        const qualifiersSeeded = qualifiersFlat
          .map((id) => ({ id, seed: byId[id].seed ?? Number.POSITIVE_INFINITY }))
          .sort((a, b) => a.seed - b.seed)
          .map((x, i) => ({ id: x.id, seed: Number.isFinite(x.seed) ? (x.seed as number) : i + 1 }));

        const ids = qualifiersSeeded.map((s) => s.id);
        out.push(...genKnockoutAnyN(ids, stageIdx, qualifiersSeeded));
        return;
      }

      // Standalone knockout (no source groups) — use global seeds, optionally limit to top-N
      const seededAll = teams
        .slice()
        .sort(
          (a, b) =>
            (a.seed ?? Number.POSITIVE_INFINITY) -
            (b.seed ?? Number.POSITIVE_INFINITY)
        )
        .map((t, i) => ({
          id: t.id,
          seed: Number.isFinite(t.seed as any) ? (t.seed as number) : i + 1,
        }));

      const entrants =
        typeof standaloneBracketSize === "number"
          ? seededAll.slice(
              0,
              Math.min(standaloneBracketSize, seededAll.length)
            )
          : seededAll;

      const ids = entrants.map((s) => s.id);
      // AnyN also handles exact powers of two and writes stable pointers.
      out.push(...genKnockoutAnyN(ids, stageIdx, entrants));
    }
  });

  return out;
}
