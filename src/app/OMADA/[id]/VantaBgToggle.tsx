'use client';

import { useState, useEffect } from 'react';
import VantaBg from '@/app/lib/VantaBg';
import { EyeOff, Eye } from 'lucide-react';

export default function VantaBgToggle({
  className = '',
  mode = 'eco',
}: {
  className?: string;
  mode?: 'eco' | 'balanced' | 'fancy';
}) {
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('vantaBgEnabled');
    if (saved !== null) {
      setEffectsEnabled(saved === 'true');
    }
    setMounted(true);
  }, []);

  // Save preference to localStorage when changed
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('vantaBgEnabled', String(effectsEnabled));
    }
  }, [effectsEnabled, mounted]);

  const toggleEffects = () => {
    setEffectsEnabled((prev) => !prev);
  };

  return (
    <>
      {/* Vanta background - only render when enabled */}
      {effectsEnabled && <VantaBg className={className} mode={mode} />}

      {/* Toggle button - fixed position in bottom right */}
      <button
        onClick={toggleEffects}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2
                   bg-slate-800/80 hover:bg-slate-700/80 text-slate-200
                   rounded-lg shadow-lg backdrop-blur-sm border border-slate-600/50
                   transition-all duration-200 hover:scale-105"
        title={effectsEnabled ? 'Disable background effects' : 'Enable background effects'}
        aria-label={effectsEnabled ? 'Disable background effects' : 'Enable background effects'}
      >
        {effectsEnabled ? (
          <>
            <EyeOff className="w-4 h-4" />
            <span className="text-sm font-medium">Disable Effects</span>
          </>
        ) : (
          <>
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Enable Effects</span>
          </>
        )}
      </button>
    </>
  );
}
