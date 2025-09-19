// app/components/DashboardPageComponents/TournamentCURD/stages/ModernKnockoutTree/utils/seeding.ts
import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";
import type { Option } from "./types";

/** Build the select options for editable first-round slots */
export function buildMakeOptions({
  eligible,
  assignedIdsFR,
  usedSeedsFR,
  teamsMap,
  lang,
  L,
}: {
  eligible: number[];
  assignedIdsFR: Set<number>;
  usedSeedsFR: Set<number>;
  teamsMap: TeamsMap;
  lang: "en" | "el";
  L: Labels;
}) {
  return (currentTeamId: number | null): Option[] => {
    const currentSeed = currentTeamId != null ? (teamsMap[currentTeamId]?.seed ?? null) : null;
    const opts: Option[] = [
      { id: null, label: lang === "el" ? "— Κενό —" : "— Empty —", disabled: false },
      ...eligible
        .map((id) => {
          const t = teamsMap[id];
          const s = t?.seed ?? null;
          const takenByTeam = assignedIdsFR.has(id) && id !== currentTeamId;
          const duplicateSeed = s != null && usedSeedsFR.has(s as number) && s !== currentSeed;
          return {
            id,
            label: s != null ? `#${s} — ${t?.name ?? id}` : t?.name ?? String(id),
            disabled: takenByTeam || duplicateSeed,
            reason: takenByTeam ? "already in bracket" : duplicateSeed ? L.seedTaken : undefined,
          } as Option;
        })
        .sort((a: Option, b: Option) => {
          const sa = a.id != null ? (teamsMap[a.id]?.seed ?? 9999) : 9999;
          const sb = b.id != null ? (teamsMap[b.id]?.seed ?? 9999) : 9999;
          return sa - sb;
        }),
    ];
    return opts;
  };
}

/** Combine auto-assign + 1..N vs N..1 pairing for R1 */
export function buildAutoSeedAndPair({
  firstRound,
  eligible,
  teamsMap,
  onAutoAssignTeamSeeds,
  onBulkAssignFirstRound,
  onAssignSlot,
}: {
  firstRound: Match[];
  eligible: number[];
  teamsMap: TeamsMap;
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
  onBulkAssignFirstRound?: (
    rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>
  ) => void;
  onAssignSlot?: (matchId: number, slot: "A" | "B", teamId: number | null) => void;
}) {
  return async () => {
    let orderedIds: number[] | null = null;
    if (onAutoAssignTeamSeeds) {
      try {
        const res = await Promise.resolve(onAutoAssignTeamSeeds());
        if (Array.isArray(res)) orderedIds = res;
      } catch {
        // ignore; fall back to current seeds
      }
    }

    const pool: number[] =
      orderedIds ??
      eligible
        .map((id) => ({ id, seed: teamsMap[id]?.seed ?? Infinity }))
        .filter((x) => Number.isFinite(x.seed))
        .sort((a, b) => a.seed - b.seed)
        .map((x) => x.id);

    const S = firstRound.length * 2;
    const top = pool.slice(0, S);

    const rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }> =
      firstRound.map((m, i) => ({
        matchId: m.id,
        team_a_id: top[i] ?? null,
        team_b_id: top[S - 1 - i] ?? null,
      }));

    if (onBulkAssignFirstRound) onBulkAssignFirstRound(rows);
    else if (onAssignSlot) {
      rows.forEach((r) => {
        onAssignSlot(r.matchId, "A", r.team_a_id);
        onAssignSlot(r.matchId, "B", r.team_b_id);
      });
    }
  };
}
