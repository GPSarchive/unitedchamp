"use client";

/**
 * KOBracketV2Dark — Knockout bracket for the v2.0 "DISPATCH" · Midnight edition.
 * Editorial broadsheet × kinetic brutalism, dark palette.
 * Near-black ground. Ivory ink. Orange signal. Saffron honours.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DraftMatch, Stage, Team } from "@/app/tournaments/useTournamentData";
import { formatMatchDate } from "@/app/lib/datetime";

// Palette aliases — dark edition (matches site: zinc-950 family + orange-400 accent)
const INK = "#F3EFE6";             // primary foreground (ivory on dark)
const IVORY = "#0a0a14";           // page / surface background (near-black)
const PANEL = "#13131d";           // elevated contrast panel (matches site #1a1a2e family)
const VERMILLION = "#fb923c";      // orange-400 signal (matches site accent)
const SAFFRON = "#E8B931";         // saffron/gold honour (kept)
const NAVY = "#0E2A3A";            // tertiary accent (kept)

type Connection = {
  from: string;
  to: string;
  winnerId: number | null;
  sourceTeamId: number | null;
  /** "leg" connectors tie the two legs of one tie (vertical, dashed). */
  kind?: "progress" | "leg";
};

type NodeBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  round: number;
  bracket_pos: number;
  label: string;
  isFinal: boolean;
  /** Cards sharing a group id are the two legs of one tie. */
  group?: string;
  /** Leg number (1/2) for a leg card; undefined for a single-leg slot. */
  leg?: number | null;
  /** Aggregate summary, attached to the leg-2 (decider) card only. */
  agg?: { a: number; b: number; finished: boolean; penA: number | null; penB: number | null } | null;
};

/** A tie frame drawn behind the two stacked leg cards of a two-legged tie. */
type TieFrame = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isFinal: boolean;
  finished: boolean;
  accent: string; // header text, e.g. "ΣΥΝΟΛΟ 3–2 · ΠΕΝ 4-5"
};

const pad2 = (n: number | string) => String(n).padStart(2, "0");

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function getRoundLabel(round: number, maxRound: number): string {
  const diff = maxRound - round;
  if (diff === 0) return "Τελικός";
  if (diff === 1) return "Ημιτελικά";
  if (diff === 2) return "Προημιτελικά";
  return `Φάση των ${Math.pow(2, maxRound - round + 1)}`;
}

function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const tension = dx * 0.5;
  const cx1 = x1 + (x2 > x1 ? tension : -tension);
  const cx2 = x2 + (x2 > x1 ? -tension : tension);
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}

// ───────────────────────────────────────────────────────────────────────
// Match card node
// ───────────────────────────────────────────────────────────────────────
const MatchNode: React.FC<{
  node: NodeBox;
  match: DraftMatch | undefined;
  teamById: Map<number, Team>;
}> = ({ node, match, teamById }) => {
  if (!match) return null;

  const a = match.team_a_id ? teamById.get(match.team_a_id) : null;
  const b = match.team_b_id ? teamById.get(match.team_b_id) : null;
  const isFinished = match.status === "finished";
  const aWon = isFinished && match.winner_team_id === match.team_a_id;
  const bWon = isFinished && match.winner_team_id === match.team_b_id;
  const tba = !match.team_a_id && !match.team_b_id;

  // Two-legged leg card: compact, with a leg tag; the aggregate lives on the
  // tie frame, so a leg card only flags itself (Leg 1 / Leg 2) + leg-2 pens.
  const isLeg = node.leg != null;
  const isLeg2 = node.leg === 2;
  const legTag = isLeg ? (isLeg2 ? "2ος ΑΓΩΝΑΣ" : "1ος ΑΓΩΝΑΣ") : null;
  const agg = node.agg ?? null;
  const compact = isLeg;

  const dateStr = match.match_date
    ? formatMatchDate(match.match_date, {
        day: "2-digit",
        month: "short",
      })
    : null;

  const accent = node.isFinal ? SAFFRON : VERMILLION;

  return (
    <div
      className={`relative flex h-full flex-col border-2 overflow-hidden ${
        tba ? "border-dashed" : ""
      }`}
      style={{
        borderColor: INK,
        background: IVORY,
        boxShadow: `4px 4px 0 0 ${INK}`,
      }}
    >
      {/* Header strip — round label (or leg tag) + date */}
      <div
        className={`flex items-center justify-between border-b-2 ${compact ? "px-2.5 py-1" : "px-3 py-1.5"}`}
        style={{
          borderColor: INK,
          background: node.isFinal && !isLeg ? PANEL : IVORY,
          color: INK,
        }}
      >
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: isLeg2 ? accent : node.isFinal ? SAFFRON : accent }}
        >
          {legTag ? legTag : `${node.isFinal ? "★ " : ""}${node.label}`}
        </span>
        {isFinished ? (
          <span
            className="border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em]"
            style={{
              borderColor: node.isFinal ? SAFFRON : INK,
              color: node.isFinal ? SAFFRON : INK,
            }}
          >
            FT
          </span>
        ) : dateStr ? (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: `${INK}99` }}
          >
            {dateStr}
          </span>
        ) : (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: `${INK}66` }}
          >
            ΤΒΑ
          </span>
        )}
      </div>

      {/* Team rows */}
      <div className="flex flex-1 flex-col justify-center">
        <TeamRow
          team={a}
          score={isFinished ? match.team_a_score : null}
          isWinner={aWon}
          isLoser={isFinished && bWon}
          isFinal={node.isFinal}
          compact={compact}
        />
        <div className="h-[2px]" style={{ background: `${INK}1A` }} />
        <TeamRow
          team={b}
          score={isFinished ? match.team_b_score : null}
          isWinner={bWon}
          isLoser={isFinished && aWon}
          isFinal={node.isFinal}
          compact={compact}
        />
      </div>

      {/* Bottom badge — coordinate (single) or leg status / pens (two-legged). */}
      <div
        className={`flex items-center justify-between border-t font-mono text-[9px] uppercase tracking-[0.25em] ${compact ? "px-2.5 py-0.5" : "px-3 py-1"}`}
        style={{
          borderColor: `${INK}22`,
          color: `${INK}55`,
        }}
      >
        {isLeg ? (
          <>
            <span>
              {isLeg2
                ? agg && !agg.finished
                  ? "ΚΡΙΣΙΜΟΣ"
                  : "2ος ΑΓΩΝΑΣ"
                : "1ος ΑΓΩΝΑΣ"}
            </span>
            {isLeg2 && agg && agg.penA != null && agg.penB != null ? (
              <span className="font-bold" style={{ color: SAFFRON }}>
                ΠΕΝ {agg.penA}-{agg.penB}
              </span>
            ) : isFinished && match.winner_team_id ? (
              <span className="font-bold" style={{ color: accent }}>
                ▶
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span>
              R{node.round} · B{pad2(node.bracket_pos)}
            </span>
            {isFinished && match.winner_team_id && (
              <span className="font-bold" style={{ color: accent }}>
                ▶ ΝΙΚΗΤΗΣ
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const TeamRow: React.FC<{
  team: Team | null | undefined;
  score: number | null | undefined;
  isWinner: boolean;
  isLoser: boolean;
  isFinal: boolean;
  compact?: boolean;
}> = ({ team, score, isWinner, isLoser, isFinal, compact = false }) => {
  const tbd = !team;
  const accent = isFinal ? SAFFRON : VERMILLION;
  const av = compact ? "h-7 w-7" : "h-9 w-9";
  const scoreBox = compact ? "h-7 min-w-[30px] text-base" : "h-9 min-w-[36px] text-lg";

  return (
    <div
      className={`flex items-center ${compact ? "gap-2 px-2.5 py-1.5" : "gap-3 px-3 py-2.5"}`}
      style={{
        background: isWinner
          ? isFinal
            ? `${SAFFRON}22`
            : `${VERMILLION}14`
          : "transparent",
      }}
    >
      {team?.logo ? (
        <img
          src={team.logo}
          alt=""
          className={`${av} shrink-0 rounded-full border-2 object-cover`}
          style={{
            borderColor: isWinner ? accent : `${INK}55`,
            opacity: isLoser ? 0.45 : 1,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/team-placeholder.svg";
          }}
        />
      ) : (
        <div
          className={`flex ${av} shrink-0 items-center justify-center rounded-full border-2`}
          style={{
            borderColor: tbd ? `${INK}33` : `${INK}55`,
            background: tbd ? "transparent" : `${INK}10`,
          }}
        >
          <span
            className="font-[var(--f-brutal)] text-sm"
            style={{ color: tbd ? `${INK}40` : `${INK}80` }}
          >
            {tbd ? "?" : (team?.name ?? "").charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <span
        className={`flex-1 truncate font-[var(--f-display)] font-semibold italic leading-tight ${compact ? "text-[13px]" : "text-[15px]"}`}
        style={{
          color: isWinner ? INK : isLoser ? `${INK}55` : tbd ? `${INK}40` : INK,
          fontStyle: tbd ? "italic" : undefined,
        }}
      >
        {team?.name ?? "ΤΒΑ"}
      </span>

      {score != null ? (
        <div
          className={`flex ${scoreBox} shrink-0 items-center justify-center border-2 font-[var(--f-brutal)] leading-none tabular-nums`}
          style={{
            borderColor: isWinner ? accent : INK,
            background: isWinner ? accent : IVORY,
            color: isWinner ? IVORY : isLoser ? `${INK}55` : INK,
          }}
        >
          {score}
        </div>
      ) : (
        <div
          className={`flex ${scoreBox} shrink-0 items-center justify-center border-2 border-dashed font-mono text-xs`}
          style={{
            borderColor: `${INK}33`,
            color: `${INK}33`,
          }}
        >
          —
        </div>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────
const KOBracketV2: React.FC<{
  stage: Stage;
  stageIdx: number;
  matches: DraftMatch[];
  teamById: Map<number, Team>;
  championTeamId?: number | null;
}> = ({ stage, stageIdx, matches, teamById, championTeamId }) => {
  // Collect knockout matches for this stage
  const stageMatches = useMemo(() => {
    return matches.filter((m) => {
      const byIdx = m.stageIdx === stageIdx;
      const byId = (m as any).stage_id === stage.id;
      return (
        (byIdx || byId) &&
        m.round != null &&
        m.bracket_pos != null
      );
    });
  }, [matches, stageIdx, stage.id]);

  // ── Layout
  const BOX_W = 280;
  const BOX_H = 148;          // single-leg card height
  const LEG_H = 120;          // each leg card inside a two-legged tie
  const LEG_GAP = 14;         // gap between the two stacked leg cards
  const TIE_PAD_X = 12;       // tie frame horizontal inset
  const TIE_PAD_TOP = 28;     // room for the tie frame header
  const TIE_PAD_BOTTOM = 12;
  const COL_GAP = 160; // gap between columns (in addition to BOX_W)
  const BASE_GAP_Y = 36; // baseline gap between round-1 siblings
  const X_MARGIN = 40;
  const Y_MARGIN = 40;

  const slotKey = (r: number, b: number) => `R${r}-B${b}`;
  const legNodeId = (r: number, b: number, leg: number | null | undefined) => `R${r}-B${b}-L${leg ?? 0}`;
  const tieFrameId = (r: number, b: number) => `TIE-R${r}-B${b}`;

  const { nodes, frames, connections, maxRound, baseWidth, baseHeight } = useMemo(() => {
    if (!stageMatches.length) {
      return {
        nodes: [] as NodeBox[],
        frames: [] as TieFrame[],
        connections: [] as Connection[],
        maxRound: 0,
        baseWidth: 800,
        baseHeight: 400,
      };
    }

    const maxR = Math.max(...stageMatches.map((m) => m.round ?? 1));

    // Group rows per slot; two-legged ties have two rows per (round, bracket_pos).
    const bySlot = new Map<string, DraftMatch[]>();
    stageMatches.forEach((m) => {
      const k = slotKey(m.round ?? 1, m.bracket_pos ?? 1);
      (bySlot.get(k) ?? bySlot.set(k, []).get(k)!).push(m);
    });
    // Defend against legacy/duplicate data: if a slot has explicit leg markers,
    // drop stray leg-null rows and keep one row per leg (prefer db id / score).
    for (const [k, arr] of bySlot) {
      let kept = arr;
      if (arr.some((m) => m.leg != null)) {
        const score = (m: DraftMatch) =>
          ((m as any).db_id != null ? 2 : 0) + (m.team_a_score != null || m.status === "finished" ? 1 : 0);
        const byLeg = new Map<number, DraftMatch>();
        arr.filter((m) => m.leg != null).forEach((m) => {
          const prev = byLeg.get(m.leg as number);
          if (!prev || score(m) > score(prev)) byLeg.set(m.leg as number, m);
        });
        kept = Array.from(byLeg.values());
      }
      kept.sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
      bySlot.set(k, kept);
    }

    // Vertical pitch must clear the tallest block: a two-legged tie.
    const TIE_BLOCK_H = LEG_H * 2 + LEG_GAP + TIE_PAD_TOP + TIE_PAD_BOTTOM;
    const slotBlockH = Math.max(BOX_H, TIE_BLOCK_H);
    const spacingForRound = (r: number) => (slotBlockH + BASE_GAP_Y) * Math.pow(2, r - 1);
    const centerY = (r: number, b: number) => {
      const sp = spacingForRound(r);
      return Y_MARGIN + (b - 1) * sp + sp / 2; // slot vertical center
    };
    const xFor = (r: number) => X_MARGIN + (r - 1) * (BOX_W + COL_GAP);

    const scoreFor = (m: DraftMatch, teamId: number | null) => {
      if (teamId == null) return 0;
      if (m.team_a_id === teamId) return m.team_a_score ?? 0;
      if (m.team_b_id === teamId) return m.team_b_score ?? 0;
      return 0;
    };

    // The card a parent advances FROM: leg-2 decider for a tie, else the single card.
    const deciderNodeId = (r: number, b: number) => {
      const rows = bySlot.get(slotKey(r, b));
      if (!rows || !rows.length) return null;
      const twoLegged = rows.length > 1 || rows.some((m) => m.leg != null);
      const dec = twoLegged ? rows.find((m) => m.leg === 2) ?? rows[rows.length - 1] : rows[0];
      return legNodeId(r, b, dec.leg);
    };

    const boxes: NodeBox[] = [];
    const tieFrames: TieFrame[] = [];
    const edges: Connection[] = [];

    bySlot.forEach((rows) => {
      const sample = rows[0];
      const r = sample.round ?? 1;
      const b = sample.bracket_pos ?? 1;
      const isFinal = r === maxR;
      const label = getRoundLabel(r, maxR);
      const colX = xFor(r);
      const cy = centerY(r, b);
      const twoLegged = rows.length > 1 || rows.some((m) => m.leg != null);

      // Progression edges: parent decider → this slot's leg-1 / single card.
      const childAnchor = legNodeId(r, b, rows[0].leg);
      const addParentEdge = (
        sr: number | null | undefined,
        sb: number | null | undefined,
        sourceTeamId: number | null
      ) => {
        if (!sr || !sb) return;
        const from = deciderNodeId(sr, sb);
        if (!from) return;
        const srcRows = bySlot.get(slotKey(sr, sb));
        const srcDec = srcRows
          ? (srcRows.length > 1 || srcRows.some((m) => m.leg != null)
              ? srcRows.find((m) => m.leg === 2) ?? srcRows[srcRows.length - 1]
              : srcRows[0])
          : null;
        edges.push({
          from,
          to: childAnchor,
          winnerId: srcDec?.winner_team_id ?? null,
          sourceTeamId,
          kind: "progress",
        });
      };
      addParentEdge(sample.home_source_round, sample.home_source_bracket_pos, sample.team_a_id ?? null);
      addParentEdge(sample.away_source_round, sample.away_source_bracket_pos, sample.team_b_id ?? null);

      if (!twoLegged) {
        boxes.push({
          id: legNodeId(r, b, sample.leg),
          x: colX,
          y: cy - BOX_H / 2,
          w: BOX_W,
          h: BOX_H,
          round: r,
          bracket_pos: b,
          label,
          isFinal,
          leg: null,
        });
        return;
      }

      // ── Two-legged tie ──
      const gid = tieFrameId(r, b);
      const startY = cy - TIE_BLOCK_H / 2;
      const cardsTop = startY + TIE_PAD_TOP;
      const cardX = colX + TIE_PAD_X;

      const leg2 = rows.find((m) => m.leg === 2) ?? rows[rows.length - 1];
      const teamA2 = leg2.team_a_id ?? null;
      const teamB2 = leg2.team_b_id ?? null;
      const allFinished = rows.every((m) => m.status === "finished");
      const aggA = rows.reduce((s, m) => s + scoreFor(m, teamA2), 0);
      const aggB = rows.reduce((s, m) => s + scoreFor(m, teamB2), 0);
      const penA = leg2.penalty_a ?? null;
      const penB = leg2.penalty_b ?? null;

      const accent = allFinished
        ? `ΣΥΝΟΛΟ ${aggA}–${aggB}${penA != null && penB != null ? ` · ΠΕΝ ${penA}-${penB}` : ""}`
        : "ΔΙΠΛΟΣ ΑΓΩΝΑΣ";

      tieFrames.push({
        id: gid,
        x: colX,
        y: startY,
        w: BOX_W + TIE_PAD_X * 2,
        h: TIE_BLOCK_H,
        isFinal,
        finished: allFinished,
        accent,
      });

      rows.forEach((row, li) => {
        const isLeg2 = row.leg === 2;
        boxes.push({
          id: legNodeId(r, b, row.leg),
          x: cardX,
          y: cardsTop + li * (LEG_H + LEG_GAP),
          w: BOX_W,
          h: LEG_H,
          round: r,
          bracket_pos: b,
          label,
          isFinal,
          group: gid,
          leg: row.leg ?? li + 1,
          agg: isLeg2 ? { a: aggA, b: aggB, finished: allFinished, penA, penB } : null,
        });
      });

      // Vertical leg connector: leg 1 → leg 2.
      const leg1Row = rows.find((m) => m.leg !== 2) ?? rows[0];
      if (leg2 && leg2 !== leg1Row) {
        edges.push({
          from: legNodeId(r, b, leg1Row.leg),
          to: legNodeId(r, b, leg2.leg),
          winnerId: null,
          sourceTeamId: null,
          kind: "leg",
        });
      }
    });

    const allBoxesAndFrames = [...boxes, ...tieFrames];
    const w = Math.max(800, allBoxesAndFrames.reduce((mx, n) => Math.max(mx, n.x + n.w), 0) + X_MARGIN);
    const h = Math.max(320, allBoxesAndFrames.reduce((my, n) => Math.max(my, n.y + n.h), 0) + Y_MARGIN);

    return {
      nodes: boxes,
      frames: tieFrames,
      connections: edges,
      maxRound: maxR,
      baseWidth: w,
      baseHeight: h,
    };
  }, [stageMatches]);

  const nodeById = useMemo(() => {
    const m = new Map<string, NodeBox>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const frameById = useMemo(() => {
    const m = new Map<string, TieFrame>();
    frames.forEach((f) => m.set(f.id, f));
    return m;
  }, [frames]);

  // Match row for a leg node id (R{r}-B{b}-L{leg}).
  const matchByNodeId = useMemo(() => {
    const m = new Map<string, DraftMatch>();
    stageMatches.forEach((x) => {
      m.set(legNodeId(x.round ?? 1, x.bracket_pos ?? 1, x.leg), x);
    });
    return m;
  }, [stageMatches]);

  // Round headers (one per column)
  const roundHeaders = useMemo(() => {
    const map = new Map<number, { label: string; x: number }>();
    nodes.forEach((n) => {
      if (!map.has(n.round)) {
        map.set(n.round, { label: n.label, x: n.x });
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, v]) => ({ round, ...v }));
  }, [nodes]);

  // Pan-and-zoom container
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const minZoom = 0.4;
  const maxZoom = 1.6;

  useEffect(() => {
    const fit = () => {
      const c = containerRef.current;
      if (!c) return;
      const next = clamp(
        Math.min(c.clientWidth / baseWidth, c.clientHeight / baseHeight),
        minZoom,
        maxZoom
      );
      setZoom(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [baseWidth, baseHeight]);

  const setZoomAt = (next: number, clientX?: number, clientY?: number) => {
    const c = containerRef.current;
    if (!c) return;
    const newZ = clamp(next, minZoom, maxZoom);
    if (newZ === zoom) return;

    const rect = c.getBoundingClientRect();
    const cx = clientX ?? rect.left + rect.width / 2;
    const cy = clientY ?? rect.top + rect.height / 2;

    const contentX = (c.scrollLeft + (cx - rect.left)) / zoom;
    const contentY = (c.scrollTop + (cy - rect.top)) / zoom;

    setZoom(newZ);
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft = contentX * newZ - (cx - rect.left);
      containerRef.current.scrollTop = contentY * newZ - (cy - rect.top);
    });
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = Math.pow(0.95, e.deltaY / 53);
      setZoomAt(zoom * factor, e.clientX, e.clientY);
    }
  };

  const dragging = useRef<null | {
    x: number;
    y: number;
    sl: number;
    st: number;
  }>(null);
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = {
      x: e.clientX,
      y: e.clientY,
      sl: containerRef.current?.scrollLeft ?? 0,
      st: containerRef.current?.scrollTop ?? 0,
    };
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragging.current = null;
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = dragging.current;
    const c = containerRef.current;
    if (!d || !c) return;
    c.scrollLeft = d.sl + (d.x - e.clientX);
    c.scrollTop = d.st + (d.y - e.clientY);
  };

  if (!nodes.length) {
    return (
      <div
        className="border-2 border-dashed p-10 text-center font-mono text-sm uppercase tracking-[0.2em]"
        style={{ borderColor: `${INK}33`, color: `${INK}80` }}
      >
        Δεν έχει οριστεί ακόμα το δέντρο νοκ άουτ
      </div>
    );
  }

  const trackWidth = baseWidth * zoom;
  const trackHeight = baseHeight * zoom;
  const headerHeight = 52;

  return (
    <div
      className="relative overflow-hidden border-2"
      style={{ borderColor: INK, background: IVORY }}
    >
      {/* Bracket header — editorial row with round rubrics */}
      <div
        className="flex items-stretch border-b-2"
        style={{ borderColor: INK, background: PANEL, color: INK }}
      >
        <div
          className="flex items-center gap-3 border-r-2 px-4 py-3"
          style={{ borderColor: `${INK}1F` }}
        >
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: SAFFRON }}
          >
            ★ Δέντρο Νοκ Άουτ
          </span>
        </div>
        <div className="flex flex-1 items-center justify-between px-4 py-3">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: `${INK}99` }}
          >
            {stageMatches.length} αγώνες · {maxRound}{" "}
            {maxRound === 1 ? "γύρος" : "γύροι"}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center border font-mono text-xs font-bold transition-colors"
              style={{ borderColor: `${INK}4D`, color: INK }}
              onClick={() => setZoomAt(zoom / 1.2)}
              aria-label="Σμίκρυνση"
            >
              −
            </button>
            <span
              className="min-w-[3.5ch] text-center font-mono text-[10px] tabular-nums"
              style={{ color: `${INK}99` }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center border font-mono text-xs font-bold transition-colors"
              style={{ borderColor: `${INK}4D`, color: INK }}
              onClick={() => setZoomAt(zoom * 1.2)}
              aria-label="Μεγέθυνση"
            >
              +
            </button>
            <button
              type="button"
              className="ml-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
              style={{ borderColor: SAFFRON, color: SAFFRON }}
              onClick={() => {
                if (!containerRef.current) return;
                const next = clamp(
                  Math.min(
                    containerRef.current.clientWidth / baseWidth,
                    containerRef.current.clientHeight / baseHeight
                  ),
                  minZoom,
                  maxZoom
                );
                setZoomAt(next);
              }}
              aria-label="Προσαρμογή"
            >
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* Round headers (sticky column rubrics) */}
      <div
        className="relative overflow-hidden border-b-2"
        style={{
          borderColor: INK,
          height: headerHeight,
          background: `${IVORY}F2`,
        }}
      >
        <div
          className="relative"
          style={{
            width: baseWidth * zoom,
            height: headerHeight,
          }}
        >
          <div
            className="absolute top-0 left-0"
            style={{
              width: baseWidth,
              height: headerHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {roundHeaders.map((h) => (
              <div
                key={h.round}
                className="absolute top-0"
                style={{ left: h.x, width: BOX_W }}
              >
                <div className="flex items-center gap-2 py-2">
                  <span
                    className="h-[2px] w-6"
                    style={{
                      background:
                        h.round === maxRound ? SAFFRON : VERMILLION,
                    }}
                  />
                  <span
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.3em]"
                    style={{
                      color: h.round === maxRound ? INK : `${INK}B0`,
                    }}
                  >
                    {h.label}
                  </span>
                  {h.round === maxRound && (
                    <span
                      className="font-[var(--f-brutal)] text-base leading-none"
                      style={{ color: SAFFRON }}
                    >
                      ★
                    </span>
                  )}
                </div>
                <div
                  className="h-[1px] w-full"
                  style={{ background: `${INK}22` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll viewport */}
      <div
        ref={containerRef}
        className="relative h-[560px] w-full overflow-auto cursor-grab active:cursor-grabbing"
        style={{
          background: IVORY,
          // subtle grid paper feel
          backgroundImage: `
            linear-gradient(${INK}0A 1px, transparent 1px),
            linear-gradient(90deg, ${INK}0A 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Track */}
        <div
          className="relative"
          style={{ width: trackWidth, height: trackHeight }}
        >
          <div
            className="absolute top-0 left-0"
            style={{
              width: baseWidth,
              height: baseHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {/* SVG connectors */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="v2ko-hatch"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="3" height="6" fill={INK} opacity="0.35" />
                </pattern>
              </defs>
              {connections.map((c, idx) => {
                const a = nodeById.get(c.from);
                const b = nodeById.get(c.to);
                if (!a || !b) return null;

                // Leg connector — vertical dashed link tying a tie's two legs.
                if (c.kind === "leg") {
                  const upper = a.y <= b.y ? a : b;
                  const lower = a.y <= b.y ? b : a;
                  const lx1 = upper.x + upper.w / 2;
                  const ly1 = upper.y + upper.h;
                  const lx2 = lower.x + lower.w / 2;
                  const ly2 = lower.y;
                  const ld = `M ${lx1} ${ly1} C ${lx1} ${ly1 + 14} ${lx2} ${ly2 - 14} ${lx2} ${ly2}`;
                  return (
                    <path
                      key={idx}
                      d={ld}
                      fill="none"
                      stroke={VERMILLION}
                      strokeOpacity={0.7}
                      strokeWidth={2}
                      strokeDasharray="3 4"
                      strokeLinecap="round"
                    />
                  );
                }

                // Progression — anchor on the tie FRAME when an endpoint is a tie.
                const aBox = (a.group && frameById.get(a.group)) || a;
                const bBox = (b.group && frameById.get(b.group)) || b;
                const axc = aBox.x + aBox.w / 2;
                const bxc = bBox.x + bBox.w / 2;
                const rtl = axc > bxc;
                const x1 = rtl ? aBox.x : aBox.x + aBox.w;
                const y1 = aBox.y + aBox.h / 2;
                const x2 = rtl ? bBox.x + bBox.w : bBox.x;
                const y2 = bBox.y + bBox.h / 2;
                const d = elbowPath(x1, y1, x2, y2);

                const active =
                  c.winnerId != null &&
                  c.sourceTeamId != null &&
                  c.winnerId === c.sourceTeamId;
                const destIsFinal = b.isFinal;
                const activeColor = destIsFinal ? SAFFRON : VERMILLION;
                const idleColor = INK;

                return (
                  <g key={idx}>
                    {/* Shadow */}
                    <path
                      d={d}
                      fill="none"
                      stroke={INK}
                      strokeOpacity={0.12}
                      strokeWidth={8}
                      strokeLinecap="round"
                    />
                    {active ? (
                      <>
                        <path
                          d={d}
                          fill="none"
                          stroke={activeColor}
                          strokeWidth={3}
                          strokeLinecap="round"
                        />
                        {/* tick marks at end */}
                        <circle
                          cx={x2}
                          cy={y2}
                          r={4}
                          fill={activeColor}
                          stroke={INK}
                          strokeWidth={1.5}
                        />
                      </>
                    ) : (
                      <path
                        d={d}
                        fill="none"
                        stroke={idleColor}
                        strokeOpacity={0.55}
                        strokeWidth={1.75}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Tie frames (behind the cards) — a bordered block wrapping both legs. */}
            {frames.map((f) => (
              <div
                key={f.id}
                className="absolute border-2 border-dashed"
                style={{
                  left: f.x,
                  top: f.y,
                  width: f.w,
                  height: f.h,
                  borderColor: f.finished ? (f.isFinal ? SAFFRON : VERMILLION) : `${INK}66`,
                  background: `${INK}06`,
                }}
              >
                <span
                  className="absolute -top-[11px] left-3 px-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em]"
                  style={{
                    background: IVORY,
                    color: f.finished ? (f.isFinal ? SAFFRON : VERMILLION) : `${INK}AA`,
                  }}
                >
                  {f.accent}
                </span>
              </div>
            ))}

            {/* Nodes */}
            {nodes.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                className="absolute"
                style={{
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: n.h,
                }}
              >
                <MatchNode
                  node={n}
                  match={matchByNodeId.get(n.id)}
                  teamById={teamById}
                />
              </motion.div>
            ))}

            {/* Champion halo — only if there is a confirmed winner in the final */}
            {(() => {
              const finalNodes = nodes.filter((n) => n.isFinal);
              if (!finalNodes.length) return null;
              // For a two-legged final, the decider (leg 2) carries the winner;
              // anchor the halo to the right of the tie frame, not a single leg.
              const decider =
                finalNodes.find((n) => n.leg === 2) ?? finalNodes[finalNodes.length - 1];
              const finalMatch = matchByNodeId.get(decider.id);
              const finalFinished = decider.agg
                ? decider.agg.finished
                : finalMatch?.status === "finished";
              const winnerId =
                championTeamId ?? finalMatch?.winner_team_id ?? null;
              if (!winnerId || !finalFinished) return null;
              const winner = teamById.get(winnerId);
              if (!winner) return null;
              const anchor = (decider.group && frameById.get(decider.group)) || decider;
              return (
                <div
                  className="absolute flex items-center gap-2"
                  style={{
                    left: anchor.x + anchor.w + 24,
                    top: anchor.y + anchor.h / 2 - 22,
                  }}
                >
                  <div
                    className="flex items-center gap-2 border-2 px-3 py-1.5 rotate-[1.5deg]"
                    style={{
                      borderColor: SAFFRON,
                      background: PANEL,
                      color: INK,
                      boxShadow: `6px 6px 0 0 ${SAFFRON}`,
                    }}
                  >
                    <span
                      className="font-mono text-[10px] font-bold uppercase tracking-[0.25em]"
                      style={{ color: SAFFRON }}
                    >
                      ★ Πρωταθλητής
                    </span>
                    <span className="font-[var(--f-display)] text-sm font-black italic">
                      {winner.name}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div
        className="flex items-center justify-between border-t-2 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.25em]"
        style={{
          borderColor: INK,
          color: `${INK}99`,
          background: `${IVORY}F2`,
        }}
      >
        <span>Σύρετε για περιήγηση · Ctrl + scroll για ζουμ</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-4"
              style={{ background: VERMILLION }}
            />
            προχώρησε
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-4"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, ${INK} 0 4px, transparent 4px 8px)`,
              }}
            />
            εκκρεμεί
          </span>
        </span>
      </div>
    </div>
  );
};

export default KOBracketV2;
