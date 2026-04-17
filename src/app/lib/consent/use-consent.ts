"use client";

/**
 * Cookie-consent hook and shared helpers.
 *
 * Single source of truth for the site's GDPR / ePrivacy consent state.
 *
 * Any component that loads or embeds third-party scripts, iframes, pixels,
 * or otherwise sets non-essential cookies MUST read `state.analytics` via
 * this hook (or its context) and gate their output accordingly.
 *
 * Storage: localStorage key `uc_consent_v1`. Bump the version if the
 * categories or semantics ever change — that forces a fresh prompt.
 */

import { useContext } from "react";
import { ConsentContext, type ConsentApi } from "./ConsentContext";

export const CONSENT_STORAGE_KEY = "uc_consent_v1";
export const CONSENT_VERSION = 1;
export const CONSENT_EVENT = "uc:consent-change";
export const CONSENT_REOPEN_EVENT = "uc:consent-reopen";

export type ConsentState = {
  essential: true;
  analytics: boolean;
  decided: boolean;
  ts: number;
  version: number;
};

export const DEFAULT_CONSENT: ConsentState = {
  essential: true,
  analytics: false,
  decided: false,
  ts: 0,
  version: CONSENT_VERSION,
};

export function readConsentFromStorage(): ConsentState {
  if (typeof window === "undefined") return DEFAULT_CONSENT;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return DEFAULT_CONSENT;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return DEFAULT_CONSENT;
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      decided: Boolean(parsed.decided),
      ts: typeof parsed.ts === "number" ? parsed.ts : 0,
      version: CONSENT_VERSION,
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function writeConsentToStorage(next: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    // Mirror to a first-party cookie for potential SSR/edge reads.
    const maxAge = 60 * 60 * 24 * 180; // 180 days
    const value = next.analytics ? "analytics" : "essential";
    document.cookie = `uc_consent=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: next }));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/**
 * Open the consent banner/settings panel from anywhere in the app
 * (e.g. a Footer button or a link inside a Markdown body).
 */
export function openConsentBanner() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}

export function useConsent(): ConsentApi {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    // Fail-safe: return a read-only default so tree-less unit tests don't crash.
    return {
      state: DEFAULT_CONSENT,
      ready: false,
      accept: () => {},
      setAnalytics: () => {},
      reopen: () => {},
    };
  }
  return ctx;
}
