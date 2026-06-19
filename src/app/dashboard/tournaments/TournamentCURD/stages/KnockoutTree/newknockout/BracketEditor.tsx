"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** A simple absolute-positioned node. Units are pixels. */
export type NodeBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

type Connection = [string, string];

/** An edge with a kind so the canvas can style progression vs leg links differently. */
export type Edge = {
  from: string;
  to: string;
  /** "progress" = winner advances to next round; "leg" = the two legs of one tie. */
  kind?: "progress" | "leg";
};

/** A decorative container drawn behind nodes (e.g. a two-legged "tie" box). */
export type NodeGroup = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  /** Optional accent string shown at the right of the header (e.g. "agg 3–2"). */
  accent?: string;
  /** Whether the whole group reads as finished (changes the border tint). */
  finished?: boolean;
};

type Props = {
  nodes: NodeBox[];
  /** Either legacy [from,to] tuples or typed Edge objects. */
  connections: Array<Connection | Edge>;
  onNodesChange: (next: NodeBox[]) => void;
  onConnectionsChange: (next: Connection[]) => void;
  nodeContent?: (n: NodeBox) => React.ReactNode;
  isFinished?: (id: string) => boolean; // highlight finished nodes
  /** Decorative containers (tie boxes) rendered behind the nodes. */
  groups?: NodeGroup[];
  /** Optional: snap to grid pixels (default 10) */
  snap?: number;
  /** Visual zoom (scales drawing plane), does not change coordinates (default 1) */
  zoom?: number;
};

/** Normalize a connection (tuple or Edge) into a uniform shape. */
function asEdge(c: Connection | Edge): Edge {
  return Array.isArray(c) ? { from: c[0], to: c[1], kind: "progress" } : { kind: "progress", ...c };
}

export default function BracketEditor({
  nodes,
  connections,
  onNodesChange,
  onConnectionsChange,
  nodeContent,
  isFinished,
  groups = [],
  snap = 10,
  zoom = 1,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Normalize edges once: callers may still pass legacy [from,to] tuples.
  const edges = useMemo(() => connections.map(asEdge), [connections]);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Connection state (click source, then click target)
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  const nodeById = useMemo(() => {
    const m = new Map<string, NodeBox>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const snapTo = useCallback(
    (value: number) => Math.round(value / snap) * snap,
    [snap]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      dragOffset.current = {
        dx: (e.clientX - rect.left) / zoom,
        dy: (e.clientY - rect.top) / zoom,
      };
      setDraggingId(id);
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [zoom]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingId) return;
      const container = containerRef.current;
      if (!container) return;

      const cRect = container.getBoundingClientRect();
      const nx = snapTo((e.clientX - cRect.left) / zoom - dragOffset.current.dx);
      const ny = snapTo((e.clientY - cRect.top) / zoom - dragOffset.current.dy);

      onNodesChange(
        nodes.map((n) => (n.id === draggingId ? { ...n, x: nx, y: ny } : n))
      );
    },
    [draggingId, nodes, onNodesChange, snapTo, zoom]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingId) {
      // eslint-disable-next-line no-console
      console.log("[BracketEditor] Node drag ended:", draggingId);
    }
    setDraggingId(null);
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }, [draggingId]);

  const toggleConnectionMode = useCallback((id: string) => {
    if (pendingFrom === id) {
      setPendingFrom(null);
      return;
    }
    setPendingFrom(id);
  }, [pendingFrom]);

  const createConnection = useCallback((from: string, to: string) => {
    if (from === to) return; // no self loops
    // prevent duplicates
    const exists = edges.some((e) => e.from === from && e.to === to);
    if (exists) return;

    const next: Connection[] = [...edges.map((e) => [e.from, e.to] as Connection), [from, to]];
    onConnectionsChange(next);

    // eslint-disable-next-line no-console
    console.log("[BracketEditor] Added connection:", { from, to });
  }, [edges, onConnectionsChange]);

  // Handle node click for connecting
  const handleNodeClick = useCallback((id: string) => {
    if (!pendingFrom) {
      setPendingFrom(id);
    } else {
      createConnection(pendingFrom, id);
      setPendingFrom(null);
    }
  }, [pendingFrom, createConnection]);

  const removeConnection = useCallback((idx: number) => {
    const tuples: Connection[] = edges.map((e) => [e.from, e.to] as Connection);
    const removed = tuples.splice(idx, 1);
    onConnectionsChange(tuples);
    // eslint-disable-next-line no-console
    console.log("[BracketEditor] Removed connection:", removed[0]);
  }, [edges, onConnectionsChange]);

  // Key handling: press Escape to cancel pending connection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pendingFrom) {
        setPendingFrom(null);
        // eslint-disable-next-line no-console
        console.log("[BracketEditor] Connection cancelled");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingFrom]);

  /* ------------------ Curved, side-aware connectors ------------------ */

  type PathInfo = {
    d: string;
    mid: { x: number; y: number };
    idx: number;
    rtl: boolean;
    kind: "progress" | "leg";
  };

  const paths = useMemo<PathInfo[]>(() => {
    const OUTSET = 6; // small offset from box edge so lines don't touch borders
    const MIN_DX = 40; // min horizontal handle length
    const list: PathInfo[] = [];

    function cubicPoint(
      t: number,
      x1: number, y1: number,
      c1x: number, c1y: number,
      c2x: number, c2y: number,
      x2: number, y2: number
    ) {
      // De Casteljau
      const u = 1 - t;
      const x =
        u*u*u*x1 +
        3*u*u*t*c1x +
        3*u*t*t*c2x +
        t*t*t*x2;
      const y =
        u*u*u*y1 +
        3*u*u*t*c1y +
        3*u*t*t*c2y +
        t*t*t*y2;
      return { x, y };
    }

    edges.forEach((e, idx) => {
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) return;
      const kind = e.kind ?? "progress";

      // ---- Leg link: connect the two stacked leg cards top/bottom (vertical S) ----
      if (kind === "leg") {
        const upper = a.y <= b.y ? a : b;
        const lower = a.y <= b.y ? b : a;
        const x1 = upper.x + upper.w / 2;
        const y1 = upper.y + upper.h + OUTSET;
        const x2 = lower.x + lower.w / 2;
        const y2 = lower.y - OUTSET;
        const dy = Math.max(14, (y2 - y1) * 0.5);
        const c1x = x1, c1y = y1 + dy;
        const c2x = x2, c2y = y2 - dy;
        const d = `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
        const mid = cubicPoint(0.5, x1, y1, c1x, c1y, c2x, c2y, x2, y2);
        list.push({ d, mid, idx, rtl: false, kind });
        return;
      }

      // ---- Progression link: side-aware horizontal S-curve (existing behavior) ----
      // Determine direction using node centers
      const axc = a.x + a.w / 2;
      const bxc = b.x + b.w / 2;
      const rtl = axc > bxc; // right-to-left?

      // Anchor points on the nearest sides
      const x1 = rtl ? a.x - OUTSET : a.x + a.w + OUTSET;
      const y1 = a.y + a.h / 2;
      const x2 = rtl ? b.x + b.w + OUTSET : b.x - OUTSET;
      const y2 = b.y + b.h / 2;

      const dx = Math.max(MIN_DX, Math.abs(x2 - x1) * 0.35);

      // Control points for a sleek S-curve
      const c1x = rtl ? x1 - dx : x1 + dx;
      const c2x = rtl ? x2 + dx : x2 - dx;
      const c1y = y1;
      const c2y = y2;

      const d = `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
      const mid = cubicPoint(0.5, x1, y1, c1x, c1y, c2x, c2y, x2, y2);
      list.push({ d, mid, idx, rtl, kind });
    });

    return list;
  }, [edges, nodeById]);

  const width = useMemo(() => {
    const maxRightNodes = nodes.reduce((mx, n) => Math.max(mx, n.x + n.w), 800);
    const maxRightGroups = groups.reduce((mx, g) => Math.max(mx, g.x + g.w), 0);
    return Math.max(800, Math.max(maxRightNodes, maxRightGroups) + 80);
  }, [nodes, groups]);

  const height = useMemo(() => {
    const maxBottomNodes = nodes.reduce((my, n) => Math.max(my, n.y + n.h), 400);
    const maxBottomGroups = groups.reduce((my, g) => Math.max(my, g.y + g.h), 0);
    return Math.max(400, Math.max(maxBottomNodes, maxBottomGroups) + 80);
  }, [nodes, groups]);

  return (
    <div className="relative w-full overflow-auto rounded-xl border border-white/10 bg-gradient-to-br from-red-950/60 via-[#2a0a0a]/60 to-amber-950/50">
      {/* Scroll area sized to zoomed content */}
      <div
        ref={containerRef}
        className="relative"
        style={{ width: width * zoom, height: height * zoom }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Scaled drawing plane (grid + lines + nodes) */}
        <div
          className="absolute top-0 left-0"
          style={{
            width,
            height,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: `${snap}px ${snap}px, ${snap}px ${snap}px`,
          }}
        >
          {/* Tie-group containers (drawn behind everything) */}
          {groups.map((g) => (
            <div
              key={g.id}
              className={[
                "absolute rounded-2xl border-2 border-dashed pointer-events-none",
                g.finished
                  ? "border-amber-400/35 bg-amber-500/[0.04]"
                  : "border-cyan-400/30 bg-cyan-500/[0.035]",
              ].join(" ")}
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
            >
              {(g.label || g.accent) && (
                <div className="absolute -top-2.5 left-3 flex items-center gap-2 px-1.5">
                  {g.label && (
                    <span
                      className={[
                        "rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                        g.finished
                          ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30"
                          : "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30",
                      ].join(" ")}
                    >
                      {g.label}
                    </span>
                  )}
                  {g.accent && (
                    <span className="rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-white/80 ring-1 ring-white/10">
                      {g.accent}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* SVG connection layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              {/* subtle gloss gradient, separate IDs for LTR / RTL if you ever want different directions */}
              <linearGradient id="edgeGradLTR" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
              </linearGradient>
              <linearGradient id="edgeGradRTL" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
              </linearGradient>
              <linearGradient id="edgeGradLeg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(34,211,238,0.85)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0.45)" />
              </linearGradient>
            </defs>

            {paths.map((p) =>
              p.kind === "leg" ? (
                <g key={p.idx} className="pointer-events-none">
                  {/* leg link: thin dashed cyan connector tying the two legs of one tie */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke="url(#edgeGradLeg)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="3 5"
                  />
                </g>
              ) : (
                <g key={p.idx} className="pointer-events-none">
                  {/* Glow / shadow underlay */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                  {/* Main sleek line */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke={`url(#${p.rtl ? "edgeGradRTL" : "edgeGradLTR"})`}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </g>
              )
            )}

            {/* small click targets to remove connections (progression edges only) */}
            {paths
              .filter((p) => p.kind !== "leg")
              .map((p) => (
                <circle
                  key={`btn-${p.idx}`}
                  cx={p.mid.x}
                  cy={p.mid.y}
                  r={9}
                  fill="rgba(255,255,255,0.08)"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => removeConnection(p.idx)}
                />
              ))}
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const isPending = pendingFrom === n.id;
            const done = isFinished ? isFinished(n.id) : false;
            return (
              <div
                key={n.id}
                className={[
                  "absolute rounded-2xl border p-2 flex flex-col gap-1 select-none",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-[1px]",
                  done
                    ? "border-amber-400/50 bg-gradient-to-br from-red-700/30 to-amber-600/20 ring-1 ring-amber-300/20"
                    : isPending
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-white/15 bg-black/40",
                ].join(" ")}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
                onPointerDown={(e) => handlePointerDown(e, n.id)}
                onDoubleClick={() => handleNodeClick(n.id)}
                title={
                  isPending
                    ? "Click another node to connect, or press Esc to cancel"
                    : "Drag to move. Double-click to start/finish a connection."
                }
              >
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span className="truncate">{n.label ?? n.id}</span>
                  <button
                    className={[
                      "ml-2 rounded px-2 py-0.5 border text-[11px]",
                      isPending
                        ? "border-emerald-400/60 bg-emerald-500/20"
                        : "border-white/15 bg-white/5",
                    ].join(" ")}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleConnectionMode(n.id);
                    }}
                  >
                    {isPending ? "Connecting…" : "Connect"}
                  </button>
                </div>

                <div className="flex-1 min-h-0 text-sm leading-tight">
                  {nodeContent ? (
                    <div className="h-full">{nodeContent(n)}</div>
                  ) : (
                    <div className="opacity-80 text-white/90">{n.label ?? n.id}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer tips */}
      <div className="px-3 py-2 text-xs text-white/70 border-t border-white/10 bg-black/40">
        Drag nodes to reposition. Double-click a node or press “Connect”, then click another node to create an edge.
        Click the small circle on a line to remove that connection. Press <kbd>Esc</kbd> to cancel a pending connection.
      </div>
    </div>
  );
}