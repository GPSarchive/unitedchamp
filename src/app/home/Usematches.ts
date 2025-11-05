'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/lib/supabase/supabaseClient';

// ===================== Types =====================
export type Match = {
  id: string | number;
  title: string;
  start: string;
  end: string;
  all_day?: boolean;
  teams?: [string, string];
  logos?: [string, string];
  status?: string;
  home_score?: number;
  away_score?: number;
  score?: [number, number];
  minute?: number | string;
  team_a_score?: number;
  team_b_score?: number;
  venue?: string;
};

type CacheEntry = {
  data: Match[];
  timestamp: number;
};

// ===================== In-Memory Cache =====================
class MatchesCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache time

  set(key: string, data: Match[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  get(key: string): Match[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.TTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

// Singleton cache instance
const matchesCache = new MatchesCache();

// ===================== Data Fetching Utilities =====================

/**
 * Fetches matches from Supabase with optional date range filtering
 */
export async function fetchMatches(
  startDate?: string,
  endDate?: string
): Promise<Match[]> {
  try {
    let query = supabase
      .from('matches')
      .select(`
        *,
        team_a:teams!matches_team_a_id_fkey(name, logo),
        team_b:teams!matches_team_b_id_fkey(name, logo)
      `)
      .order('start_time', { ascending: true });

    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data) return [];

    // Transform to Match format
    return data.map((row: any) => ({
      id: row.id,
      title: row.title || `${row.team_a?.name || 'TBD'} vs ${row.team_b?.name || 'TBD'}`,
      start: row.start_time,
      end: row.end_time,
      all_day: row.all_day || false,
      teams: [row.team_a?.name || 'TBD', row.team_b?.name || 'TBD'],
      logos: [row.team_a?.logo || null, row.team_b?.logo || null],
      status: row.status,
      home_score: row.home_score,
      away_score: row.away_score,
      score: row.home_score != null && row.away_score != null 
        ? [row.home_score, row.away_score] 
        : undefined,
      minute: row.minute,
      venue: row.venue,
    }));
  } catch (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }
}

/**
 * Fetches matches for a specific team
 */
export async function fetchTeamMatches(teamName: string): Promise<Match[]> {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team_a:teams!matches_team_a_id_fkey(name, logo),
        team_b:teams!matches_team_b_id_fkey(name, logo)
      `)
      .or(`team_a.name.eq.${teamName},team_b.name.eq.${teamName}`)
      .order('start_time', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: row.title || `${row.team_a?.name || 'TBD'} vs ${row.team_b?.name || 'TBD'}`,
      start: row.start_time,
      end: row.end_time,
      teams: [row.team_a?.name || 'TBD', row.team_b?.name || 'TBD'],
      logos: [row.team_a?.logo || null, row.team_b?.logo || null],
      status: row.status,
      home_score: row.home_score,
      away_score: row.away_score,
      score: row.home_score != null && row.away_score != null 
        ? [row.home_score, row.away_score] 
        : undefined,
      venue: row.venue,
    }));
  } catch (error) {
    console.error('Error fetching team matches:', error);
    throw error;
  }
}

// ===================== React Hook =====================

type UseMatchesOptions = {
  startDate?: string;
  endDate?: string;
  teamFilter?: string;
  enableCache?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
};

type UseMatchesReturn = {
  matches: Match[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
};

/**
 * Custom hook for fetching and managing matches data with caching
 * 
 * @example
 * const { matches, loading, error, refetch } = useMatches({
 *   startDate: '2025-01-01',
 *   endDate: '2025-12-31',
 *   enableCache: true,
 * });
 */
export function useMatches(options: UseMatchesOptions = {}): UseMatchesReturn {
  const {
    startDate,
    endDate,
    teamFilter,
    enableCache = true,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute default
  } = options;

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchInProgressRef = useRef(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate cache key based on filters
  const getCacheKey = useCallback(() => {
    return `matches:${startDate || 'all'}:${endDate || 'all'}:${teamFilter || 'all'}`;
  }, [startDate, endDate, teamFilter]);

  // Fetch matches data
  const fetchData = useCallback(async (skipCache = false) => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return;
    
    const cacheKey = getCacheKey();
    
    // Try to get from cache first
    if (enableCache && !skipCache) {
      const cachedData = matchesCache.get(cacheKey);
      if (cachedData) {
        setMatches(cachedData);
        setLoading(false);
        return;
      }
    }

    fetchInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let data: Match[];
      
      if (teamFilter) {
        data = await fetchTeamMatches(teamFilter);
      } else {
        data = await fetchMatches(startDate, endDate);
      }

      // Update cache
      if (enableCache) {
        matchesCache.set(cacheKey, data);
      }

      setMatches(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch matches';
      setError(errorMessage);
      console.error('Error in useMatches:', err);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [startDate, endDate, teamFilter, enableCache, getCacheKey]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchData(true); // Skip cache on manual refetch
  }, [fetchData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey();
    matchesCache.invalidate(cacheKey);
  }, [getCacheKey]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    refreshTimerRef.current = setInterval(() => {
      fetchData(true);
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchData]);

  return {
    matches,
    loading,
    error,
    refetch,
    clearCache,
  };
}

// ===================== Server-Side Utilities =====================

/**
 * Server-side function to fetch matches (for use in Server Components or API routes)
 */
export async function getMatches(
  startDate?: string,
  endDate?: string
): Promise<Match[]> {
  return fetchMatches(startDate, endDate);
}

/**
 * Server-side function to fetch matches for a specific team
 */
export async function getTeamMatches(teamName: string): Promise<Match[]> {
  return fetchTeamMatches(teamName);
}

// Export cache for advanced use cases
export { matchesCache };