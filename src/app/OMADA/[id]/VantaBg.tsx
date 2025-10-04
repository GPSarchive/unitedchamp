// app/OMADA/[id]/VantaBg.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type VantaInstance = { destroy?: () => void } | null;

const rIC: (cb: () => void) => void =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? // @ts-ignore
      (cb) => window.requestIdleCallback(cb, { timeout: 1000 })
    : (cb) => setTimeout(cb, 120); // fallback

export default function VantaBg({ className = '' }: { className?: string }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [vanta, setVanta] = useState<VantaInstance>(null);

  useEffect(() => {
    let mounted = true;
    let io: IntersectionObserver | null = null;

    // Respect prefers-reduced-motion: don't animate at all
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) return;

    const init = async () => {
      try {
        // Try node modules; if they’re not installed, this will throw
        const THREE = await import('three');
        const WAVES = (await import('vanta/dist/vanta.waves.min')).default;

        if (!mounted || !elRef.current || vanta) return;

        const isTouch =
          typeof window !== 'undefined' &&
          ('ontouchstart' in window || navigator.maxTouchPoints > 0);

        const instance = WAVES({
          el: elRef.current,
          THREE, // pass the module object
          // Turn off pointer tracking (big win on low-end / mobile)
          mouseControls: false,
          touchControls: false,
          gyroControls: false,
          // Keep the canvas small on mobile and internally scaled
          scale: 0.9,
          scaleMobile: 0.6,
          minHeight: 200.0,
          minWidth: 200.0,
          // Warm theme
          color: 0x111115,
          shininess: isTouch ? 60.0 : 80.0,
          waveHeight: isTouch ? 8.0 : 10.0,
          waveSpeed: isTouch ? 0.22 : 0.3, // slower = fewer visual updates perceived
        });

        setVanta(instance);
      } catch (err) {
        // If node modules are missing, silently bail instead of crashing
        console.error('Vanta init skipped:', err);
      }
    };

    // Only initialize when the element is on-screen
    rIC(() => {
      if (!elRef.current) return;

      io = new IntersectionObserver(
        (entries) => {
          const onScreen = entries.some((e) => e.isIntersecting);
          if (onScreen) {
            init();
            io?.disconnect();
            io = null;
          }
        },
        { rootMargin: '0px 0px 200px 0px', threshold: 0.01 }
      );

      io.observe(elRef.current);
    });

    // Cleanup
    return () => {
      mounted = false;
      io?.disconnect();
      vanta?.destroy?.();
    };
  }, [vanta]);

  return <div ref={elRef} className={className} aria-hidden="true" />;
}
