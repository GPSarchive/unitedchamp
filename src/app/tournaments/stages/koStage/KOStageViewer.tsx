// File: KOStageViewer.tsx — Elegant bracket viewer with smooth curves & sporty design
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BracketBackground } from "./BracketBackground";
import { generateElbowPath } from "./BracketLineStyles";

export type NodeBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  /** Cards sharing a group id belong to the same tie container (both legs). */
  group?: string;
};

type Connection = [string, string];

/** A typed edge so the viewer can style progression vs leg links differently. */
export type Edge = {
  from: string;
  to: string;
  /** "progress" = winner advances to next round; "leg" = the two legs of one tie. */
  kind?: "progress" | "leg";
};

/** A decorative container drawn behind the cards (a two-legged "tie" box). */
export type NodeGroup = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  /** Optional accent shown at the right of the header (e.g. "agg 3–2 · pens 4-5"). */
  accent?: string;
  /** Whether the whole tie reads as decided (changes the border tint). */
  finished?: boolean;
};

type Props = {
  nodes: NodeBox[];
  connections: Array<Connection | Edge>;
  /** Decorative tie containers rendered behind the cards (two-legged ties). */
  groups?: NodeGroup[];
  nodeContent?: (n: NodeBox) => React.ReactNode;
  minZoom?: number;
  maxZoom?: number;
};

/** Normalize a connection (tuple or Edge) into a uniform shape. */
function asEdge(c: Connection | Edge): Edge {
  return Array.isArray(c) ? { from: c[0], to: c[1], kind: "progress" } : { kind: "progress", ...c };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const KOStageViewer = ({
  nodes,
  connections,
  groups = [],
  nodeContent,
  minZoom = 0.3,
  maxZoom = 2.5,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const edges = useMemo(() => connections.map(asEdge), [connections]);

  const nodeById = useMemo(() => {
    const m = new Map<string, NodeBox>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const groupById = useMemo(() => {
    const m = new Map<string, NodeGroup>();
    groups.forEach((g) => m.set(g.id, g));
    return m;
  }, [groups]);

  const baseWidth = useMemo(() => {
    const maxNodes = nodes.reduce((mx, n) => Math.max(mx, n.x + n.w), 0);
    const maxGroups = groups.reduce((mx, g) => Math.max(mx, g.x + g.w), 0);
    return Math.max(800, Math.max(maxNodes, maxGroups) + 100);
  }, [nodes, groups]);
  const baseHeight = useMemo(() => {
    const maxNodes = nodes.reduce((my, n) => Math.max(my, n.y + n.h), 0);
    const maxGroups = groups.reduce((my, g) => Math.max(my, g.y + g.h), 0);
    return Math.max(400, Math.max(maxNodes, maxGroups) + 100);
  }, [nodes, groups]);

  const [zoom, setZoom] = useState(1);

  // Fit height on mount & resize
  useEffect(() => {
    const fit = () => {
      const c = containerRef.current;
      if (!c) return;
      const next = clamp(c.clientHeight / baseHeight, minZoom, maxZoom);
      setZoom(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [baseHeight, minZoom, maxZoom]);

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
      c.scrollLeft = contentX * newZ - (cx - rect.left);
      c.scrollTop = contentY * newZ - (cy - rect.top);
    });
  };

  // Wheel: Ctrl/Cmd to zoom
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = Math.pow(0.95, e.deltaY / 53);
      setZoomAt(zoom * factor, e.clientX, e.clientY);
    }
  };

  // Drag-to-pan
  const dragging = useRef<null | { x: number; y: number; sl: number; st: number }>(null);
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
    e.preventDefault();
    c.scrollLeft = d.sl + (d.x - e.clientX);
    c.scrollTop = d.st + (d.y - e.clientY);
  };

  // Pinch to zoom
  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<null | { baseDist: number; baseZoom: number; cx: number; cy: number }>(null);

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      touches.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (touches.current.size >= 2) {
      const pts = Array.from(touches.current.values());
      const baseDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchState.current = {
        baseDist,
        baseZoom: zoom,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
      };
    }
  };
  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (pinchState.current) e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      touches.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (pinchState.current && touches.current.size >= 2) {
      const pts = Array.from(touches.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const factor = dist / pinchState.current.baseDist;
      setZoomAt(pinchState.current.baseZoom * factor, pinchState.current.cx, pinchState.current.cy);
    }
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) touches.current.delete(e.changedTouches[i].identifier);
    if (touches.current.size < 2) pinchState.current = null;
  };

  // Keyboard zoom
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      setZoomAt(zoom * 1.15);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
      e.preventDefault();
      setZoomAt(zoom / 1.15);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      setZoomAt(clamp(containerRef.current!.clientHeight / baseHeight, minZoom, maxZoom));
    }
  };

  const trackWidth = baseWidth * zoom;
  const trackHeight = baseHeight * zoom;
  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      {/* Zoom controls — top-right floating pill */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 border border-white/10 px-2 py-1 backdrop-blur-md shadow-lg">
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold"
          onClick={() => setZoomAt(zoom / 1.2)}
          aria-label="Zoom out"
        >
          -
        </button>
        <span className="min-w-[3ch] text-center text-[11px] font-medium text-white/50 tabular-nums">
          {zoomPct}%
        </span>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold"
          onClick={() => setZoomAt(zoom * 1.2)}
          aria-label="Zoom in"
        >
          +
        </button>
        <div className="mx-0.5 h-3 w-px bg-white/15" />
        <button
          type="button"
          className="flex h-6 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
          onClick={() => setZoomAt(containerRef.current!.clientHeight / baseHeight)}
          aria-label="Fit to view"
        >
          Fit
        </button>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-auto touch-none [&_*]:select-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        tabIndex={0}
        role="region"
        aria-label="Knockout bracket viewer"
      >
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <BracketBackground />
        </div>

        {/* Track */}
        <div className="relative" style={{ width: trackWidth, height: trackHeight }}>
          {/* Scaled logical plane */}
          <div
            className="absolute top-0 left-0"
            style={{
              width: baseWidth,
              height: baseHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {/* Tie containers (drawn behind the cards) — a dashed box wrapping the
                two legs of one tie, with the aggregate/pens accent on its header. */}
            {groups.map((g) => (
              <div
                key={g.id}
                className={[
                  "absolute rounded-2xl border-2 border-dashed pointer-events-none",
                  g.finished
                    ? "border-emerald-400/35 bg-emerald-500/[0.04]"
                    : "border-cyan-400/30 bg-cyan-500/[0.035]",
                ].join(" ")}
                style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
              >
                {(g.label || g.accent) && (
                  <div className="absolute -top-3 left-3 flex items-center gap-2 px-1.5">
                    {g.label && (
                      <span
                        className={[
                          "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                          g.finished
                            ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                            : "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30",
                        ].join(" ")}
                      >
                        {g.label}
                      </span>
                    )}
                    {g.accent && (
                      <span className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/80 ring-1 ring-white/10">
                        {g.accent}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* SVG connections */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              <defs>
                <linearGradient id="bracketLine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.6)" />
                  <stop offset="100%" stopColor="rgba(52,211,153,0.25)" />
                </linearGradient>
                <linearGradient id="bracketLineRTL" x1="100%" y1="0%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.6)" />
                  <stop offset="100%" stopColor="rgba(52,211,153,0.25)" />
                </linearGradient>
                <linearGradient id="bracketLeg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.85)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0.45)" />
                </linearGradient>
              </defs>

              {edges.map((e, idx) => {
                const a = nodeById.get(e.from);
                const b = nodeById.get(e.to);
                if (!a || !b) return null;

                // Leg link: vertical dashed cyan connector tying a tie's two legs.
                if (e.kind === "leg") {
                  const upper = a.y <= b.y ? a : b;
                  const lower = a.y <= b.y ? b : a;
                  const x1 = upper.x + upper.w / 2;
                  const y1 = upper.y + upper.h;
                  const x2 = lower.x + lower.w / 2;
                  const y2 = lower.y;
                  const dy = Math.max(14, (y2 - y1) * 0.5);
                  const d = `M ${x1} ${y1} C ${x1} ${y1 + dy} ${x2} ${y2 - dy} ${x2} ${y2}`;
                  return (
                    <path
                      key={idx}
                      d={d}
                      fill="none"
                      stroke="url(#bracketLeg)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeDasharray="3 5"
                    />
                  );
                }

                // Progression link: anchor on the tie CONTAINER when an endpoint is a
                // two-legged tie, so the curve meets the whole tie's edge/center.
                const aBox = (a.group && groupById.get(a.group)) || a;
                const bBox = (b.group && groupById.get(b.group)) || b;

                const axc = aBox.x + aBox.w / 2;
                const bxc = bBox.x + bBox.w / 2;
                const rtl = axc > bxc;

                const x1 = rtl ? aBox.x : aBox.x + aBox.w;
                const y1 = aBox.y + aBox.h / 2;
                const x2 = rtl ? bBox.x + bBox.w : bBox.x;
                const y2 = bBox.y + bBox.h / 2;

                const d = generateElbowPath({ x1, y1, x2, y2 });

                return (
                  <g key={idx}>
                    {/* Soft glow behind */}
                    <path d={d} fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth={12} strokeLinecap="round" />
                    {/* Main line */}
                    <path
                      d={d}
                      fill="none"
                      stroke={`url(#${rtl ? "bracketLineRTL" : "bracketLine"})`}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map((n) => (
              <div
                key={n.id}
                className="absolute rounded-xl border border-white/[0.08] bg-zinc-900/90 backdrop-blur-sm shadow-xl shadow-black/30 overflow-hidden transition-shadow hover:shadow-emerald-900/15 hover:border-white/15"
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
              >
                {nodeContent ? nodeContent(n) : (
                  <div className="flex items-center justify-center h-full text-sm text-white/60">{n.label ?? n.id}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hint — bottom-left */}
      <div className="absolute left-3 bottom-3 z-20 rounded-full bg-black/50 border border-white/[0.06] px-3 py-1 backdrop-blur-sm">
        <span className="text-[10px] text-white/30 font-medium tracking-wide">
          Drag to pan · Ctrl+scroll to zoom
        </span>
      </div>
    </div>
  );
};

export default KOStageViewer;
