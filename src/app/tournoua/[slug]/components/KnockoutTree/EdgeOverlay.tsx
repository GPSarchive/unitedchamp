// app/tournoua/[slug]/components/teams/KnockoutTreeComponents/EdgeOverlay.tsx
"use client";

import { useMemo } from "react";

export type EdgeStyle =
  | "bold"
  | "outline"
  | "glow"
  | "dashed"
  | "outlineGlow"
  | "squiggleOrange";

export default function EdgeOverlay({
  paths,
  className,
  style = "outlineGlow",
}: {
  paths: string[];
  className?: string;
  style?: EdgeStyle;
}) {
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  return (
    <svg className={`pointer-events-none absolute inset-0 w-full h-full z-20 ${className ?? ""}`}>
      <defs>
        {/* Gradient & glow used by several styles */}
        <linearGradient id={`brkt-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
        </linearGradient>
        <filter id={`edgeGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#60a5fa" floodOpacity="0.85" />
        </filter>

        {/* NEW: squiggle filter for wavy connectors */}
        <filter id={`squiggle-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="1"
            seed="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4.8"          /* ↑ increase for more wiggle */
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      {paths.map((d, i) => {
        if (style === "bold") {
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.95}
              strokeWidth={3.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (style === "outline") {
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#000000" strokeOpacity={0.45} strokeWidth={6.2} />
              <path
                d={d}
                fill="none"
                stroke={`url(#brkt-${uid})`}
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        }
        if (style === "glow") {
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={`url(#brkt-${uid})`}
              strokeWidth={3.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#edgeGlow-${uid})`}
            />
          );
        }
        if (style === "dashed") {
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={3}
              strokeDasharray="8 8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (style === "squiggleOrange") {
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#f97316"             /* orange-500 */
              strokeWidth={5}              /* thicker */
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#squiggle-${uid})`}  /* make it wavy */
            />
          );
        }
        // outlineGlow (default)
        return (
          <g key={i} filter={`url(#edgeGlow-${uid})`}>
            <path d={d} fill="none" stroke="#000000" strokeOpacity={0.5} strokeWidth={6.4} />
            <path
              d={d}
              fill="none"
              stroke={`url(#brkt-${uid})`}
              strokeWidth={3.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
