'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useMatches, Match } from './useMatches';

// ===================== Types =====================
type MatchesContextType = {
  matches: Match[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
};

// ===================== Context =====================
const MatchesContext = createContext<MatchesContextType | null>(null);

// ===================== Provider Props =====================
type MatchesProviderProps = {
  children: ReactNode;
  initialMatches?: Match[];
  enableCache?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
};

// ===================== Provider Component =====================
export function MatchesProvider({
  children,
  initialMatches = [],
  enableCache = true,
  autoRefresh = false,
  refreshInterval = 60000,
}: MatchesProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  
  const matchesData = useMatches({
    enableCache,
    autoRefresh,
    refreshInterval,
  });

  // Use initial matches on first render if provided
  useEffect(() => {
    if (initialMatches.length > 0 && !isInitialized && matchesData.matches.length === 0) {
      // This is a bit hacky, but we can set initial state here
      // The hook will overwrite if it fetches new data
      setIsInitialized(true);
    }
  }, [initialMatches, isInitialized, matchesData.matches]);

  const value: MatchesContextType = {
    matches: matchesData.matches.length > 0 ? matchesData.matches : initialMatches,
    loading: matchesData.loading,
    error: matchesData.error,
    refetch: matchesData.refetch,
    clearCache: matchesData.clearCache,
  };

  return (
    <MatchesContext.Provider value={value}>
      {children}
    </MatchesContext.Provider>
  );
}

// ===================== Custom Hook =====================
/**
 * Hook to access matches context
 * Must be used within MatchesProvider
 * 
 * @example
 * const { matches, loading, refetch } = useMatchesContext();
 */
export function useMatchesContext(): MatchesContextType {
  const context = useContext(MatchesContext);
  
  if (!context) {
    throw new Error(
      'useMatchesContext must be used within a MatchesProvider. ' +
      'Wrap your component tree with <MatchesProvider>.'
    );
  }
  
  return context;
}

// ===================== Optional: Higher-Order Component =====================
/**
 * HOC to wrap component with matches context
 * 
 * @example
 * export default withMatches(MyComponent);
 */
export function withMatches<P extends object>(
  Component: React.ComponentType<P & MatchesContextType>
) {
  return function WithMatchesWrapper(props: P) {
    const matchesContext = useMatchesContext();
    
    return <Component {...props} {...matchesContext} />;
  };
}