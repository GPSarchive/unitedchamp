// utils/images.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * If src is already an http(s) URL, return as-is.
 * If null/empty, fall back to a placeholder.
 */
export function safeImageSrc(src?: string | null, fallback = "/placeholder.png") {
  if (!src || src.trim() === "") return fallback;
  if (/^https?:\/\//i.test(src)) return src;
  return src; // might be a local /public path like '/logos/x.png'
}

/**
 * Parse a storage path. Supports:
 *  - "bucket:path/to/file.png"
 *  - "bucket/path/to/file.png"
 *  - "storage://bucket/path/to/file.png"
 */
export function parseStoragePath(path: string) {
  let p = path.trim().replace(/^storage:\/\//, "");
  const m = p.match(/^([^/:]+)[:/](.+)$/);
  if (!m) return null;
  return { bucket: m[1], path: m[2] };
}

/**
 * Create a signed URL for a Supabase Storage object if the string looks like a storage path.
 * Use ONLY on the server (RSC/API/actions).
 */
export async function ensureSignedUrl(
  supabase: SupabaseClient,
  src: string | null | undefined,
  expiresInSec = 3600
): Promise<string> {
  const s = safeImageSrc(src);
  if (!s) return "/placeholder.png";
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s;

  const parsed = parseStoragePath(s);
  if (!parsed) return s; // not a storage path; assume static

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresInSec);

  if (error || !data?.signedUrl) return "/placeholder.png";
  return data.signedUrl;
}

/** Convenience wrappers */
export const teamLogoSrc = (logo?: string | null) => safeImageSrc(logo);
export const tournamentLogoSrc = (logo?: string | null) => safeImageSrc(logo);
