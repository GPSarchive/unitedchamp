// app/lib/images.ts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PLAYER_BUCKET =
  process.env.NEXT_PUBLIC_PLAYER_PHOTO_BUCKET || "GPSarchive's Project";
const PLAYER_PUBLIC = process.env.NEXT_PUBLIC_PLAYER_PHOTO_PUBLIC === "true"; // true if bucket is public

export function resolvePlayerPhotoUrl(input?: string | null): string {
  const fallback = "/player-placeholder.jpg";
  if (!input) return fallback;

  // Already absolute URL?
  if (/^https?:\/\//i.test(input)) return input;

  // Public folder path?
  if (input.startsWith("/")) return input;

  // Storage path
  const path = input.replace(/^\/+/, "");

  if (PLAYER_PUBLIC) {
    // Public bucket mode → direct Supabase public URL
    const base = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public`;
    return `${base}/${encodeURIComponent(PLAYER_BUCKET)}/${path}`;
  }

  // Private bucket mode → same-origin proxy (THIS matches your route)
  return `/api/storage/player-img?path=${encodeURIComponent(path)}`;
}
