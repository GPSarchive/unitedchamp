// lib/signTournamentLogos.ts
// Reusable utility for signing tournament logos server-side

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

const TOURNAMENT_BUCKET = "GPSarchive's Project";
const SIGN_TTL_SECONDS = 60 * 5;

/** Type guard: είναι storage key (σχετική διαδρομή) κι όχι πλήρες URL */
function isStorageKey(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (/^(https?:)?\/\//i.test(v)) return false; // absolute URL
  if (v.startsWith("data:")) return false; // data URL
  return v.trim().length > 0;
}

/**
 * Sign tournament logos (handles paths with leading slashes like TournamentBasicsForm)
 * 
 * @param tournaments - Array of tournaments with logo field
 * @returns Tournaments with signed logo URLs
 * 
 * @example
 * ```typescript
 * const tournaments = await fetchTournaments();
 * const withSignedLogos = await signTournamentLogos(tournaments);
 * ```
 */
export async function signTournamentLogos<T extends { logo?: string | null }>(
  tournaments: T[]
): Promise<T[]> {
  // Collect all storage keys (strip leading slashes)
  const logoKeys: string[] = tournaments
    .map(t => t.logo)
    .filter(isStorageKey)
    .map(logo => logo.replace(/^\/+/, "")); // Strip leading slashes

  if (logoKeys.length === 0) {
    // No logos to sign, return tournaments as-is
    return tournaments;
  }

  // Get signed URLs
  const unique = Array.from(new Set(logoKeys));
  const { data, error } = await supabaseAdmin.storage
    .from(TOURNAMENT_BUCKET)
    .createSignedUrls(unique, SIGN_TTL_SECONDS);

  if (error || !data) {
    console.error("Failed to sign tournament logos:", error);
    return tournaments; // Return tournaments without signed URLs
  }

  // Create map of original paths (with or without /) to signed URLs
  const signedMap = new Map<string, string>();
  tournaments.forEach((t) => {
    if (isStorageKey(t.logo)) {
      const cleanKey = t.logo.replace(/^\/+/, "");
      const idx = unique.indexOf(cleanKey);
      if (idx >= 0 && data[idx]?.signedUrl) {
        signedMap.set(t.logo, data[idx].signedUrl);
        signedMap.set(cleanKey, data[idx].signedUrl); // Also map cleaned version
      }
    }
  });

  // Return tournaments with signed URLs
  return tournaments.map(t => ({
    ...t,
    logo: isStorageKey(t.logo) 
      ? signedMap.get(t.logo) ?? t.logo // Use signed URL or keep original
      : t.logo // Keep absolute URLs as-is
  }));
}

/**
 * Sign a single tournament logo
 * 
 * @param logo - Tournament logo path or URL
 * @returns Signed URL or original value
 * 
 * @example
 * ```typescript
 * const signedUrl = await signSingleTournamentLogo('/leagues/my-league/logos/abc.jpg');
 * ```
 */
export async function signSingleTournamentLogo(
  logo: string | null | undefined
): Promise<string | null> {
  if (!logo) return null;
  if (!isStorageKey(logo)) return logo; // Return absolute URLs as-is

  const cleanKey = logo.replace(/^\/+/, "");
  
  const { data, error } = await supabaseAdmin.storage
    .from(TOURNAMENT_BUCKET)
    .createSignedUrl(cleanKey, SIGN_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("Failed to sign tournament logo:", error);
    return logo; // Return original on error
  }

  return data.signedUrl;
}