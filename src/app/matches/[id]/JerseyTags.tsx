"use client";

// ---------------------------------------------------------------------------
// Temporary jersey numbers (νούμερο φανέλας) for the admin stats form.
//
// A scratch aid so admins can tell players apart on the pitch without asking
// names: tick Συμμετοχή, type the shirt number, then find people by it. It is
// NEVER submitted (the inputs have no `name`) and never reaches the database —
// it lives in localStorage on this device only, per match.
//
// Kept in its own key, separate from the StatsDraftAutosave draft, so the
// numbers survive "Save all" (which clears the draft) for later corrections.
// ---------------------------------------------------------------------------

import * as React from "react";

type Stored = { v: 1; updatedAt: number; tags: Record<string, string> };

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const storageKey = (matchId: number) => `unitedchamp:jersey-tags:v1:${matchId}`;

interface JerseyTagsValue {
  /** Keyed `${teamId}:${playerId}` — a player can be on both rosters. */
  tags: Record<string, string>;
  setTag: (teamId: number, playerId: number, value: string) => void;
}

const JerseyTagsContext = React.createContext<JerseyTagsValue | null>(null);

export function useJerseyTags(): JerseyTagsValue | null {
  return React.useContext(JerseyTagsContext);
}

export function JerseyTagsProvider({
  matchId,
  children,
}: {
  matchId: number;
  children: React.ReactNode;
}) {
  const key = storageKey(matchId);
  const [tags, setTags] = React.useState<Record<string, string>>({});

  // Load after mount — the server render has no access to localStorage.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Stored) : null;
      if (parsed?.v === 1 && parsed.tags && Date.now() - parsed.updatedAt <= MAX_AGE_MS) {
        setTags(parsed.tags);
      } else if (raw) {
        localStorage.removeItem(key);
      }
    } catch {}
  }, [key]);

  const setTag = React.useCallback((teamId: number, playerId: number, value: string) => {
    setTags((prev) => {
      const next = { ...prev };
      const k = `${teamId}:${playerId}`;
      if (value) next[k] = value;
      else delete next[k];
      // Persisted here rather than in an effect, so the initial empty state can
      // never overwrite the stored numbers before they load. Idempotent.
      try {
        if (Object.keys(next).length === 0) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify({ v: 1, updatedAt: Date.now(), tags: next } satisfies Stored));
      } catch {}
      return next;
    });
  }, [key]);

  const value = React.useMemo(() => ({ tags, setTag }), [tags, setTag]);
  return <JerseyTagsContext.Provider value={value}>{children}</JerseyTagsContext.Provider>;
}
