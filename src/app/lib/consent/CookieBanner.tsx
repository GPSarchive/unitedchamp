"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useConsent } from "./use-consent";
import { CONSENT_REOPEN_EVENT } from "./use-consent";

export default function CookieBanner() {
  const { state, ready, accept, setAnalytics } = useConsent();
  const [expanded, setExpanded] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  // Local draft for the granular toggle — only persisted when the user hits Save.
  const [draftAnalytics, setDraftAnalytics] = useState<boolean>(state.analytics);

  useEffect(() => {
    function onReopen() {
      setForceOpen(true);
      setExpanded(true);
      setDraftAnalytics(state.analytics);
    }
    window.addEventListener(CONSENT_REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, onReopen);
  }, [state.analytics]);

  // Keep the draft in sync if the underlying state changes while the panel is closed.
  useEffect(() => {
    if (!expanded) setDraftAnalytics(state.analytics);
  }, [state.analytics, expanded]);

  if (!ready) return null;
  const visible = forceOpen || !state.decided;
  if (!visible) return null;

  function close() {
    setForceOpen(false);
    setExpanded(false);
  }

  function handleAcceptAll() {
    accept("all");
    close();
  }

  function handleRejectAll() {
    accept("essential");
    close();
  }

  function handleSave() {
    setAnalytics(draftAnalytics);
    close();
  }

  return (
    <AnimatePresence>
      <motion.div
        key="cookie-banner"
        role="dialog"
        aria-live="polite"
        aria-label="Ρυθμίσεις Cookies"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="fixed z-[100] bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl p-5 sm:p-6 text-white"
      >
        {!expanded ? (
          <div>
            <h2 className="text-base sm:text-lg font-bold text-orange-400 mb-2">
              Χρήση Cookies
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Χρησιμοποιούμε απαραίτητα cookies για τη λειτουργία της πλατφόρμας
              και, με τη συγκατάθεσή σας, αναλυτικά cookies (Vercel Analytics)
              και ενσωματώσεις YouTube. Περισσότερα στην{" "}
              <Link
                href="/privacy"
                className="text-orange-400 underline hover:text-orange-300"
              >
                Πολιτική Απορρήτου
              </Link>{" "}
              και στη σελίδα{" "}
              <Link
                href="/cookies"
                className="text-orange-400 underline hover:text-orange-300"
              >
                Cookies
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-bold text-black hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20"
              >
                Αποδοχή όλων
              </button>
              <button
                type="button"
                onClick={handleRejectAll}
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Απόρριψη
              </button>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
              >
                Ρυθμίσεις
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-base sm:text-lg font-bold text-orange-400 mb-1">
              Ρυθμίσεις Cookies
            </h2>
            <p className="text-xs text-white/60 leading-relaxed">
              Μπορείτε να αλλάξετε τις προτιμήσεις σας οποιαδήποτε στιγμή από το
              footer της σελίδας.
            </p>

            <div className="mt-4 space-y-3">
              {/* Essential row — always on */}
              <div className="flex items-start justify-between gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Απαραίτητα
                  </p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Πιστοποίηση ταυτότητας (Supabase), ασφάλεια, αποθήκευση
                    επιλογών σας. Δεν απενεργοποιούνται.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-white/60 shrink-0">
                  Πάντα ενεργά
                </span>
              </div>

              {/* Analytics row */}
              <label className="flex items-start justify-between gap-3 rounded-xl bg-white/5 border border-white/10 p-3 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Αναλυτικά & ενσωματώσεις
                  </p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Ανώνυμα δεδομένα χρήσης (Vercel Analytics, Speed Insights)
                    και ενσωματώσεις YouTube στην αρχική σελίδα.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={draftAnalytics}
                  onChange={(e) => setDraftAnalytics(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-orange-400 shrink-0"
                  aria-label="Ενεργοποίηση αναλυτικών cookies"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Αποδοχή όλων
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-bold text-black hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20"
              >
                Αποθήκευση
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
