// src/app/lib/Navbar/NavbarBG.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// Optional props to tweak the effect
type NavbarBGProps = {
  className?: string;            // extra classes for the container
  style?: CSSProperties;         // extra inline styles
  color?: number;                // dot color (0xRRGGBB)
  backgroundColor?: number;      // background color (0xRRGGBB)
  showLines?: boolean;           // whether to draw connecting lines
  mouseControls?: boolean;
  touchControls?: boolean;
  gyroControls?: boolean;
  minHeight?: number;
  minWidth?: number;
  scale?: number;
  scaleMobile?: number;
};

export default function NavbarBG({
  className = "",
  style,
  color = 0xc77536,
  backgroundColor = 0x0b0a0a, // same as 0xb0a0a from your snippet
  showLines = false,
  mouseControls = true,
  touchControls = true,
  gyroControls = false,
  minHeight = 200.0,
  minWidth = 200.0,
  scale = 1.0,
  scaleMobile = 1.0,
}: NavbarBGProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [effect, setEffect] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ default: DOTS }, THREE] = await Promise.all([
        import("vanta/dist/vanta.dots.min"),
        import("three"),
      ]);

      if (cancelled || !containerRef.current) return;

      const v = DOTS({
        el: containerRef.current,
        THREE,
        mouseControls,
        touchControls,
        gyroControls,
        minHeight,
        minWidth,
        scale,
        scaleMobile,
        color,
        backgroundColor,
        showLines,
      });

      setEffect(v);
    })();

    return () => {
      cancelled = true;
      if (effect?.destroy) effect.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    color,
    backgroundColor,
    showLines,
    mouseControls,
    touchControls,
    gyroControls,
    minHeight,
    minWidth,
    scale,
    scaleMobile,
  ]);

  // Absolutely-positioned so you can drop it behind your navbar
  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`absolute inset-0 -z-10 ${className}`}
      style={style}
    />
  );
}