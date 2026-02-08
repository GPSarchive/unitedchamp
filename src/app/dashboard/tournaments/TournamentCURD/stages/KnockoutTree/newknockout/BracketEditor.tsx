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

type Props = {
  nodes: NodeBox[];
  connections: Connection[];
  onNodesChange: (next: NodeBox[]) => void;
  onConnectionsChange: (next: Connection[]) => void;
  nodeContent?: (n: NodeBox) => React.ReactNode;
  isFinished?: (id: string) => boolean; // highlight finished nodes
  /** Optional: snap to grid pixels (default 10) */
  snap?: number;
  /** Visual zoom (scales drawing plane), does not change coordinates (default 1) */
  zoom?: number;
};

export default function BracketEditor({
  nodes,
  connections,
  onNodesChange,
  onConnectionsChange,
  nodeContent,
  isFinished,
  snap = 10,
  zoom = 1,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    const exists = connections.some(([a, b]) => a === from && b === to);
    if (exists) return;

    const next = [...connections, [from, to] as Connection];
    onConnectionsChange(next);

    // eslint-disable-next-line no-console
    console.log("[BracketEditor] Added connection:", { from, to });
  }, [connections, onConnectionsChange]);

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
    const next = connections.slice();
    const removed = next.splice(idx, 1);
    onConnectionsChange(next);
    // eslint-disable-next-line no-console
    console.log("[BracketEditor] Removed connection:", removed[0]);
  }, [connections, onConnectionsChange]);

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

    connections.forEach(([from, to], idx) => {
      const a = nodeById.get(from);
      const b = nodeById.get(to);
      if (!a || !b) return;

      // Determine direction using node centers
      const axc = a.x + a.w / 2;
      const bxc = b.x + b.w / 2;
      const rtl = axc > bxc; // right-to-left?

      // Anchor points on the nearest sides
      let x1 = rtl ? a.x - OUTSET : a.x + a.w + OUTSET;
      let y1 = a.y + a.h / 2;
      let x2 = rtl ? b.x + b.w + OUTSET : b.x - OUTSET;
      let y2 = b.y + b.h / 2;

      const dx = Math.max(MIN_DX, Math.abs(x2 - x1) * 0.35);

      // Control points for a sleek S-curve
      const c1x = rtl ? x1 - dx : x1 + dx;
      const c2x = rtl ? x2 + dx : x2 - dx;
      const c1y = y1;
      const c2y = y2;

      const d = `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
      const mid = cubicPoint(0.5, x1, y1, c1x, c1y, c2x, c2y, x2, y2);
      list.push({ d, mid, idx, rtl });
    });

    return list;
  }, [connections, nodeById]);

  const width = useMemo(() => {
    const maxRight = nodes.reduce((mx, n) => Math.max(mx, n.x + n.w), 800);
    return Math.max(800, maxRight + 80);
  }, [nodes]);

  const height = useMemo(() => {
    const maxBottom = nodes.reduce((my, n) => Math.max(my, n.y + n.h), 400);
    return Math.max(400, maxBottom + 80);
  }, [nodes]);

  return (
    <div className="relative w-full overflow-auto rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-indigo-950/60">
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
            </defs>

            {paths.map((p) => (
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
            ))}

            {/* small click targets to remove connections */}
            {paths.map((p) => (
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
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] backdrop-blur-[1px]",
                  done
                    ? "border-emerald-400/40 bg-gradient-to-br from-emerald-900/30 to-teal-900/20 ring-1 ring-emerald-400/20"
                    : isPending
                      ? "border-violet-400/60 bg-violet-500/10"
                      : "border-white/[0.1] bg-black/40",
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
                      "ml-2 rounded-lg px-2 py-0.5 border text-[11px] transition",
                      isPending
                        ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                        : "border-white/[0.1] bg-white/[0.05] text-white/60 hover:bg-white/[0.1]",
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
      <div className="px-4 py-2.5 text-xs text-white/40 border-t border-white/[0.06] bg-black/30">
        Drag nodes to reposition. Double-click a node or press &quot;Connect&quot;, then click another node to create an edge.
        Click the circle on a line to remove it. Press <kbd className="px-1 py-0.5 rounded bg-white/[0.08] text-white/50">Esc</kbd> to cancel.
      </div>
    </div>
  );
}