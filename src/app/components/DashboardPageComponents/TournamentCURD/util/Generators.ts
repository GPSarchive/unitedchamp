// app/components/DashboardPageComponents/TournamentCURD/util/Generators.ts
import type { DraftMatch } from "../TournamentWizard";
import type { NewTournamentPayload, StageConfig } from "@/app/lib/types";
import type { TeamDraft } from "../TournamentWizard";

import { shuffleArray } from "./functions/common";
import { genRoundRobin } from "./functions/roundRobin";
import { genKnockoutPowerOfTwo } from "./functions/knockoutPowerOfTwo";
import { genKnockoutAnyN } from "./functions/knockoutAnyN";
import { genGroupSkeletonRoundRobin, computeIntakeSlotsPerGroup } from "./functions/groupsIntake";

/**
 * Generate all draft matches for the whole tournament.
 * - League/groups:
 *    • Manual mode (default): Round-robin using admin-assigned groups.
 *    • Intake mode (KO → Groups active): Skeleton round-robin per group (team ids = null).
 * - Knockout:
 *    • From groups: take top N per group (by seed) and build bracket (semis TBD for 2×2).
 *    • Standalone: use global seeding; optional `standalone_bracket_size` trims the field.
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
  const stages = payload.stages.slice().sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));

  stages.forEach((stage, stageIdx) => {
    const cfg = ((stage as any)?.config ?? {}) as StageConfig;

    // reads kept for compatibility
    const shuffle: boolean = !!(cfg.shuffle ?? (cfg as any)["τυχαία_σειρά"]);
    const repeatsRaw = cfg.rounds_per_opponent ?? (cfg as any)["αγώνες_ανά_αντίπαλο"];
    const doubleRound = !!(cfg.double_round ?? (cfg as any)["διπλός_γύρος"]);
    const repeats: number = Number.isFinite(repeatsRaw)
      ? Math.max(1, Number(repeatsRaw))
      : doubleRound
      ? 2
      : 1;

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

    if (stage.kind === "groups") {
      const groups = stage.groups ?? [];
      const intakeEnabled =
        Number.isFinite(cfg.from_knockout_stage_idx as any) &&
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
      const hasAssign = teams.some((t) => t.groupsByStage?.[stageIdx] != null);
      const assignments: number[][] = groups.map(() => []);
      if (hasAssign) {
        teams.forEach((t) => {
          const gi = t.groupsByStage?.[stageIdx];
          if (gi != null && assignments[gi]) assignments[gi].push(t.id);
        });
      } else {
        const pool = shuffle ? shuffleArray(teamIds) : teamIds.slice();
        pool.forEach((id, i) => assignments[i % Math.max(1, groups.length)].push(id));
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

    if (stage.kind === "knockout") {
      const fromStageIdx: number | undefined = Number.isFinite(cfg.from_stage_idx as any)
        ? Number(cfg.from_stage_idx)
        : undefined;
      const advancersPerGroup: number = Number.isFinite(cfg.advancers_per_group as any)
        ? Math.max(1, Number(cfg.advancers_per_group))
        : 2;
      const semisCross: "A1-B2" | "A1-B1" = cfg.semis_cross === "A1-B1" ? "A1-B1" : "A1-B2";

      // Optional standalone bracket size (top-N seeds)
      const standaloneBracketSize: number | undefined = Number.isFinite(
        cfg.standalone_bracket_size as any
      )
        ? Math.max(2, Number(cfg.standalone_bracket_size))
        : undefined;

      const srcStage = fromStageIdx != null ? payload.stages[fromStageIdx] : undefined;
      const isValidGroupsSource = srcStage && srcStage.kind === "groups" && (srcStage.groups?.length ?? 0) > 0;

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
        const byId: Record<number, TeamDraft> = Object.fromEntries(teams.map((t) => [t.id, t]));
        perGroup.forEach((arr, idx) => {
          arr.sort((a, b) => (byId[a].seed ?? 1e9) - (byId[b].seed ?? 1e9));
          perGroup[idx] = arr.slice(0, advancersPerGroup);
        });

        const qualifiers = perGroup.flat();

        // Special case: 2 groups, 2 advancers each -> Semis + Final (TBD semis)
        if (G === 2 && advancersPerGroup === 2 && qualifiers.length === 4) {
          const semiPairs =
            semisCross === "A1-B2"
              ? [
                  [null, null], // A1 vs B2
                  [null, null], // B1 vs A2
                ]
              : [
                  [null, null], // A1 vs B1
                  [null, null], // A2 vs B2
                ];

          semiPairs.forEach((_pair, i) => {
            out.push({
              stageIdx,
              round: 1,
              bracket_pos: i + 1,
              team_a_id: null,
              team_b_id: null,
            });
          });

          // Final (round 2): winners of SF1 & SF2
          out.push({
            stageIdx,
            round: 2,
            bracket_pos: 1,
            home_source_match_idx: out.length - 2, // SF1
            home_source_outcome: "W",
            away_source_match_idx: out.length - 1, // SF2
            away_source_outcome: "W",
          });

          return;
        }

        // Generic from-groups: power-of-two -> seeded bracket; else -> byes
        const q = qualifiers.slice();
        const isPow2 = q.length > 0 && (q.length & (q.length - 1)) === 0;
        if (isPow2) out.push(...genKnockoutPowerOfTwo(q, stageIdx));
        else {
          const seeded = q.map((id, i) => ({ id, seed: i + 1 }));
          out.push(...genKnockoutAnyN(q, stageIdx, seeded));
        }
        return;
      }

      // Standalone knockout (no source groups) — use global seeds, optionally limit to top-N
      const seededAll = teams
        .slice()
        .sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9))
        .map((t, i) => ({ id: t.id, seed: t.seed ?? i + 1 }));

      const entrants =
        typeof standaloneBracketSize === "number"
          ? seededAll.slice(0, Math.min(standaloneBracketSize, seededAll.length))
          : seededAll;

      const ids = entrants.map((s) => s.id);
      const N = ids.length;
      const isPowerOfTwo = N > 0 && (N & (N - 1)) === 0;

      if (isPowerOfTwo) out.push(...genKnockoutPowerOfTwo(ids, stageIdx));
      else out.push(...genKnockoutAnyN(ids, stageIdx, entrants));
    }
  });

  return out;
}
