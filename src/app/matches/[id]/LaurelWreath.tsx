// src/app/matches/[id]/LaurelWreath.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";

export default function LaurelWreath({
  cx = 66,
  cy = 44,
  r = 65,
  leavesPerSide = 13,
  rotation = 0, // μοίρες
  fillId = "goldGrad",
  opacity = 0.95,
  className,
  style,
}: {
  cx?: number;
  cy?: number;
  r?: number;
  leavesPerSide?: number;
  rotation?: number;
  fillId?: string;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Motion feel
  const amplitudeFor = (i: number, side: "L" | "R") =>
    2.5 + ((i + (side === "L" ? 1 : 2)) % 3) * 0.6;
  const durationFor = (i: number) => 3.2 + (i % 4) * 0.2;

  // Sequential appearance: both sides start together from bottom -> top, 0.1s between rows
  const STAGGER = 0.1;
  const ENTRY_DUR = 0.3;

  // Precompute cos/sin for the whole-wreath rotation so we can rank leaves by *visual* Y (bottom to top)
  const theta = toRad(rotation);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Helper: rotate a point around (cx, cy) by `rotation`, return rotated Y (SVG downwards)
  const rotatedY = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return cy + dx * sinT + dy * cosT;
  };

  const maxIdx = Math.max(leavesPerSide - 1, 1);

  // Build meta for LEFT side (angles ~ -120° → -40°)
  const leftMeta = React.useMemo(() => {
    const arr = Array.from({ length: leavesPerSide }, (_, i) => {
      const t = i / maxIdx;
      const angle = -120 + t * 80;
      const x = cx + r * Math.cos(toRad(angle));
      const y = cy + r * Math.sin(toRad(angle));
      const base = angle - 90; // leaf’s own orientation
      const amp = amplitudeFor(i, "L");
      const yAfterRotation = rotatedY(x, y);
      return { i, x, y, base, amp, yAfterRotation };
    });

    // Rank from bottom to top (larger Y is lower on screen in SVG)
    const order = [...arr]
      .sort((a, b) => b.yAfterRotation - a.yAfterRotation)
      .map((item, rank) => ({ index: item.i, rank }));

    const rankMap = new Map(order.map((o) => [o.index, o.rank]));
    return arr.map((m) => ({ ...m, rank: rankMap.get(m.i)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leavesPerSide, cx, cy, r, rotation]);

  // Build meta for RIGHT side (angles ~ 30° → 110°)
  const rightMeta = React.useMemo(() => {
    const arr = Array.from({ length: leavesPerSide }, (_, i) => {
      const t = i / maxIdx;
      const angle = 30 + t * 80;
      const x = cx + r * Math.cos(toRad(angle));
      const y = cy + r * Math.sin(toRad(angle));
      const base = angle - 90;
      const amp = amplitudeFor(i, "R");
      const yAfterRotation = rotatedY(x, y);
      return { i, x, y, base, amp, yAfterRotation };
    });

    // Rank from bottom to top, same logic as left
    const order = [...arr]
      .sort((a, b) => b.yAfterRotation - a.yAfterRotation)
      .map((item, rank) => ({ index: item.i, rank }));

    const rankMap = new Map(order.map((o) => [o.index, o.rank]));
    return arr.map((m) => ({ ...m, rank: rankMap.get(m.i)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leavesPerSide, cx, cy, r, rotation]);

  return (
    <g
      className={className}
      style={style}
      transform={`rotate(${rotation} ${cx} ${cy})`}
      fill={`url(#${fillId})`}
      stroke={`url(#${fillId})`}
      strokeWidth={1}
    >
      {/* LEFT — appears bottom → top; delay = rank * 0.1s */}
      {leftMeta.map(({ i, x, y, base, amp, rank }) => {
        const appearDelay = rank * STAGGER;
        return (
          <motion.ellipse
            key={`L${i}`}
            cx={x}
            cy={y}
            rx={6.2}
            ry={11}
            transform={`rotate(${base} ${x} ${y})`}
            opacity={opacity}
            initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: [0, amp, 0, -amp * 0.6, 0],
            }}
            transition={{
              opacity: { delay: appearDelay, duration: ENTRY_DUR, ease: "easeOut" },
              scale: { delay: appearDelay, duration: ENTRY_DUR, ease: "easeOut" },
              rotate: {
                delay: appearDelay + ENTRY_DUR,
                duration: durationFor(i),
                ease: "easeInOut",
                repeat: Infinity,
              },
            }}
            style={{ transformOrigin: "50% 50%", transformBox: "fill-box" }}
          />
        );
      })}

      {/* RIGHT — appears bottom → top; same rank -> same time as left counterpart */}
      {rightMeta.map(({ i, x, y, base, amp, rank }) => {
        const appearDelay = rank * STAGGER;
        return (
          <motion.ellipse
            key={`R${i}`}
            cx={x}
            cy={y}
            rx={6.2}
            ry={11}
            transform={`rotate(${base} ${x} ${y})`}
            opacity={opacity}
            initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              // mirror sway direction vs left
              rotate: [0, -amp, 0, amp * 0.6, 0],
            }}
            transition={{
              opacity: { delay: appearDelay, duration: ENTRY_DUR, ease: "easeOut" },
              scale: { delay: appearDelay, duration: ENTRY_DUR, ease: "easeOut" },
              rotate: {
                delay: appearDelay + ENTRY_DUR,
                duration: durationFor(i),
                ease: "easeInOut",
                repeat: Infinity,
              },
            }}
            style={{ transformOrigin: "50% 50%", transformBox: "fill-box" }}
          />
        );
      })}
    </g>
  );
}
