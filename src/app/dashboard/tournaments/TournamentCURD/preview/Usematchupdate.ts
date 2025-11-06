// app/dashboard/tournaments/TournamentCURD/submit/hooks/useMatchUpdate.ts
"use client";

import { useState, useCallback } from "react";
import { updateMatchFromPlanner, type MatchUpdatePayload } from "./updateMatchAction";

export interface UseMatchUpdateOptions {
  onSuccess?: (matchId: number) => void;
  onError?: (error: string, matchId: number) => void;
}

export function useMatchUpdate(options?: UseMatchUpdateOptions) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMatch = useCallback(async (payload: MatchUpdatePayload) => {
    setIsUpdating(true);
    setError(null);

    try {
      const result = await updateMatchFromPlanner(payload);
      
      if (result.success) {
        options?.onSuccess?.(payload.matchId);
        return true;
      } else {
        const errorMsg = result.error || "Update failed";
        setError(errorMsg);
        options?.onError?.(errorMsg, payload.matchId);
        return false;
      }
    } catch (err: any) {
      const errorMsg = err.message || "Network error";
      setError(errorMsg);
      options?.onError?.(errorMsg, payload.matchId);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [options]);

  const clearError = useCallback(() => setError(null), []);

  return {
    updateMatch,
    isUpdating,
    error,
    clearError,
  };
}