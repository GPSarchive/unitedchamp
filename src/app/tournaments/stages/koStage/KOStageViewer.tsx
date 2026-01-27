// File: KOStageViewer.tsx — Elegant bracket viewer with smooth curves & sporty design
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BracketBackground } from "./BracketBackground";
import { generateElbowPath } from "./BracketLineStyles";

export type NodeBox = { id: string; x: number; y: number; w: number; h: number; label?: string };

type Connection = [string, string];

type Props = {
  nodes: NodeBox[];
  connections: Connection[];
  nodeContent?: (n: NodeBox) => React.ReactNode;
  minZoom?: number;
  maxZoom?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const KOStageViewer = ({
  nodes,
  connections,
  nodeContent,
  minZoom = 0.3,
  maxZoom = 2.5,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const nodeById = useMemo(() => {
    const m = new Map<string, NodeBox>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const baseWidth = useMemo(
    () => Math.max(800, nodes.reduce((mx, n) => Math.max(mx, n.x + n.w), 0) + 100),
    [nodes]
  );
  const baseHeight = useMemo(
    () => Math.max(400, nodes.reduce((my, n) => Math.max(my, n.y + n.h), 0) + 100),
    [nodes]
  );

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
              </defs>

              {connections.map(([from, to], idx) => {
                const a = nodeById.get(from);
                const b = nodeById.get(to);
                if (!a || !b) return null;

                const axc = a.x + a.w / 2;
                const bxc = b.x + b.w / 2;
                const rtl = axc > bxc;

                const x1 = rtl ? a.x : a.x + a.w;
                const y1 = a.y + a.h / 2;
                const x2 = rtl ? b.x + b.w : b.x;
                const y2 = b.y + b.h / 2;

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
