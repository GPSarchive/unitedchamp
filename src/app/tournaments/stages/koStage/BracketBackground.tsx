// File: BracketBackground.tsx - Dots background pattern for knockout bracket

"use client";

import React from "react";

interface BracketBackgroundProps {
  snap?: number;
  className?: string;
}

export const BracketBackground: React.FC<BracketBackgroundProps> = ({
  snap = 10,
  className = "",
}) => {
  const backgroundStyle: React.CSSProperties = {
    backgroundImage: `radial-gradient(circle, rgba(249,115,22,0.12) 1px, transparent 1px)`,
    backgroundSize: `${snap * 2}px ${snap * 2}px`,
  };

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={backgroundStyle}
      aria-hidden="true"
    />
  );
};

export default BracketBackground;
