// lib/image-config.ts
/**
 * Unified image configuration for all image types
 * Supports both public CDN mode (recommended) and private signed URL mode
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BUCKET_NAME = "GPSarchive's Project";

// 🎯 TOGGLE THIS: Set to true if your bucket is public (RECOMMENDED for best performance)
export const USE_PUBLIC_BUCKET =true;

// Optional: Your Cloudflare CDN domain (e.g., "images.yoursite.com")
const CDN_DOMAIN = process.env.NEXT_PUBLIC_CDN_DOMAIN || null;

/**
 * Image categories for better organization
 */
export enum ImageType {
  PLAYER = "player",
  TEAM = "team", 
  TOURNAMENT = "tournament",
}

/**
 * Type guard: Check if value is a storage path (not a full URL)
 */
export function isStoragePath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("/") && !value.startsWith("//")) {
    // Allow relative paths like "/players/photo.jpg" but not protocol-relative "//"
    return true;
  }
  return value.trim().length > 0;
}

/**
 * Resolve image URL based on mode
 * 
 * PUBLIC MODE: Returns direct Supabase/CDN URL (cached by browser & Cloudflare)
 * PRIVATE MODE: Returns path to be signed by client component
 */
export function resolveImageUrl(
  path: string | null | undefined,
  type: ImageType = ImageType.PLAYER
): string | null {
  if (!path) return null;
  
  // Already a full URL - return as-is
  if (!isStoragePath(path)) return path;
  
  // Clean up path
  const cleanPath = path.replace(/^\/+/, "");
  
  if (USE_PUBLIC_BUCKET) {
    // PUBLIC MODE: Direct URL (best performance)
    if (CDN_DOMAIN) {
      // Use CDN domain if configured
      return `https://${CDN_DOMAIN}/${cleanPath}`;
    } else {
      // Use Supabase public URL
      const base = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public`;
      return `${base}/${encodeURIComponent(BUCKET_NAME)}/${cleanPath}`;
    }
  } else {
    // PRIVATE MODE: Return path for client-side signing
    return cleanPath;
  }
}

/**
 * Placeholders for each image type
 */
export const IMAGE_PLACEHOLDERS = {
  [ImageType.PLAYER]: "/player-placeholder.jpg",
  [ImageType.TEAM]: "/team-placeholder.png",
  [ImageType.TOURNAMENT]: "/tournament-placeholder.png",
} as const;

/**
 * Get placeholder for image type
 */
export function getPlaceholder(type: ImageType): string {
  return IMAGE_PLACEHOLDERS[type];
}

/**
 * Configuration object for easy access
 */
export const imageConfig = {
  bucketName: BUCKET_NAME,
  usePublic: USE_PUBLIC_BUCKET,
  cdnDomain: CDN_DOMAIN,
  supabaseUrl: SUPABASE_URL,
  resolve: resolveImageUrl,
  isStoragePath,
  getPlaceholder,
} as const;