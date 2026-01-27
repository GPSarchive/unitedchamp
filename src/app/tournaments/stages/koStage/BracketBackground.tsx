// File: BracketBackground.tsx — Subtle pitch-turf gradient background for knockout bracket

"use client";

import React from "react";

interface BracketBackgroundProps {
  className?: string;
}

export const BracketBackground: React.FC<BracketBackgroundProps> = ({
  className = "",
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900/95 to-zinc-950" />

      {/* Subtle diagonal stripe texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            135deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.5) 40px,
            rgba(255,255,255,0.5) 41px
          )`,
        }}
      />

      {/* Center vignette glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04)_0%,transparent_70%)]" />
    </div>
  );
};

export default BracketBackground;
