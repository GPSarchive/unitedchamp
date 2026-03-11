"use client";

import React from "react";
import StaticDotGrid from "./StaticDotGrid";

type Props = React.PropsWithChildren<{
  className?: string;
  baseColor?: string;
  bgColor?: string;
  dotSize?: number;
  gap?: number;
}>;

export default function GridBgSection({
  className = "",
  baseColor = "#1a1a2e",
  bgColor,
  dotSize = 2,
  gap = 15,
  children,
}: Props) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <StaticDotGrid
        className="absolute inset-0 z-0 pointer-events-none"
        baseColor={baseColor}
        bgColor={bgColor}
        dotSize={dotSize}
        gap={gap}
      />
      {/* Ambient warm glow — mirrors the Vanta sections */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden>
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-amber-400/35 blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/25 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-yellow-400/20 blur-[160px]" />
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}
