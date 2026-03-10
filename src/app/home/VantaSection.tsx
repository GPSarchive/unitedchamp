"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Script from "next/script";

type Props = React.PropsWithChildren<{
  className?: string;
  // Vanta options (tweak as you like)
  color?: number;
  backgroundColor?: number;
  mouseControls?: boolean;
  touchControls?: boolean;
  gyroControls?: boolean;
  minHeight?: number;
  minWidth?: number;
  scale?: number;
  scaleMobile?: number;
  overlayClassName?: string; // optional darkening scrim for contrast
}>;

export default function VantaSection({
  className = "",
  color = 0x9f371b,
  backgroundColor = 0xf4c253,
  mouseControls = true,
  touchControls = true,
  gyroControls = false,
  minHeight = 20,
  minWidth = 20,
  scale = 1,
  scaleMobile = 1,
  overlayClassName, // e.g. "bg-black/30"
  children,
}: Props) {
  const bgRef = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<any>(null);

  const init = useCallback(() => {
    const w = window as any;
    if (!bgRef.current || effectRef.current) return;
    if (w.p5 && w.VANTA?.TOPOLOGY) {
      effectRef.current = w.VANTA.TOPOLOGY({
        el: bgRef.current,
        mouseControls,
        touchControls,
        gyroControls,
        minHeight,
        minWidth,
        scale,
        scaleMobile,
        color,
        backgroundColor,
      });
    }
  }, [
    mouseControls, touchControls, gyroControls,
    minHeight, minWidth, scale, scaleMobile,
    color, backgroundColor,
  ]);

  useEffect(() => {
    init(); // in case scripts are cached
    return () => {
      try { effectRef.current?.destroy?.(); } catch {}
      effectRef.current = null;
    };
  }, [init]);

  return (
    <section className={`relative overflow-hidden ${className}`}>
      {/* Load p5 then Vanta (Next.js dedupes these if used multiple times) */}
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js" strategy="afterInteractive" onLoad={init} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.topology.min.js" strategy="afterInteractive" onLoad={init} />

      {/* Vanta canvas target */}
      <div
        ref={bgRef}
        className="absolute inset-0 z-0"
        style={{ pointerEvents: "none" }}
      />

      {/* Optional dark scrim for text contrast */}
      {overlayClassName ? (
        <div className={`absolute inset-0 z-10 ${overlayClassName}`} />
      ) : null}

      {/* Your content above */}
      <div className="relative z-20">
        {children}
      </div>
    </section>
  );
}
