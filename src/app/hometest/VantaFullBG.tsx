'use client';

import { useCallback, useEffect, useRef } from 'react';
import Script from 'next/script';

export default function VantaFullBG() {
  const bgRef = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<any>(null);

  const init = useCallback(() => {
    const w = window as any;
    if (!bgRef.current || effectRef.current) return;
    if (w.p5 && w.VANTA?.TOPOLOGY) {
      effectRef.current = w.VANTA.TOPOLOGY({
        el: bgRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 20,
        minWidth: 20,
        scale: 1,
        scaleMobile: 1,
        color: 0x9f371b,
        backgroundColor: 0xf4c253,
      });
    }
  }, []);

  useEffect(() => {
    // one attempt on mount (in case scripts are cached)
    init();
    return () => {
      try { effectRef.current?.destroy?.(); } catch {}
      effectRef.current = null;
    };
  }, [init]);

  return (
    <>
      {/* Load p5 first, then Vanta */}
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

      {/* Fixed, full-viewport layer behind everything */}
      <div
        ref={bgRef}
        className="fixed inset-0 -z-10"
        style={{
          // Let clicks go through to your UI;
          // Vanta still tracks mouse via window listeners.
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
