"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConsentContext, type ConsentApi } from "./ConsentContext";
import {
  CONSENT_EVENT,
  CONSENT_REOPEN_EVENT,
  CONSENT_VERSION,
  DEFAULT_CONSENT,
  readConsentFromStorage,
  writeConsentToStorage,
  type ConsentState,
} from "./use-consent";

export default function ConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ConsentState>(DEFAULT_CONSENT);
  const [ready, setReady] = useState(false);
  // Tracks explicit reopen (e.g. footer "Cookie settings" button). The banner
  // reads this via its own CONSENT_REOPEN_EVENT listener; the provider only
  // needs to fire the event, not track it.
  const firstMount = useRef(true);

  // Hydrate from storage after mount — avoids SSR/localStorage mismatch.
  useEffect(() => {
    setState(readConsentFromStorage());
    setReady(true);

    function onChange(e: Event) {
      const ce = e as CustomEvent<ConsentState>;
      if (ce.detail && typeof ce.detail === "object") {
        setState(ce.detail);
      } else {
        setState(readConsentFromStorage());
      }
    }

    window.addEventListener(CONSENT_EVENT, onChange);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onChange);
    };
  }, []);

  const accept = useCallback((kind: "all" | "essential") => {
    const next: ConsentState = {
      essential: true,
      analytics: kind === "all",
      decided: true,
      ts: Date.now(),
      version: CONSENT_VERSION,
    };
    writeConsentToStorage(next);
    setState(next);
  }, []);

  const setAnalytics = useCallback((on: boolean) => {
    const next: ConsentState = {
      essential: true,
      analytics: on,
      decided: true,
      ts: Date.now(),
      version: CONSENT_VERSION,
    };
    writeConsentToStorage(next);
    setState(next);
  }, []);

  const reopen = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
    }
  }, []);

  // Keep reference-stable firstMount flag — helpful if we ever add effects.
  useEffect(() => {
    firstMount.current = false;
  }, []);

  const value = useMemo<ConsentApi>(
    () => ({ state, ready, accept, setAnalytics, reopen }),
    [state, ready, accept, setAnalytics, reopen]
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}
