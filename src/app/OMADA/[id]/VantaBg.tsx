// app/OMADA/[id]/VantaBg.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    THREE?: any;
    VANTA?: { WAVES?: (opts: any) => { destroy?: () => void } };
  }
}

type VantaInstance = { destroy?: () => void } | null;

export default function VantaBg({
  className = '',
  disabled = false,
  useViewportOnly = true, // only render effect at viewport size (big perf win)
}: {
  className?: string;
  disabled?: boolean;
  useViewportOnly?: boolean;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [vanta, setVanta] = useState<VantaInstance>(null);

  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (disabled || prefersReducedMotion) return;
    let mounted = true;

    (async () => {
      try {
        let THREE: any = null;
        let WAVES: any = null;

        // Try npm packages
        try {
          THREE = await import('three');
          WAVES = (await import('vanta/dist/vanta.waves.min')).default;
        } catch {
          // Fallback to globals if you use <Script> tags
          THREE = window.THREE ?? null;
          WAVES = window.VANTA?.WAVES ?? null;
        }

        if (!mounted || !elRef.current || vanta || !THREE || !WAVES) return;

        const isMobile = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches;

        const instance = WAVES({
          el: elRef.current,
          THREE,
          // PERF: inputs off
          mouseControls: false,
          touchControls: false,
          gyroControls: false,
          // PERF: reduce pixel workload
          scale: isMobile ? 0.6 : 0.85,
          scaleMobile: 0.6,
          minHeight: 200.0,
          minWidth: 200.0,
          // Visuals (keep warm + cheaper shading)
          color: 0x111115,
          shininess: 60.0,        // lower shininess = cheaper fragment work
          waveHeight: isMobile ? 8.0 : 10.0,
          // Some builds support waveSpeed; if present, lower it:
        
          waveSpeed: 0.4,
        });

        setVanta(instance);
      } catch (err) {
        console.error('Vanta init failed', err);
      }
    })();

    return () => {
      mounted = false;
      vanta?.destroy?.();
      setVanta(null);
    };
  }, [disabled, prefersReducedMotion, vanta]);

  // If we’re only rendering viewport-sized, keep the element fixed.
  const sizingClass = useViewportOnly
    ? 'fixed inset-0 h-screen w-screen'
    : 'absolute inset-0';

  // If reduced motion or disabled: just render a static warm gradient as a fallback.
  if (disabled || prefersReducedMotion) {
    return (
      <div
        className={`${sizingClass} -z-10 pointer-events-none ${className} bg-gradient-to-b from-stone-900 via-amber-950/10 to-zinc-900`}
        aria-hidden="true"
      />
    );
  }

  return <div ref={elRef} className={`${sizingClass} -z-10 pointer-events-none ${className}`} aria-hidden="true" />;
}
