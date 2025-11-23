// app/OMADA/[id]/VantaBg.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type VantaInstance = { destroy?: () => void } | null;
type Mode = 'eco' | 'balanced' | 'fancy';

// --- cache modules across mounts (prevents re-downloading/parsing)
let THREE_MOD: any | null = null;
let VANTA_WAVES: any | null = null;

const rIC: (cb: () => void) => void =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    // @ts-ignore
    ? (cb) => window.requestIdleCallback(cb, { timeout: 800 })
    : (cb) => setTimeout(cb, 100);

function getPreset(mode: Mode) {
  switch (mode) {
    case 'eco':
      return {
        mouseControls: false,
        touchControls: false,
        scale: 0.85,
        scaleMobile: 0.55,
        waveHeight: 8,
        waveSpeed: 0.22,
        shininess: 60,
        color: 0x111115,
        maxDpr: 0.85, // 👈 fewer pixels rendered
      };
    case 'fancy':
      return {
        mouseControls: true,
        touchControls: true,
        scale: 1.0,
        scaleMobile: 0.8,
        waveHeight: 12,
        waveSpeed: 0.45,
        shininess: 110,
        color: 0x111115,
        maxDpr: 1.5, // 👈 crisper (more pixels)
      };
    case 'balanced':
    default:
      return {
        mouseControls: false,
        touchControls: false,
        scale: 0.9,
        scaleMobile: 0.65,
        waveHeight: 10,
        waveSpeed: 0.3,
        shininess: 80,
        color: 0x111115,
        maxDpr: 1.0, // 👈 default 1x pixel density
      };
  }
}

export default function VantaBg({
  className = '',
  mode = 'eco',
  maxDpr, // 👈 optional override
  visible = true, // 👈 control visibility
}: {
  className?: string;
  mode?: Mode;
  maxDpr?: number; // e.g., 0.75 (fewer pixels) or 1.0 (1x)
  visible?: boolean;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [vanta, setVanta] = useState<VantaInstance>(null);
  const presets = useMemo(() => getPreset(mode), [mode]);

  useEffect(() => {
    let mounted = true;
    let io: IntersectionObserver | null = null;
    let cleanupVisibility: (() => void) | null = null;
    let resizeRaf = 0 as number;

    console.log('VantaBg effect triggered, visible:', visible, 'vanta:', !!vanta);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Destroy vanta instance if not visible
    if (!visible) {
      if (vanta) {
        console.log('Destroying vanta instance');
        vanta?.destroy?.();
        setVanta(null);
      }
      return;
    }

    // If visible but already initialized, do nothing
    if (vanta) return;

    const applyPixelRatioCap = (instance: any) => {
      try {
        const renderer = instance?.renderer;
        if (renderer?.setPixelRatio) {
          const cap = typeof maxDpr === 'number' ? maxDpr : presets.maxDpr;
          const dpr = Math.min(window.devicePixelRatio || 1, cap);
          renderer.setPixelRatio(dpr);
        }
      } catch {
        /* noop */
      }
    };

    const init = async () => {
      if (!mounted || !elRef.current || vanta) return;
      try {
        // lazy-load and cache modules
        if (!THREE_MOD) THREE_MOD = await import('three');
        if (!VANTA_WAVES) VANTA_WAVES = (await import('vanta/dist/vanta.waves.min')).default;

        if (!mounted || !elRef.current || vanta) return;

        const isTouch =
          'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const instance = VANTA_WAVES({
          el: elRef.current,
          THREE: THREE_MOD,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: presets.scale,
          scaleMobile: presets.scaleMobile,
          mouseControls: presets.mouseControls,
          touchControls: presets.touchControls,
          color: presets.color,
          shininess: presets.shininess,
          waveHeight: presets.waveHeight,
          waveSpeed: presets.waveSpeed * (isTouch ? 0.9 : 1),
        });

        // 🔧 Cap device pixel ratio (reduces pixels rendered)
        applyPixelRatioCap(instance);

        setVanta(instance);

        // Pause when tab is hidden; re-init on visible (cheaper than custom pause)
        const onVisibility = () => {
          if (document.visibilityState === 'hidden') {
            instance?.destroy?.();
            setVanta(null);
          } else {
            rIC(() => init());
          }
        };
        document.addEventListener('visibilitychange', onVisibility);

        // Throttle resizes; reapply DPR cap and re-init (like your original)
        const onResize = () => {
          if (resizeRaf) cancelAnimationFrame(resizeRaf);
          resizeRaf = requestAnimationFrame(() => {
            // try a quick DPR re-cap first
            applyPixelRatioCap(instance);
            // then do your destroy+reinit for full layout changes
            instance?.destroy?.();
            setVanta(null);
            rIC(() => init());
          });
        };
        window.addEventListener('resize', onResize, { passive: true });

        cleanupVisibility = () => {
          document.removeEventListener('visibilitychange', onVisibility);
          window.removeEventListener('resize', onResize);
        };
      } catch {
        // Silent: if modules missing or SSR race, just skip
      }
    };

    if (!prefersReduced) {
      // Initialize directly when visible (for toggling)
      // Use requestIdleCallback for non-blocking init
      rIC(() => {
        if (mounted && elRef.current && !vanta) {
          init();
        }
      });
    }

    return () => {
      mounted = false;
      io?.disconnect();
      cleanupVisibility?.();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      vanta?.destroy?.();
    };
    // re-run if preset, cap, or visibility changes
  }, [vanta, presets, mode, maxDpr, visible]);

  return (
    <div
      ref={elRef}
      className={className}
      aria-hidden="true"
      // CSS hints to keep composite cheap
      style={{
        contain: 'strict',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease-in-out',
      }}
    />
  );
}
