// app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/newknockout/BracketBuilder2.tsx
"use client";

/**
 * BracketBuilder2 — hybrid knockout builder (2.0).
 *
 * Two modes share one canvas:
 *  - GENERATE: pick bracket size + seeding + single/double round, then build the
 *    whole tree (reusing the proven genKnockoutAnyN + expandSelectedToTwoLegs).
 *  - EDIT: a polished, leg-aware canvas (reusing BracketEditor's drag/SVG engine).
 *    Inline team pickers on leaf slots, a per-tie "2 legs" toggle, aggregate /
 *    per-leg / penalty display mirroring the public KOStageDisplay. Raw wiring
 *    (source pointers, bracket_pos) lives behind an "Advanced" toggle.
 *
 * All writes go through the existing store mutators, so the save-all path and
 * progression are untouched.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BracketEditor, { type NodeBox, type Edge, type NodeGroup } from "./BracketEditor";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import type { TournamentState } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { genKnockoutAnyN } from "@/app/dashboard/tournaments/TournamentCURD/util/functions/knockoutAnyN";
import { expandSelectedToTwoLegs } from "@/app/dashboard/tournaments/TournamentCURD/util/functions/common";

/* ============================ Types ============================ */
type TeamsMap = Record<number | string, { name: string; logo?: string | null; seed?: number | null }>;
type NodeMeta = { round: number; bracket_pos: number };

/* ============================ Fallbacks ============================ */
const EMPTY_OBJ = Object.freeze({}) as Record<string, never>;
const EMPTY_ARR = Object.freeze([]) as ReadonlyArray<never>;

/* ============================ Selectors ============================ */
const selUpdateMatches     = (s: TournamentState) => s.updateMatches;
const selSetKOLegCount     = (s: TournamentState) => s.setKOLegCount;
const selReindexKOPointers = (s: TournamentState) => s.reindexKOPointers;
const selStagesById        = (s: TournamentState) => (s.entities?.stagesById ?? EMPTY_OBJ) as Record<number, any>;
const selStageIdByIndex    = (s: TournamentState) => (s.ids?.stageIdByIndex ?? {}) as Record<number, number>;
const selTournamentTeams   = (s: TournamentState) =>
  (s.entities?.tournamentTeams ?? EMPTY_ARR) as ReadonlyArray<{ team_id: number; seed?: number | null }>;
const selDraftMatches      = (s: TournamentState) => s.draftMatches as DraftMatch[];
const selDbOverlayBySig    = (s: TournamentState) => s.dbOverlayBySig as Record<string, any>;

/* ============================ Helpers ============================ */
const slotKey = (r?: number | null, p?: number | null) => (r && p ? `R${r}-B${p}` : null);

function rowSignatureKO(m: DraftMatch) {
  return [m.stageIdx ?? "", m.round ?? "", m.bracket_pos ?? "", m.team_a_id ?? "", m.team_b_id ?? "", m.leg ?? ""].join("|");
}

function scoreFor(m: DraftMatch, teamId: number | null) {
  if (teamId == null) return 0;
  if (m.team_a_id === teamId) return (m as any).team_a_score ?? 0;
  if (m.team_b_id === teamId) return (m as any).team_b_score ?? 0;
  return 0;
}

const roundLabel = (round: number, maxRound: number) => {
  const fromEnd = maxRound - round; // 0 = final
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Quarterfinal";
  return `Round ${round}`;
};

/* ============================ Component ============================ */
export default function BracketBuilder2({
  stageIdx,
  teamsMap,
}: {
  stageIdx: number;
  teamsMap: TeamsMap;
}) {
  const updateMatches     = useTournamentStore(selUpdateMatches);
  const setKOLegCount     = useTournamentStore(selSetKOLegCount);
  const reindexKOPointers = useTournamentStore(selReindexKOPointers);
  const stagesById        = useTournamentStore(selStagesById);
  const stageIdByIndex    = useTournamentStore(selStageIdByIndex);
  const tournamentTeams   = useTournamentStore(selTournamentTeams);
  const draftMatches      = useTournamentStore(selDraftMatches);
  const dbOverlayBySig    = useTournamentStore(selDbOverlayBySig);

  const [advanced, setAdvanced] = useState(false);

  /* ---- participants (id + seed), used for generation and team pickers ---- */
  const participants = useMemo(() => {
    const fromStore = (tournamentTeams ?? EMPTY_ARR)
      .map((tt) => ({ id: tt.team_id, seed: tt.seed ?? null }))
      .filter((t) => typeof t.id === "number");
    if (fromStore.length) return fromStore;
    return Object.keys(teamsMap ?? {})
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .map((id) => ({ id, seed: (teamsMap as any)[id]?.seed ?? null }));
  }, [tournamentTeams, teamsMap]);

  const getTeamName = useCallback(
    (id: number | null | undefined) => {
      if (id == null) return "TBD";
      const rec = (teamsMap as any)[id] ?? (teamsMap as any)[String(id)];
      return rec?.name ?? `Team #${id}`;
    },
    [teamsMap]
  );
  const getTeamLogo = useCallback(
    (id: number | null | undefined) => {
      if (id == null) return null;
      const rec = (teamsMap as any)[id] ?? (teamsMap as any)[String(id)];
      return rec?.logo ?? null;
    },
    [teamsMap]
  );

  /* ---- merge overlay onto this stage's rows (read-only display) ---- */
  const rows = useMemo<DraftMatch[]>(() => {
    return draftMatches
      .filter((m) => m.stageIdx === stageIdx && (m.round ?? null) != null && (m.bracket_pos ?? null) != null)
      .map((r) => {
        const ov = dbOverlayBySig[rowSignatureKO(r)];
        // overlay keyed differently here is fine; draft rows already carry live data
        return ov ? { ...r, ...ov } : r;
      });
  }, [draftMatches, dbOverlayBySig, stageIdx]);

  const maxRound = useMemo(
    () => (rows.length ? Math.max(...rows.map((m) => m.round ?? 1)) : 1),
    [rows]
  );

  /* ---- group rows per slot (both legs) ---- */
  const legsBySlot = useMemo(() => {
    const m = new Map<string, DraftMatch[]>();
    rows.forEach((r) => {
      const key = slotKey(r.round, r.bracket_pos)!;
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    });
    for (const arr of m.values()) arr.sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
    return m;
  }, [rows]);

  /* ---- build canvas nodes/edges/groups: ONE BOX PER LEG (like the match planner) ----
     A two-legged tie shows two stacked cards (Leg 1 / Leg 2) wrapped in a dashed
     "tie" container, with a cyan dashed connector tying the two legs together.
     Node id encodes the leg: R{r}-B{p}-L{leg}. Progression edges run from a parent's
     DECIDER card (leg 2, or the single card) to the child's leg-1 card, so the tree
     still reads left-to-right; leg edges are vertical, inside each tie box. */
  const colW = 300, legH = 116, legGap = 18, slotGap = 30, x0 = 40, y0 = 48;
  const groupPadX = 12, groupPadTop = 22, groupPadBottom = 12; // tie-container insets

  const legNodeId = (r: number, p: number, leg: number | null | undefined) => `R${r}-B${p}-L${leg ?? 0}`;
  const tieGroupId = (r: number, p: number) => `TIE-R${r}-B${p}`;
  const deciderId = (r: number, p: number) => {
    const slot = legsBySlot.get(slotKey(r, p)!) ?? [];
    const dec = slot.find((m) => m.leg === 2) ?? slot[slot.length - 1] ?? slot[0];
    return dec ? legNodeId(r, p, dec.leg) : null;
  };

  const { nodes, connections, nodeByLegId, baseGroups } = useMemo(() => {
    const nx: NodeBox[] = [];
    const edges: Edge[] = [];
    const grp: Array<NodeGroup & { round: number; bracket_pos: number; legCount: number }> = [];
    const byId: Record<string, { row: DraftMatch; round: number; bracket_pos: number; leg: number | null; legCount: number }> = {};

    // sort slots by (round, bracket_pos) for stable vertical packing per column
    const slotEntries = Array.from(legsBySlot.entries()).sort((a, b) => {
      const A = a[1][0], B = b[1][0];
      return (A.round ?? 0) - (B.round ?? 0) || (A.bracket_pos ?? 0) - (B.bracket_pos ?? 0);
    });

    const nodeW = 240;
    // track the running y per column so stacked legs + slots don't overlap
    const colNextY = new Map<number, number>();
    const stackHeight = (legCount: number) => legCount * legH + (legCount - 1) * legGap;

    slotEntries.forEach(([, slotRows]) => {
      const sample = slotRows[0];
      const r = sample.round ?? 1;
      const b = sample.bracket_pos ?? 1;
      const legCount = slotRows.length;
      const twoLegged = legCount > 1;

      // A two-legged tie reserves extra room for its surrounding container.
      const stackH = stackHeight(legCount);
      const blockH = twoLegged ? stackH + groupPadTop + groupPadBottom : stackH;

      const startY = colNextY.get(r) ?? y0;
      colNextY.set(r, startY + blockH + slotGap);

      const colX = (r - 1) * colW + x0;
      // Cards sit inset inside the tie container (when two-legged).
      const cardX = twoLegged ? colX + groupPadX : colX;
      const cardsTop = twoLegged ? startY + groupPadTop : startY;

      slotRows.forEach((row, li) => {
        const id = legNodeId(r, b, row.leg);
        nx.push({
          id,
          x: cardX,
          y: cardsTop + li * (legH + legGap),
          w: nodeW,
          h: legH,
          label: roundLabel(r, maxRound),
          // Both legs of a tie share a drag group so they move together.
          group: twoLegged ? tieGroupId(r, b) : undefined,
        });
        byId[id] = { row, round: r, bracket_pos: b, leg: row.leg ?? null, legCount };
      });

      if (twoLegged) {
        // Tie container wrapping both leg cards.
        grp.push({
          id: tieGroupId(r, b),
          x: colX,
          y: startY,
          w: nodeW + groupPadX * 2,
          h: blockH,
          label: "Tie",
          round: r,
          bracket_pos: b,
          legCount,
        });
        // Leg connector: leg-1 card -> leg-2 card (vertical, dashed).
        const leg1 = slotRows.find((m) => m.leg !== 2) ?? slotRows[0];
        const leg2 = slotRows.find((m) => m.leg === 2);
        if (leg2) {
          edges.push({
            from: legNodeId(r, b, leg1.leg),
            to: legNodeId(r, b, leg2.leg),
            kind: "leg",
          });
        }
      }

      // Progression edges: parent decider -> this slot's leg-1 (or single) card.
      const parentDeciders = [
        sample.home_source_round && sample.home_source_bracket_pos
          ? deciderId(sample.home_source_round, sample.home_source_bracket_pos) : null,
        sample.away_source_round && sample.away_source_bracket_pos
          ? deciderId(sample.away_source_round, sample.away_source_bracket_pos) : null,
      ].filter(Boolean) as string[];
      const firstLegId = legNodeId(r, b, slotRows[0].leg);
      parentDeciders.forEach((pid) => edges.push({ from: pid, to: firstLegId, kind: "progress" }));
    });

    return { nodes: nx, connections: edges, nodeByLegId: byId, baseGroups: grp };
  }, [legsBySlot, maxRound]);

  /* ---- editor needs its own node state for dragging only (positions) ---- */
  const [posOverride, setPosOverride] = useState<Record<string, { x: number; y: number }>>({});
  const positionedNodes = useMemo(
    () => nodes.map((n) => (posOverride[n.id] ? { ...n, ...posOverride[n.id] } : n)),
    [nodes, posOverride]
  );
  const onNodesChange = useCallback((next: NodeBox[]) => {
    setPosOverride((prev) => {
      const out = { ...prev };
      next.forEach((n) => (out[n.id] = { x: n.x, y: n.y }));
      return out;
    });
  }, []);

  /* ---- per-leg finished detection ---- */
  const rowFinished = (m: DraftMatch) => {
    const s = (m as any).status, a = (m as any).team_a_score, b = (m as any).team_b_score, w = (m as any).winner_team_id;
    return s === "finished" || typeof a === "number" || typeof b === "number" || w != null;
  };
  const finishedLegIds = useMemo(() => {
    const done = new Set<string>();
    nodes.forEach((n) => {
      const info = nodeByLegId[n.id];
      if (info && rowFinished(info.row)) done.add(n.id);
    });
    return done;
  }, [nodes, nodeByLegId]);

  /* ---- aggregate (+pens) for a slot, attached to the leg-2 card ---- */
  const slotAggregate = useCallback(
    (round: number, bracket_pos: number) => {
      const slotRows = legsBySlot.get(slotKey(round, bracket_pos)!) ?? [];
      if (slotRows.length < 2 && !slotRows.some((m) => m.leg != null)) return null;
      const leg2 = slotRows.find((m) => m.leg === 2) ?? slotRows[slotRows.length - 1];
      const leg1 = slotRows.find((m) => m !== leg2) ?? null;
      const ordered = [leg1, leg2].filter(Boolean) as DraftMatch[];
      const teamA = leg2.team_a_id ?? null;
      const teamB = leg2.team_b_id ?? null;
      const allFinished = ordered.length > 0 && ordered.every((m) => (m as any).status === "finished");
      return {
        allFinished,
        aggA: allFinished ? ordered.reduce((s, m) => s + scoreFor(m, teamA), 0) : null,
        aggB: allFinished ? ordered.reduce((s, m) => s + scoreFor(m, teamB), 0) : null,
        penA: (leg2 as any).penalty_a ?? null,
        penB: (leg2 as any).penalty_b ?? null,
      };
    },
    [legsBySlot]
  );

  /* ---- tie containers, geometry tracked off the (possibly dragged) leg cards ----
     Recomputed from positionedNodes so the box follows when a leg card is moved,
     and enriched with the aggregate accent + finished state. */
  const posById = useMemo(() => {
    const m = new Map<string, NodeBox>();
    positionedNodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [positionedNodes]);

  const groups = useMemo<NodeGroup[]>(() => {
    return baseGroups.map((g) => {
      const slot = legsBySlot.get(slotKey(g.round, g.bracket_pos)!) ?? [];
      const legNodes = slot
        .map((row) => posById.get(legNodeId(g.round, g.bracket_pos, row.leg)))
        .filter(Boolean) as NodeBox[];

      // Fall back to the static geometry if nodes aren't resolvable.
      const box = legNodes.length
        ? {
            x: Math.min(...legNodes.map((n) => n.x)) - groupPadX,
            y: Math.min(...legNodes.map((n) => n.y)) - groupPadTop,
            w: Math.max(...legNodes.map((n) => n.w)) + groupPadX * 2,
            h:
              Math.max(...legNodes.map((n) => n.y + n.h)) -
              Math.min(...legNodes.map((n) => n.y)) +
              groupPadTop +
              groupPadBottom,
          }
        : { x: g.x, y: g.y, w: g.w, h: g.h };

      const agg = slotAggregate(g.round, g.bracket_pos);
      const accent =
        agg?.allFinished && agg.aggA != null
          ? `agg ${agg.aggA}–${agg.aggB}${agg.penA != null && agg.penB != null ? ` · pens ${agg.penA}-${agg.penB}` : ""}`
          : "2 legs";
      const finished = legNodes.length > 0 && legNodes.every((n) => finishedLegIds.has(n.id));

      return { id: g.id, ...box, label: "Tie", accent, finished };
    });
  }, [baseGroups, legsBySlot, posById, slotAggregate, finishedLegIds]);

  /* ============================ GENERATE ============================ */
  const detectedSize = useMemo(() => Math.max(2, participants.length || 2), [participants.length]);
  const [genSize, setGenSize] = useState<number>(detectedSize);
  const [genDouble, setGenDouble] = useState<boolean>(false);
  const [genSeeding, setGenSeeding] = useState<"seed" | "random" | "as-is">("seed");
  useEffect(() => setGenSize(detectedSize), [detectedSize]);

  // Reflect existing double-round config from the stage on mount
  useEffect(() => {
    const sid = stageIdByIndex[stageIdx];
    const cfg = sid ? stagesById[sid]?.config : null;
    if (cfg && typeof cfg.double_round_ko === "boolean") setGenDouble(cfg.double_round_ko);
  }, [stageIdx, stageIdByIndex, stagesById]);

  const hasExisting = nodes.length > 0;

  const runGenerate = useCallback(() => {
    const pool = participants.slice(0, Math.max(2, genSize));
    let seeded: Array<{ id: number; seed: number }>;
    if (genSeeding === "random") {
      const shuffled = pool.slice();
      // deterministic-enough shuffle (avoids Math.random ban concerns in non-workflow code: fine here)
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      seeded = shuffled.map((t, i) => ({ id: t.id, seed: i + 1 }));
    } else if (genSeeding === "as-is") {
      seeded = pool.map((t, i) => ({ id: t.id, seed: i + 1 }));
    } else {
      seeded = pool
        .map((t, i) => ({ id: t.id, seed: t.seed ?? Number.POSITIVE_INFINITY, fallback: i + 1 }))
        .sort((a, b) => a.seed - b.seed)
        .map((t, i) => ({ id: t.id, seed: Number.isFinite(t.seed) ? (t.seed as number) : i + 1 }));
    }

    const ids = seeded.map((s) => s.id);
    let built = genKnockoutAnyN(ids, stageIdx, seeded);
    if (genDouble) built = expandSelectedToTwoLegs(built, () => true);

    updateMatches(stageIdx, () => built);
    reindexKOPointers(stageIdx);
    setPosOverride({});
  }, [participants, genSize, genSeeding, genDouble, stageIdx, updateMatches, reindexKOPointers]);

  const confirmGenerate = useCallback(() => {
    if (hasExisting && !confirm("Regenerate this bracket? This replaces the current matches for this stage (scores will be lost).")) return;
    runGenerate();
  }, [hasExisting, runGenerate]);

  /* ---- set a slot's teams across both legs (leg 2 swapped orientation) ---- */
  const setSlotTeams = useCallback(
    (meta: NodeMeta, side: "A" | "B", value: number | null) => {
      updateMatches(stageIdx, (stageRows) => {
        const inSlot = (r: DraftMatch) => r.round === meta.round && r.bracket_pos === meta.bracket_pos;
        // Base orientation from the leg-1 (or single) row, so leg 2 can mirror it.
        const slot = stageRows.filter(inSlot);
        if (!slot.length) return stageRows;
        const base = slot.find((r) => r.leg === 1) ?? slot.find((r) => r.leg == null) ?? slot[0];
        const nextA = side === "A" ? value : base.team_a_id ?? null;
        const nextB = side === "B" ? value : base.team_b_id ?? null;
        return stageRows.map((r) => {
          if (!inSlot(r)) return r;
          // never overwrite a pointer-fed side with a manual team
          const hasParents =
            (r.home_source_round && r.home_source_bracket_pos) ||
            (r.away_source_round && r.away_source_bracket_pos);
          if (hasParents) return r;
          if (r.leg === 2) return { ...r, team_a_id: nextB, team_b_id: nextA };
          return { ...r, team_a_id: nextA, team_b_id: nextB };
        });
      });
    },
    [stageIdx, updateMatches]
  );

  /* ============================ Node card (one per leg) ============================ */
  const nodeContent = useCallback(
    (n: NodeBox) => {
      const info = nodeByLegId[n.id];
      if (!info) return null;
      const { row, round, bracket_pos, leg, legCount } = info;
      const twoLegged = legCount > 1 || leg != null;
      const isLeg1 = leg === 1 || (twoLegged && leg !== 2);
      const isLeg2 = leg === 2;
      const isSingle = !twoLegged;

      // Leaf = no parent feeds this slot. Team editing lives on the leg-1 / single card.
      const hasParents =
        (row.home_source_round && row.home_source_bracket_pos) ||
        (row.away_source_round && row.away_source_bracket_pos);
      const isLeaf = !hasParents;
      const canEditTeams = isLeaf && (isSingle || isLeg1);

      const finished = finishedLegIds.has(n.id);
      const agg = isLeg2 ? slotAggregate(round, bracket_pos) : null;

      const teamA = row.team_a_id ?? null;
      const teamB = row.team_b_id ?? null;

      const legTag = isSingle ? null : isLeg2 ? "Leg 2" : "Leg 1";

      const TeamRow = ({ side, id }: { side: "A" | "B"; id: number | null }) => {
        const logo = getTeamLogo(id);
        const score = finished
          ? (side === "A" ? (row as any).team_a_score : (row as any).team_b_score) ?? null
          : null;
        return (
          <div className="flex items-center gap-2 min-w-0">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full bg-white/5 ring-1 ring-white/10 shrink-0" />
            )}
            {canEditTeams ? (
              <select
                className="flex-1 min-w-0 bg-zinc-950/80 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white"
                value={id ?? ""}
                onChange={(e) => setSlotTeams({ round, bracket_pos }, side, e.target.value ? Number(e.target.value) : null)}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <option value="">— TBD —</option>
                {participants.map((t) => (
                  <option key={t.id} value={t.id}>{getTeamName(t.id)}</option>
                ))}
              </select>
            ) : (
              <span className={`flex-1 min-w-0 truncate text-xs ${id != null ? "text-white" : "text-white/50"}`}>
                {getTeamName(id)}
              </span>
            )}
            {score != null && (
              <span className="shrink-0 tabular-nums text-sm font-semibold text-white">{score}</span>
            )}
          </div>
        );
      };

      return (
        <div className="flex h-full w-full flex-col gap-1">
          {/* header: round + leg pill + status */}
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[10px] font-bold uppercase tracking-widest text-white/40">{n.label}</span>
              {legTag && (
                <span
                  className={[
                    "shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wider ring-1",
                    isLeg2
                      ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/30"
                      : "bg-white/5 text-white/55 ring-white/15",
                  ].join(" ")}
                >
                  {legTag}
                </span>
              )}
            </span>
            {finished ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">FT</span>
            ) : (
              <span className="text-[9px] uppercase tracking-wider text-white/25">—</span>
            )}
          </div>

          {/* teams (this leg's own orientation + score) */}
          <div className="flex flex-col gap-0.5">
            <TeamRow side="A" id={teamA} />
            <TeamRow side="B" id={teamB} />
          </div>

          {/* leg-2 footer: the tie is decided here. Aggregate lives on the tie
              container header now, so the card only flags pending / pens. */}
          {isLeg2 && agg && (
            <div className="mt-auto flex flex-wrap items-center gap-x-1.5 text-[9px] text-white/50">
              {!agg.allFinished && <span className="text-white/30">decider · aggregate pending</span>}
              {agg.penA != null && agg.penB != null && (
                <span className="rounded bg-amber-500/15 border border-amber-500/25 px-1 text-amber-300 tabular-nums">pens {agg.penA}-{agg.penB}</span>
              )}
            </div>
          )}

          {/* leg toggle: on single & leg-1 cards offer "+ 2nd leg"; on leg-2 offer collapse */}
          {(isSingle || isLeg1 || isLeg2) && (
            <div className={`flex items-center justify-between gap-2 ${isLeg2 && agg ? "" : "mt-auto"}`}>
              <button
                className={`rounded px-1.5 py-0.5 text-[9px] font-medium border transition-colors ${
                  twoLegged ? "border-white/15 bg-white/5 text-white/55 hover:bg-white/10" : "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setKOLegCount(stageIdx, { round, bracket_pos }, twoLegged ? 1 : 2);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title={twoLegged ? "Collapse to a single leg (removes leg 2)" : "Add a second leg (home & away)"}
              >
                {twoLegged ? "→ 1 leg" : "+ 2nd leg"}
              </button>
              {advanced && (
                <span className="text-[9px] text-white/30 tabular-nums">R{round}·B{bracket_pos}{legTag ? `·${leg}` : ""}</span>
              )}
            </div>
          )}
        </div>
      );
    },
    [nodeByLegId, finishedLegIds, slotAggregate, getTeamLogo, getTeamName, participants, setSlotTeams, setKOLegCount, stageIdx, advanced]
  );

  /* ============================ UI ============================ */
  return (
    <div className="space-y-3">
      {/* Generate panel */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">Teams</label>
            <input
              type="number"
              min={2}
              className="w-20 bg-zinc-950 border border-white/15 rounded px-2 py-1.5 text-sm text-white"
              value={genSize}
              onChange={(e) => setGenSize(Math.max(2, Number(e.target.value) || 2))}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">Seeding</label>
            <select
              className="bg-zinc-950 border border-white/15 rounded px-2 py-1.5 text-sm text-white"
              value={genSeeding}
              onChange={(e) => setGenSeeding(e.target.value as any)}
            >
              <option value="seed">By team seed</option>
              <option value="random">Random draw</option>
              <option value="as-is">Pool order</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">Rounds</label>
            <div className="inline-flex rounded-lg border border-white/15 overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm ${!genDouble ? "bg-cyan-500/20 text-cyan-200" : "bg-zinc-950 text-white/60 hover:bg-white/5"}`}
                onClick={() => setGenDouble(false)}
              >
                Single
              </button>
              <button
                className={`px-3 py-1.5 text-sm ${genDouble ? "bg-cyan-500/20 text-cyan-200" : "bg-zinc-950 text-white/60 hover:bg-white/5"}`}
                onClick={() => setGenDouble(true)}
              >
                Double (2 legs)
              </button>
            </div>
          </div>

          <button
            className="ml-auto px-4 py-2 rounded-lg bg-cyan-500/90 hover:bg-cyan-400 text-zinc-950 text-sm font-semibold transition-colors"
            onClick={confirmGenerate}
          >
            {hasExisting ? "Regenerate bracket" : "Generate bracket"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          Builds a seeded bracket (handles byes). After generating, edit teams inline on the first round and toggle any tie between 1 and 2 legs.
        </p>
      </div>

      {/* Canvas */}
      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-zinc-950/50 p-10 text-center">
          <p className="text-white/50 text-sm">No bracket yet. Set the options above and press <span className="text-cyan-300 font-medium">Generate bracket</span>.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[11px] text-white/40">
              <span>{nodes.length} card{nodes.length === 1 ? "" : "s"}</span>
              {groups.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0 w-5 border-t-2 border-dashed border-cyan-400/60" />
                  {groups.length} two-legged tie{groups.length === 1 ? "" : "s"} (Leg 1 ↕ Leg 2)
                </span>
              )}
              <span>· drag to reposition</span>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer">
              <input type="checkbox" className="accent-cyan-500" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
              Advanced wiring
            </label>
          </div>
          <BracketEditor
            nodes={positionedNodes}
            connections={connections}
            groups={groups}
            onNodesChange={onNodesChange}
            onConnectionsChange={() => { /* wiring edits handled via store in advanced flows */ }}
            nodeContent={nodeContent}
            isFinished={(id) => finishedLegIds.has(id)}
            snap={10}
          />
          {advanced && (
            <p className="text-[11px] text-amber-300/70">
              Advanced wiring is read-only here — regenerate to rewire the tree, or use the match planner below for manual source-pointer edits.
            </p>
          )}
        </>
      )}
    </div>
  );
}
