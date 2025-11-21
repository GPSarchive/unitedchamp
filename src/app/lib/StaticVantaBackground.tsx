"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Script from "next/script";

type Props = {
  // Vanta effect type and colors
  color?: number;
  backgroundColor?: number;
  // Performance optimizations
  mobileScale?: number; // Lower scale for mobile = better performance
  desktopScale?: number;
  // Optional overlay for better text contrast
  overlayClassName?: string; // e.g. "bg-black/20"
};

/**
 * StaticVantaBackground - Renders Vanta effect ONCE and freezes it
 *
 * Key Features:
 * - Fixed position (stays in place while content scrolls)
 * - Renders once, then pauses animation (saves CPU/GPU)
 * - Responsive to all screen sizes
 * - Optimized for mobile with lower quality settings
 * - Zero animation overhead after initial render
 *
 * Perfect for backgrounds where you want the Vanta "look" without the
 * continuous animation cost.
 */
export default function StaticVantaBackground({
  color = 0x9f371b,        // brownish-red (matches your VantaSection)
  backgroundColor = 0xf4c253, // golden yellow
  mobileScale = 0.8,       // Lower scale on mobile = better performance
  desktopScale = 1.0,
  overlayClassName,
}: Props) {
  const bgRef = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<any>(null);
  const hasInitialized = useRef(false);

  const init = useCallback(() => {
    const w = window as any;
    if (!bgRef.current || effectRef.current || hasInitialized.current) return;
    if (!w.p5 || !w.VANTA?.TOPOLOGY) return;

    // Detect mobile
    const isMobile = window.innerWidth < 768;
    const scale = isMobile ? mobileScale : desktopScale;

    // Initialize Vanta with optimized settings
    effectRef.current = w.VANTA.TOPOLOGY({
      el: bgRef.current,
      mouseControls: false,  // Disabled - we're frozen anyway
      touchControls: false,  // Disabled - saves processing
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: scale,
      scaleMobile: mobileScale,
      color,
      backgroundColor,
    });

    hasInitialized.current = true;

    // FREEZE the animation after a short delay (let it render 1-2 frames)
    // This gives us the Vanta look without continuous animation
    setTimeout(() => {
      if (effectRef.current) {
        // Pause the animation loop
        if (typeof effectRef.current.pause === 'function') {
          effectRef.current.pause();
        } else if (effectRef.current.renderer) {
          // Alternative: stop the renderer's animation loop
          effectRef.current.renderer.setAnimationLoop?.(null);
        }

        console.log("[StaticVantaBackground] Animation frozen - static background ready");
      }
    }, 500); // Wait 500ms for a nice-looking frame

  }, [color, backgroundColor, mobileScale, desktopScale]);

  useEffect(() => {
    init();

    // Cleanup on unmount
    return () => {
      try {
        effectRef.current?.destroy?.();
      } catch (e) {
        console.warn("[StaticVantaBackground] Cleanup error:", e);
      }
      effectRef.current = null;
      hasInitialized.current = false;
    };
  }, [init]);

  return (
    <>
      {/* Load p5 and Vanta scripts */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"
        strategy="afterInteractive"
        onLoad={init}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.topology.min.js"
        strategy="afterInteractive"
        onLoad={init}
      />

      {/* Fixed background container - stays in place while content scrolls */}
      <div
        ref={bgRef}
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          width: '100vw',
          height: '100vh',
        }}
      />

      {/* Optional overlay for text contrast */}
      {overlayClassName && (
        <div className={`pointer-events-none fixed inset-0 -z-10 ${overlayClassName}`} />
      )}
    </>
  );
}
