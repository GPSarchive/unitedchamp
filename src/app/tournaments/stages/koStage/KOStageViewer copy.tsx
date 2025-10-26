"use client";

import React, { useMemo } from "react";
import { NodeBox } from "@/app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/newknockout/BracketEditor"; // Reusing NodeBox from BracketEditor

type Connection = [string, string]; // From -> To

type NodeMeta = { round: number; bracket_pos: number };

type Props = {
  nodes: NodeBox[];  // Array of nodes (matches)
  connections: Connection[];  // Array of connections between nodes
  nodeContent?: (n: NodeBox) => React.ReactNode;  // Optional custom content for nodes
  snap?: number;  // Optional snap value for positioning
  zoom?: number;  // Optional zoom value for scaling
};

const KOStageViewer = ({
  nodes,
  connections,
  nodeContent,
  snap = 10,
  zoom = 1,
}: Props) => {
  // Create a mapping of node IDs to NodeBox objects
  const nodeById = useMemo(() => {
    const m = new Map<string, NodeBox>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  // Calculate the width of the canvas (to fit all nodes)
  const width = useMemo(() => {
    const maxRight = nodes.reduce((mx, n) => Math.max(mx, n.x + n.w), 800);
    return Math.max(800, maxRight + 80);
  }, [nodes]);

  // Calculate the height of the canvas (to fit all nodes)
  const height = useMemo(() => {
    const maxBottom = nodes.reduce((my, n) => Math.max(my, n.y + n.h), 400);
    return Math.max(400, maxBottom + 80);
  }, [nodes]);

  return (
    <div className="relative w-full overflow-auto rounded-xl border border-white/10 bg-gradient-to-br from-red-950/60 via-[#2a0a0a]/60 to-amber-950/50">
      {/* Scroll area sized to zoomed content */}
      <div
        className="relative"
        style={{ width: width * zoom, height: height * zoom }}
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
              {/* Subtle gloss gradient for connections */}
              <linearGradient id="edgeGradLTR" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
              </linearGradient>
              <linearGradient id="edgeGradRTL" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
              </linearGradient>
            </defs>

            {/* Render all connections */}
            {connections.map(([from, to], idx) => {
              const a = nodeById.get(from);
              const b = nodeById.get(to);

              if (!a || !b) return null; // Safety check to ensure valid nodes

              const axc = a.x + a.w / 2;
              const bxc = b.x + b.w / 2;
              const rtl = axc > bxc;

              // Anchor points on the nearest sides
              let x1 = rtl ? a.x - 6 : a.x + a.w + 6;
              let y1 = a.y + a.h / 2;
              let x2 = rtl ? b.x + b.w + 6 : b.x - 6;
              let y2 = b.y + b.h / 2;

              const dx = Math.max(40, Math.abs(x2 - x1) * 0.35);
              const c1x = rtl ? x1 - dx : x1 + dx;
              const c2x = rtl ? x2 + dx : x2 - dx;
              const c1y = y1;
              const c2y = y2;

              const d = `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;

              return (
                <g key={idx} className="pointer-events-none">
                  {/* Glow / shadow underlay */}
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                  {/* Main sleek line */}
                  <path
                    d={d}
                    fill="none"
                    stroke={`url(#${rtl ? "edgeGradRTL" : "edgeGradLTR"})`}
                    strokeWidth={3}
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
              className="absolute rounded-2xl border p-2 flex flex-col gap-1 select-none"
              style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
            >
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="truncate">{n.label ?? n.id}</span>
              </div>

              <div className="flex-1 min-h-0 text-sm leading-tight">
                {nodeContent ? (
                  <div className="h-full">{nodeContent(n)}</div>
                ) : (
                  <div className="opacity-80 text-white/90">{n.label ?? n.id}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KOStageViewer;
