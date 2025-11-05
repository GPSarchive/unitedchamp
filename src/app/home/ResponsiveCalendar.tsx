'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Lazy load calendar components
const Calendar = dynamic(() => import('./Calendar'), { ssr: false });
const EnhancedMobileCalendar = dynamic(() => import('./EnhancedMobileCalendar'), { ssr: false });

type Match = {
  id: string | number;
  title: string;
  start: string;
  end: string;
  all_day?: boolean;
  teams?: [string, string];
  logos?: [string, string];
  status?: 'scheduled' | 'live' | 'finished';
  home_score?: number;
  away_score?: number;
  score?: [number, number];
  minute?: number | string;
  team_a_score?: number;
  team_b_score?: number;
};

type ResponsiveCalendarProps = {
  matches: Match[];
  className?: string;
  height?: number | 'auto';
  highlightTeams?: string[];
  fetchFromDb?: boolean;
};

export default function ResponsiveCalendar({
  matches,
  className = '',
  height = 'auto',
  highlightTeams = [],
  fetchFromDb = false,
}: ResponsiveCalendarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      console.log('[ResponsiveCalendar] Width:', window.innerWidth, 'isMobile:', mobile);
      setIsMobile(mobile);
    };
    
    checkMobile();
    
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkMobile, 150);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const mobileEvents = useMemo(
    () => matches.map(m => ({ ...m, id: String(m.id) })),
    [matches]
  );

  // Debug log
  useEffect(() => {
    console.log('[ResponsiveCalendar] Render state:', {
      isClient,
      isMobile,
      matchCount: matches.length,
      willRender: isClient ? (isMobile ? 'Mobile' : 'Desktop') : 'Loading'
    });
  }, [isClient, isMobile, matches.length]);
  
  if (!isClient) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] bg-zinc-950 rounded-xl ${className}`}>
        <div className="animate-pulse text-white/50">Loading calendar...</div>
      </div>
    );
  }

  console.log('[ResponsiveCalendar] Rendering:', isMobile ? 'MOBILE' : 'DESKTOP');

  return isMobile ? (
    <div>
      <div className="text-xs text-white/50 mb-2">Rendering: Mobile Calendar</div>
      <EnhancedMobileCalendar
        initialEvents={mobileEvents}
        className={className}
        highlightTeams={highlightTeams}
      />
    </div>
  ) : (
    <div>
      <div className="text-xs text-white/50 mb-2 bg-red-500/20 p-2 rounded">
        Rendering: Desktop Calendar | Matches: {matches.length}
      </div>
      <Calendar
        initialEvents={matches}
        className={className}
        height={height}
        fetchFromDb={fetchFromDb}
      />
    </div>
  );
}