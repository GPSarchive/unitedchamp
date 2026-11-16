"use client";

import { openConsentBanner } from "@/app/lib/consent/use-consent";

export default function OpenConsentSettingsButton() {
  return (
    <button
      type="button"
      onClick={openConsentBanner}
      className="inline-flex items-center rounded-lg bg-[#fb923c] px-4 py-2 text-sm font-bold text-black hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      Άνοιγμα ρυθμίσεων cookies
    </button>
  );
}
