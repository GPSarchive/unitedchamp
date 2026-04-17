"use client";

import { openConsentBanner } from "@/app/lib/consent/use-consent";

export default function OpenConsentSettingsButton() {
  return (
    <button
      type="button"
      onClick={openConsentBanner}
      className="inline-flex items-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-bold text-black hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20"
    >
      Άνοιγμα ρυθμίσεων cookies
    </button>
  );
}
