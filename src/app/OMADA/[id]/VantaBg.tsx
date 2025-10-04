// app/OMADA/[id]/VantaBg.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type VantaInstance = { destroy?: () => void } | null;

export default function VantaBg({ className = '' }: { className?: string }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [vanta, setVanta] = useState<VantaInstance>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Import from node_modules
        const THREE = await import('three'); // module object
        const WAVES = (await import('vanta/dist/vanta.waves.min')).default;

        if (!mounted || !elRef.current || vanta) return;

        const instance = WAVES({
          el: elRef.current,
          THREE, // pass the module object
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0x111115,
          shininess: 150.0,
          waveHeight: 12.0,
        });

        setVanta(instance);
      } catch (err) {
        console.error('Vanta load error', err);
      }
    })();

    return () => {
      mounted = false;
      vanta?.destroy?.();
    };
  }, [vanta]);

  return <div ref={elRef} className={className} aria-hidden="true" />;
}
