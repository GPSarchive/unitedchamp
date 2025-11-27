// File: BracketBackground.tsx - Customizable background patterns for knockout bracket

"use client";

import React from "react";

export type BackgroundPattern =
  | "none"
  | "dots"
  | "grid"
  | "diagonal"
  | "hexagon"
  | "circuit"
  | "waves"
  | "subtle-dots";

interface BracketBackgroundProps {
  pattern?: BackgroundPattern;
  snap?: number;
  className?: string;
}

export const BracketBackground: React.FC<BracketBackgroundProps> = ({
  pattern = "subtle-dots",
  snap = 10,
  className = "",
}) => {
  const getBackgroundStyle = (): React.CSSProperties => {
    switch (pattern) {
      case "none":
        return {
          background: "transparent",
        };

      case "dots":
        return {
          backgroundImage: `radial-gradient(circle, rgba(249,115,22,0.12) 1px, transparent 1px)`,
          backgroundSize: `${snap * 2}px ${snap * 2}px`,
        };

      case "grid":
        return {
          backgroundImage: `
            linear-gradient(to right, rgba(251,191,36,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(251,191,36,0.08) 1px, transparent 1px)
          `,
          backgroundSize: `${snap * 2}px ${snap * 2}px`,
        };

      case "diagonal":
        return {
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent ${snap * 4}px,
              rgba(249,115,22,0.05) ${snap * 4}px,
              rgba(249,115,22,0.05) ${snap * 4 + 1}px
            )
          `,
        };

      case "hexagon":
        return {
          backgroundImage: `
            radial-gradient(circle at 0% 50%, rgba(251,191,36,0.06) 1px, transparent 1px),
            radial-gradient(circle at 100% 50%, rgba(249,115,22,0.06) 1px, transparent 1px)
          `,
          backgroundSize: `${snap * 3}px ${snap * 2.6}px`,
          backgroundPosition: `0 0, ${snap * 1.5}px ${snap * 1.3}px`,
        };

      case "circuit":
        return {
          backgroundImage: `
            linear-gradient(to right, rgba(251,191,36,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(251,191,36,0.05) 1px, transparent 1px),
            linear-gradient(to right, rgba(249,115,22,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(249,115,22,0.03) 1px, transparent 1px)
          `,
          backgroundSize: `${snap * 8}px ${snap * 8}px, ${snap * 8}px ${snap * 8}px, ${snap * 2}px ${snap * 2}px, ${snap * 2}px ${snap * 2}px`,
        };

      case "waves":
        return {
          backgroundImage: `
            radial-gradient(ellipse at top, rgba(251,191,36,0.04), transparent 50%),
            radial-gradient(ellipse at bottom, rgba(249,115,22,0.04), transparent 50%)
          `,
          backgroundSize: `${snap * 10}px ${snap * 5}px`,
          backgroundPosition: `0 0, ${snap * 5}px ${snap * 2.5}px`,
        };

      case "subtle-dots":
      default:
        return {
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: `${snap * 1.8}px ${snap * 1.8}px`,
        };
    }
  };

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={getBackgroundStyle()}
      aria-hidden="true"
    />
  );
};

export default BracketBackground;
