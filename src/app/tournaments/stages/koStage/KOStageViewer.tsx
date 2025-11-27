// File: KOStageViewer.tsx (horizontal + vertical scroll, height-fit zoom)
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
  snap?: number;
  minZoom?: number;
  maxZoom?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const KOStageViewer = ({
  nodes,
  connections,
  nodeContent,
  snap = 10,
  minZoom = 0.4,
  maxZoom = 3,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const nodeById = useMemo(() => {
    const m = new Map<string, NodeBox>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  // Base logical size of the diagram (unscaled)
  const baseWidth = useMemo(
    () => Math.max(800, nodes.reduce((mx, n) => Math.max(mx, n.x + n.w), 0) + 80),
    [nodes]
  );
  const baseHeight = useMemo(
    () => Math.max(400, nodes.reduce((my, n) => Math.max(my, n.y + n.h), 0) + 80),
    [nodes]
  );

  const [zoom, setZoom] = useState(1);

  // Fit height on mount and resize. Keeps vertical size fixed at container height.
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

  // Keep point under cursor while zooming (both axes)
  const setZoomAt = (next: number, clientX?: number, clientY?: number) => {
    const c = containerRef.current;
    if (!c) return;
    const newZ = clamp(next, minZoom, maxZoom);
    if (newZ === zoom) return;

    const rect = c.getBoundingClientRect();
    const cx = clientX ?? rect.left + rect.width / 2;
    const cy = clientY ?? rect.top + rect.height / 2;

    const contentX = (c.scrollLeft + (cx - rect.left)) / zoom; // logical coords
    const contentY = (c.scrollTop + (cy - rect.top)) / zoom;

    setZoom(newZ);
    requestAnimationFrame(() => {
      c.scrollLeft = contentX * newZ - (cx - rect.left);
      c.scrollTop = contentY * newZ - (cy - rect.top);
    });
  };

  // Wheel: Ctrl/Cmd to zoom. Otherwise native scroll. Shift+wheel for horizontal is native.
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = Math.pow(0.95, e.deltaY / 53);
      setZoomAt(zoom * factor, e.clientX, e.clientY);
    }
  };

  // Drag-to-pan (mouse or touch)
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

  // Pinch to zoom for touch (two-finger)
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

  // Keyboard zoom shortcuts
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      setZoomAt(zoom * 1.1);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
      e.preventDefault();
      setZoomAt(zoom / 1.1);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      setZoomAt(clamp(containerRef.current!.clientHeight / baseHeight, minZoom, maxZoom));
    }
  };

  // Track size follows zoom. Vertical size grows; both scrollbars enabled.
  const trackWidth = baseWidth * zoom;
  const trackHeight = baseHeight * zoom;

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-black/40 shadow-xl shadow-black/40">
      {/* Controls */}
      <div className="pointer-events-auto absolute right-3 top-3 z-10">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2 rounded-xl bg-zinc-950/90 border border-amber-500/25 p-2 backdrop-blur-sm shadow-lg shadow-orange-500/10">
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white/90 hover:bg-zinc-800 hover:border-orange-500/50 transition-colors"
            onClick={() => setZoomAt(zoom / 1.1)}
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            aria-label="Zoom"
            className="h-6 w-28 accent-orange-500"
            type="range"
            min={minZoom}
            max={maxZoom}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomAt(parseFloat(e.target.value))}
          />
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white/90 hover:bg-zinc-800 hover:border-orange-500/50 transition-colors"
            onClick={() => setZoomAt(zoom * 1.1)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="ml-1 rounded-lg border border-orange-500/50 bg-orange-600/30 px-2 py-1 text-xs text-amber-100 hover:bg-orange-600/50 transition-colors"
            onClick={() => setZoomAt(containerRef.current!.clientHeight / baseHeight)}
          >
            Fit H
          </button>
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-x-auto overflow-y-auto touch-pan-x touch-pan-y touch-none [&_*]:select-none h-96 md:h-[32rem]"
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
        {/* Track grows with zoom in both axes */}
        <div ref={trackRef} className="relative" style={{ width: trackWidth, height: trackHeight }}>
          {/* Logical plane scaled in place */}
          <div
            className="absolute top-0 left-0"
            style={{
              width: baseWidth,
              height: baseHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {/* Background Pattern */}
            <BracketBackground snap={snap} />

            {/* SVG connection layer */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              <defs>
                {/* Gold/Orange/Red gradient left-to-right */}
                <linearGradient id="edgeGradLTR" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(251,191,36,0.5)" />
                  <stop offset="50%" stopColor="rgba(249,115,22,0.8)" />
                  <stop offset="100%" stopColor="rgba(239,68,68,0.95)" />
                </linearGradient>
                {/* Gold/Orange/Red gradient right-to-left */}
                <linearGradient id="edgeGradRTL" x1="100%" y1="0%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(251,191,36,0.5)" />
                  <stop offset="50%" stopColor="rgba(249,115,22,0.8)" />
                  <stop offset="100%" stopColor="rgba(239,68,68,0.95)" />
                </linearGradient>
                {/* Warm glow filter for depth */}
                <filter id="warmGlow">
                  <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {connections.map(([from, to], idx) => {
                const a = nodeById.get(from);
                const b = nodeById.get(to);
                if (!a || !b) return null;

                const axc = a.x + a.w / 2;
                const bxc = b.x + b.w / 2;
                const rtl = axc > bxc;

                let x1 = rtl ? a.x - 6 : a.x + a.w + 6;
                let y1 = a.y + a.h / 2;
                let x2 = rtl ? b.x + b.w + 6 : b.x - 6;
                let y2 = b.y + b.h / 2;

                // Generate path using elbow style
                const d = generateElbowPath({ x1, y1, x2, y2 });

                return (
                  <g key={idx} className="pointer-events-none">
                    {/* Outer warm glow/shadow */}
                    <path d={d} fill="none" stroke="rgba(249,115,22,0.2)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
                    {/* Main gradient stroke with warm glow filter */}
                    <path d={d} fill="none" stroke={`url(#${rtl ? "edgeGradRTL" : "edgeGradLTR"})`} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" filter="url(#warmGlow)" />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map((n) => (
              <div
                key={n.id}
                className="absolute rounded-2xl border border-amber-500/25 bg-zinc-950/85 p-2 text-white backdrop-blur-sm shadow-lg shadow-orange-500/10 hover:border-orange-500/50 hover:bg-zinc-950/95 hover:shadow-orange-500/20 transition-all"
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
              >
                <div className="flex items-center justify-between text-xs text-amber-200/90">
                  <span className="truncate font-medium">{n.label ?? n.id}</span>
                </div>
                <div className="mt-1 h-[1px] w-full bg-gradient-to-r from-amber-400/20 via-orange-500/50 to-red-500/30" />
                <div className="flex-1 min-h-0 text-sm leading-tight">
                  {nodeContent ? <div className="h-full">{nodeContent(n)}</div> : <div className="opacity-80 text-white/90">{n.label ?? n.id}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 bottom-3 rounded-md bg-zinc-950/90 border border-amber-500/25 px-2 py-1 text-[11px] text-amber-200/80">
        Scroll H/V · Drag to pan · Pinch/Ctrl+wheel to zoom
      </div>
    </div>
  );
};

export default KOStageViewer;
