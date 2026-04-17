"use client";

/**
 * KOBracketV2 — Knockout bracket for the v2.0 "DISPATCH" page.
 * Editorial broadsheet × kinetic brutalism.
 * Ivory ground. Deep ink. Vermillion signal. Saffron honours.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DraftMatch, Stage, Team } from "@/app/tournaments/useTournamentData";

// Palette aliases — kept co-located for clarity
const INK = "#0F0E0D";
const IVORY = "#F3EFE6";
const VERMILLION = "#E2583A";
const SAFFRON = "#E8B931";
const NAVY = "#0E2A3A";

type Connection = {
  from: string;
  to: string;
  winnerId: number | null;
  sourceTeamId: number | null;
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

  const dateStr = match.match_date
    ? new Date(match.match_date).toLocaleDateString("el-GR", {
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
      {/* Header strip — round label + date */}
      <div
        className="flex items-center justify-between border-b-2 px-3 py-1.5"
        style={{
          borderColor: INK,
          background: node.isFinal ? INK : IVORY,
          color: node.isFinal ? IVORY : INK,
        }}
      >
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: node.isFinal ? SAFFRON : accent }}
        >
          {node.isFinal ? "★ " : ""}
          {node.label}
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
            style={{ color: node.isFinal ? IVORY : `${INK}99` }}
          >
            {dateStr}
          </span>
        ) : (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: node.isFinal ? `${IVORY}80` : `${INK}66` }}
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
        />
        <div className="h-[2px]" style={{ background: `${INK}1A` }} />
        <TeamRow
          team={b}
          score={isFinished ? match.team_b_score : null}
          isWinner={bWon}
          isLoser={isFinished && aWon}
          isFinal={node.isFinal}
        />
      </div>

      {/* Bottom coordinate badge */}
      <div
        className="flex items-center justify-between border-t px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]"
        style={{
          borderColor: `${INK}22`,
          color: `${INK}55`,
        }}
      >
        <span>
          R{node.round} · B{pad2(node.bracket_pos)}
        </span>
        {isFinished && match.winner_team_id && (
          <span
            className="font-bold"
            style={{ color: accent }}
          >
            ▶ ΝΙΚΗΤΗΣ
          </span>
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
}> = ({ team, score, isWinner, isLoser, isFinal }) => {
  const tbd = !team;
  const accent = isFinal ? SAFFRON : VERMILLION;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
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
          className="h-9 w-9 shrink-0 rounded-full border-2 object-cover"
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
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
        className="flex-1 truncate font-[var(--f-display)] text-[15px] font-semibold italic leading-tight"
        style={{
          color: isWinner ? INK : isLoser ? `${INK}55` : tbd ? `${INK}40` : INK,
          fontStyle: tbd ? "italic" : undefined,
        }}
      >
        {team?.name ?? "ΤΒΑ"}
      </span>

      {score != null ? (
        <div
          className="flex h-9 min-w-[36px] shrink-0 items-center justify-center border-2 font-[var(--f-brutal)] text-lg leading-none tabular-nums"
          style={{
            borderColor: isWinner ? accent : INK,
            background: isWinner ? accent : IVORY,
            color: isWinner ? (isFinal ? INK : IVORY) : isLoser ? `${INK}55` : INK,
          }}
        >
          {score}
        </div>
      ) : (
        <div
          className="flex h-9 min-w-[36px] shrink-0 items-center justify-center border-2 border-dashed font-mono text-xs"
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
  const BOX_H = 148;
  const COL_GAP = 160; // gap between columns (in addition to BOX_W)
  const BASE_GAP_Y = 36; // baseline gap between round-1 siblings
  const X_MARGIN = 40;
  const Y_MARGIN = 40;

  const { nodes, connections, maxRound, baseWidth, baseHeight } = useMemo(() => {
    if (!stageMatches.length) {
      return {
        nodes: [] as NodeBox[],
        connections: [] as Connection[],
        maxRound: 0,
        baseWidth: 800,
        baseHeight: 400,
      };
    }

    const maxR = Math.max(...stageMatches.map((m) => m.round ?? 1));

    const spacingForRound = (r: number) =>
      (BOX_H + BASE_GAP_Y) * Math.pow(2, r - 1);

    const yFor = (r: number, b: number) => {
      const sp = spacingForRound(r);
      return Y_MARGIN + (b - 1) * sp + sp / 2 - BOX_H / 2;
    };

    const xFor = (r: number) => X_MARGIN + (r - 1) * (BOX_W + COL_GAP);

    const boxes: NodeBox[] = stageMatches.map((m) => {
      const r = m.round ?? 1;
      const b = m.bracket_pos ?? 1;
      return {
        id: `R${r}-B${b}`,
        x: xFor(r),
        y: yFor(r, b),
        w: BOX_W,
        h: BOX_H,
        round: r,
        bracket_pos: b,
        label: getRoundLabel(r, maxR),
        isFinal: r === maxR,
      };
    });

    const matchByKey = new Map<string, DraftMatch>();
    stageMatches.forEach((m) => {
      matchByKey.set(`R${m.round}-B${m.bracket_pos}`, m);
    });

    const edges: Connection[] = [];
    stageMatches.forEach((m) => {
      const toKey = `R${m.round}-B${m.bracket_pos}`;
      if (m.home_source_round && m.home_source_bracket_pos) {
        const fromKey = `R${m.home_source_round}-B${m.home_source_bracket_pos}`;
        const src = matchByKey.get(fromKey);
        edges.push({
          from: fromKey,
          to: toKey,
          winnerId: src?.winner_team_id ?? null,
          sourceTeamId: m.team_a_id ?? null,
        });
      }
      if (m.away_source_round && m.away_source_bracket_pos) {
        const fromKey = `R${m.away_source_round}-B${m.away_source_bracket_pos}`;
        const src = matchByKey.get(fromKey);
        edges.push({
          from: fromKey,
          to: toKey,
          winnerId: src?.winner_team_id ?? null,
          sourceTeamId: m.team_b_id ?? null,
        });
      }
    });

    const w = Math.max(
      800,
      boxes.reduce((mx, n) => Math.max(mx, n.x + n.w), 0) + X_MARGIN
    );
    const h = Math.max(
      320,
      boxes.reduce((my, n) => Math.max(my, n.y + n.h), 0) + Y_MARGIN
    );

    return {
      nodes: boxes,
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

  const matchById = useMemo(() => {
    const m = new Map<string, DraftMatch>();
    stageMatches.forEach((x) =>
      m.set(`R${x.round}-B${x.bracket_pos}`, x)
    );
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
        style={{ borderColor: INK, background: INK, color: IVORY }}
      >
        <div
          className="flex items-center gap-3 border-r-2 px-4 py-3"
          style={{ borderColor: `${IVORY}1F` }}
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
            style={{ color: `${IVORY}99` }}
          >
            {stageMatches.length} αγώνες · {maxRound}{" "}
            {maxRound === 1 ? "γύρος" : "γύροι"}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center border font-mono text-xs font-bold transition-colors"
              style={{ borderColor: `${IVORY}4D`, color: IVORY }}
              onClick={() => setZoomAt(zoom / 1.2)}
              aria-label="Σμίκρυνση"
            >
              −
            </button>
            <span
              className="min-w-[3.5ch] text-center font-mono text-[10px] tabular-nums"
              style={{ color: `${IVORY}99` }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center border font-mono text-xs font-bold transition-colors"
              style={{ borderColor: `${IVORY}4D`, color: IVORY }}
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
                const axc = a.x + a.w / 2;
                const bxc = b.x + b.w / 2;
                const rtl = axc > bxc;
                const x1 = rtl ? a.x : a.x + a.w;
                const y1 = a.y + a.h / 2;
                const x2 = rtl ? b.x + b.w : b.x;
                const y2 = b.y + b.h / 2;
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
                  match={matchById.get(n.id)}
                  teamById={teamById}
                />
              </motion.div>
            ))}

            {/* Champion halo — only if there is a confirmed winner in the final */}
            {(() => {
              const finalBox = nodes.find((n) => n.isFinal);
              if (!finalBox) return null;
              const finalMatch = matchById.get(finalBox.id);
              const winnerId =
                championTeamId ?? finalMatch?.winner_team_id ?? null;
              if (!winnerId || finalMatch?.status !== "finished") return null;
              const winner = teamById.get(winnerId);
              if (!winner) return null;
              return (
                <div
                  className="absolute flex items-center gap-2"
                  style={{
                    left: finalBox.x + finalBox.w + 24,
                    top: finalBox.y + finalBox.h / 2 - 22,
                  }}
                >
                  <div
                    className="flex items-center gap-2 border-2 px-3 py-1.5 rotate-[1.5deg]"
                    style={{
                      borderColor: INK,
                      background: INK,
                      color: IVORY,
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
