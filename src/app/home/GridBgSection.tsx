"use client";

import React from "react";
import DotGrid from "@/app/OMADES/DotGrid";

type Props = React.PropsWithChildren<{
  className?: string;
  baseColor?: string;
  activeColor?: string;
  dotSize?: number;
  gap?: number;
}>;

export default function GridBgSection({
  className = "",
  baseColor = "#1F1B2E",
  activeColor = "#F59E0B",
  dotSize = 2,
  gap = 15,
  children,
}: Props) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <DotGrid
        className="absolute inset-0 z-0 pointer-events-none"
        baseColor={baseColor}
        activeColor={activeColor}
        dotSize={dotSize}
        gap={gap}
        proximity={120}
        shockRadius={250}
        shockStrength={5}
        resistance={750}
        returnDuration={1.5}
      />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
