"use client";

import React from "react";
import StaticDotGrid from "./StaticDotGrid";

type Props = React.PropsWithChildren<{
  className?: string;
  baseColor?: string;
  dotSize?: number;
  gap?: number;
}>;

export default function GridBgSection({
  className = "",
  baseColor = "#1F1B2E",
  dotSize = 2,
  gap = 15,
  children,
}: Props) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <StaticDotGrid
        className="absolute inset-0 z-0 pointer-events-none"
        baseColor={baseColor}
        dotSize={dotSize}
        gap={gap}
      />
      {/* Edge fades — blend into page bg */}
      <div aria-hidden className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-zinc-950 to-transparent z-[1] pointer-events-none" />
      <div aria-hidden className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent z-[1] pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
