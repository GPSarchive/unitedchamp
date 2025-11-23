'use client';

import { useState, useEffect } from 'react';
import VantaBg from '@/app/lib/VantaBg';
import { EyeOff, Eye } from 'lucide-react';

export default function VantaBgToggle({
  className = '',
  mode = 'eco',
  buttonPosition = 'bottom',
}: {
  className?: string;
  mode?: 'eco' | 'balanced' | 'fancy';
  buttonPosition?: 'top' | 'bottom';
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

  // Position classes based on buttonPosition prop
  const positionClasses = buttonPosition === 'top'
    ? 'top-6 right-6'
    : 'bottom-6 right-6';

  return (
    <>
      {/* Vanta background - only render when enabled */}
      {effectsEnabled ? (
        <VantaBg className={className} mode={mode} />
      ) : (
        /* Fallback background: faded black with a pinch of orange */
        <div
          className={className}
          style={{
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1410 50%, #0a0a0a 100%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Toggle button - position based on prop */}
      <button
        onClick={toggleEffects}
        className={`fixed ${positionClasses} z-50 flex items-center gap-2 px-4 py-2
                   bg-slate-800/80 hover:bg-slate-700/80 text-slate-200
                   rounded-lg shadow-lg backdrop-blur-sm border border-slate-600/50
                   transition-all duration-200 hover:scale-105`}
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
