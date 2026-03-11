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
      {/* Ambient warm glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-amber-400/15 blur-[160px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-yellow-500/10 blur-[160px]" />
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}
