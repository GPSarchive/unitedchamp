  // app/.../stages/KnockoutTree/newknockout/BracketEditor.tsx
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
    /** Optional: snap to grid pixels (default 10) */
    snap?: number;
  };

  export default function BracketEditor({
    nodes,
    connections,
    onNodesChange,
    onConnectionsChange,
    nodeContent,
    snap = 10,
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
          dx: e.clientX - rect.left,
          dy: e.clientY - rect.top,
        };
        setDraggingId(id);
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      },
      []
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!draggingId) return;
        const container = containerRef.current;
        if (!container) return;

        const cRect = container.getBoundingClientRect();
        const nx = snapTo(e.clientX - cRect.left - dragOffset.current.dx);
        const ny = snapTo(e.clientY - cRect.top - dragOffset.current.dy);

        onNodesChange(
          nodes.map((n) => (n.id === draggingId ? { ...n, x: nx, y: ny } : n))
        );
      },
      [draggingId, nodes, onNodesChange, snapTo]
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

    // Draw connection lines as SVG
    const lines = useMemo(() => {
      const arr: Array<{ x1: number; y1: number; x2: number; y2: number; idx: number }> = [];
      connections.forEach(([from, to], idx) => {
        const a = nodeById.get(from);
        const b = nodeById.get(to);
        if (!a || !b) return;
        const x1 = a.x + a.w;
        const y1 = a.y + a.h / 2;
        const x2 = b.x;
        const y2 = b.y + b.h / 2;
        arr.push({ x1, y1, x2, y2, idx });
      });
      return arr;
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
      <div className="relative w-full overflow-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <div
          ref={containerRef}
          className="relative"
          style={{
            width,
            height,
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: `${snap}px ${snap}px, ${snap}px ${snap}px`,
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* SVG connection layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {lines.map((l) => (
              <g key={l.idx}>
                <line
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="currentColor"
                  strokeWidth={2}
                  className="text-white/50"
                />
                {/* small click target in the middle to remove the connection */}
                <circle
                  cx={(l.x1 + l.x2) / 2}
                  cy={(l.y1 + l.y2) / 2}
                  r={8}
                  fill="rgba(255,255,255,0.08)"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => removeConnection(l.idx)}
                />
              </g>
            ))}
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const isPending = pendingFrom === n.id;
            return (
              <div
                key={n.id}
                className={[
                  "absolute rounded-xl border p-2 flex flex-col gap-1 select-none",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]",
                  isPending ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/15 bg-black/40",
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

        {/* Footer tips */}
        <div className="px-3 py-2 text-xs text-white/60 border-t border-white/10 bg-black/30">
          Drag nodes to reposition. Double-click a node or press “Connect”,
          then click another node to create an edge. Click the small circle on a
          line to remove that connection. Press <kbd>Esc</kbd> to cancel a pending connection.
        </div>
      </div>
    );
  }
