"use client";

import { useMemo } from "react";
import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";
import { getLabels } from "./labels";

import { RoundColumn } from "./RoundColumn";
import { useBracketData } from "./hooks/useBracketData";
import { useBracketLayout } from "./hooks/useBracketLayout";
import { buildMakeOptions, buildAutoSeedAndPair } from "./seeding";
import type { ModernKnockoutTreeProps, RoundLabelFnArgs } from "./types";
import CanvasBacklight from "./CanvasBacklight";

export default function ModernKnockoutTree({
  title = "Knockout Bracket",
  matches,
  teamsMap,
  onMatchClick,
  roundLabelFn,
  colWidth,
  minCardHeight = 76,
  gapX,
  maxAutoFit = 8,
  minRowGap = 12,
  lang = "en",
  labels,
  editable = false,
  eligibleTeamIds,
  onAssignSlot,
  onSwapPair,
  onBulkAssignFirstRound,
  onClearFirstRound,
  onAutoAssignTeamSeeds,
}: ModernKnockoutTreeProps) {
  /** Labels */
  const L: Labels = useMemo(() => getLabels(lang, labels), [lang, labels]);

  /** Core data (rounds, edges, counts, helpers) */
  const {
    rounds,
    counts,
    teamsPerRound,
    isStubId,
    edgesByPair,
    edgesKey,
  } = useBracketData(matches);

  /** Layout (DOM measurement, transforms, SVG paths) */
  const { containerRef, setNodeRef, transforms, paths } = useBracketLayout({
    rounds,
    edgesByPair,
    isStubId,
    minCardHeight,
    minRowGap,
    // whenever these change, recompute
    deps: [matches, rounds.length, edgesKey, minCardHeight, minRowGap],
  });

  /** Map helpers */
  const byId = useMemo(() => {
    const m = new Map<number, Match>();
    matches.forEach((mm) => m.set(mm.id, mm));
    return m;
  }, [matches]);

  /** Compute winner from scores (client type doesn’t have winner_team_id) */
  const winnerOf = (m: Match): number | null => {
    if (m.status !== "finished") return null;
    const as = m.team_a_score;
    const bs = m.team_b_score;
    if (as == null || bs == null) return null;
    if (as === bs) return null; // draw → no propagation
    const a = m.team_a_id ?? null;
    const b = m.team_b_id ?? null;
    if (a == null || b == null) return null;
    return as > bs ? a : b;
  };

  /** Which side (A/B) does a given parent feed for this child? */
  const resolveSide = (child: Match, parent: Match): "A" | "B" | null => {
    // explicit ids
    if (
      Number.isInteger((child as any).home_source_match_id) &&
      (child as any).home_source_match_id === parent.id
    ) return "A";
    if (
      Number.isInteger((child as any).away_source_match_id) &&
      (child as any).away_source_match_id === parent.id
    ) return "B";

    // stable (round, pos)
    if (
      Number.isFinite((child as any).home_source_round) &&
      Number.isFinite((child as any).home_source_bracket_pos) &&
      parent.round === (child as any).home_source_round &&
      parent.bracket_pos === (child as any).home_source_bracket_pos
    ) return "A";
    if (
      Number.isFinite((child as any).away_source_round) &&
      Number.isFinite((child as any).away_source_bracket_pos) &&
      parent.round === (child as any).away_source_round &&
      parent.bracket_pos === (child as any).away_source_bracket_pos
    ) return "B";

    // fallback to bracket rule: parents are (r-1, 2p-1) => A, (r-1, 2p) => B
    if (
      Number.isFinite(child.round) &&
      Number.isFinite(child.bracket_pos) &&
      Number.isFinite(parent.round) &&
      Number.isFinite(parent.bracket_pos)
    ) {
      const r = child.round as number;
      const p = child.bracket_pos as number;
      if (parent.round === r - 1 && parent.bracket_pos === 2 * p - 1) return "A";
      if (parent.round === r - 1 && parent.bracket_pos === 2 * p) return "B";
    }
    return null;
  };

  /**
   * UI-only progression:
   * For each child, if a parent is finished, inject its winner into child slot (A/B),
   * without touching the DB. We never override a non-null DB-assigned team.
   */
  const smartTeams = useMemo(() => {
    type Eff = { a: number | null; b: number | null; aDerived?: boolean; bDerived?: boolean };
    const map = new Map<number, Eff>();

    const children = new Set(edgesByPair.map((e) => e.toId));
    children.forEach((childId) => {
      const child = byId.get(childId);
      if (!child) return;

      let effA: number | null = null;
      let effB: number | null = null;
      let aDerived = false;
      let bDerived = false;

      edgesByPair
        .filter((e) => e.toId === childId)
        .forEach((e) => {
          const parent = byId.get(e.fromId);
          if (!parent) return;
          const w = winnerOf(parent);
          if (!w) return;

          const side = resolveSide(child, parent);
          if (side === "A" && (child.team_a_id == null) && effA == null) {
            effA = w;
            aDerived = true;
          } else if (side === "B" && (child.team_b_id == null) && effB == null) {
            effB = w;
            bDerived = true;
          }
        });

      if (effA != null || effB != null) {
        map.set(childId, { a: effA, b: effB, aDerived, bDerived });
      }
    });

    return map;
  }, [byId, edgesByPair]);

  /** Layout columns & gaps */
  const cols = rounds.length || 1;
  const autoCol = colWidth ?? (cols > maxAutoFit ? 220 : 280);
  const autoGap = gapX ?? (cols > maxAutoFit ? 12 : 16);

  /** Round labels (numbered by column index by default) */
  const defaultLabel = (a: RoundLabelFnArgs) => L.roundN(a.index + 1);
  const labelFor = (round: number, idx: number) => {
    const { matchesInRound, teamsInRound } = counts[idx] ?? { matchesInRound: 0, teamsInRound: 0 };
    const fn = roundLabelFn ?? defaultLabel;
    return fn({ round, index: idx, total: cols, matchesInRound, teamsInRound });
  };

  /** BYE badge helper */
  const hadBye = (roundIdx: number, teamId: number | null) => {
    if (teamId == null) return false;
    if (roundIdx === 0) return false;
    const prev = teamsPerRound[roundIdx - 1];
    return !prev?.has(teamId);
  };

  const titleText = lang === "el" && title === "Knockout Bracket" ? "Δέντρο Νοκ-άουτ" : title;

  /** ------------ First-round seeding helpers ------------ */
  const firstRound = rounds[0]?.list ?? [];

  const eligible: number[] = useMemo(() => {
    const ids =
      eligibleTeamIds && eligibleTeamIds.length
        ? eligibleTeamIds
        : Object.keys(teamsMap).map((x) => Number(x));
    return ids.filter((id) => teamsMap[id]?.seed != null);
  }, [eligibleTeamIds, teamsMap]);

  const assignedIdsFR = useMemo(() => {
    const ids = new Set<number>();
    firstRound.forEach((m) => {
      if (m.team_a_id != null) ids.add(m.team_a_id);
      if (m.team_b_id != null) ids.add(m.team_b_id);
    });
    return ids;
  }, [firstRound]);

  const usedSeedsFR = useMemo(() => {
    const used = new Set<number>();
    firstRound.forEach((m) => {
      const sa = m.team_a_id != null ? teamsMap[m.team_a_id]?.seed : null;
      const sb = m.team_b_id != null ? teamsMap[m.team_b_id]?.seed : null;
      if (sa != null) used.add(sa as number);
      if (sb != null) used.add(sb as number);
    });
    return used;
  }, [firstRound, teamsMap]);

  const makeOptions = buildMakeOptions({
    eligible,
    assignedIdsFR,
    usedSeedsFR,
    teamsMap,
    lang,
    L,
  });

  const autoSeedAndPair = buildAutoSeedAndPair({
    firstRound,
    eligible,
    teamsMap,
    onAutoAssignTeamSeeds,
    onBulkAssignFirstRound,
    onAssignSlot,
  });

  /** ---------- render ---------- */
  return (
    <section className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{titleText}</h2>

        {editable && firstRound.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
              onClick={autoSeedAndPair}
              title={L.autoSeed}
            >
              {L.autoSeed}
            </button>
            <button
              className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
              onClick={onClearFirstRound}
              title={L.clearRound}
            >
              {L.clearRound}
            </button>
          </div>
        )}
      </div>

      <div className="relative overflow-x-auto">
        <div
          ref={containerRef}
          className="relative grid auto-rows-min sm:grid-flow-col gap-x-4"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(${autoCol}px, ${autoCol}px))`,
            columnGap: autoGap,
          }}
        >
          {/* animated backlight overlay */}
          <CanvasBacklight
            paths={paths}
            // colors={["#fb923c", "#ef4444"]} // optional custom palette
          />

          {/* Columns */}
          {rounds.map(({ round, list }, roundIdx) => (
            <RoundColumn
              key={round}
              round={round}
              list={list}
              roundIdx={roundIdx}
              label={labelFor(round, roundIdx)}
              setNodeRef={setNodeRef}
              transforms={transforms}
              minCardHeight={minCardHeight}
              isStubId={isStubId}
              teamsMap={teamsMap}
              L={L}
              onMatchClick={onMatchClick}
              editable={editable}
              onAssignSlot={onAssignSlot}
              onSwapPair={onSwapPair}
              makeOptions={makeOptions}
              hadBye={hadBye}
              smartTeams={smartTeams} // NEW
            />
          ))}
        </div>
      </div>
    </section>
  );
}
