"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export const BUCKET = "GPSarchive's Project";

// OPTIMIZATION 1: Persistent cache using localStorage
const CACHE_KEY_PREFIX = "signed_url_cache_";
const CACHE_DURATION = 55 * 60 * 1000; // 55 minutes (5 min buffer before expiry)

interface CacheEntry {
  url: string;
  expires: number;
}

// Memory cache for fast access within session
const __memoryCache = new Map<string, string>();

// Pending requests to prevent duplicate fetches
const __pendingRequests = new Map<string, Promise<string | null>>();

function getCacheKey(bucket: string, path: string): string {
  return `${CACHE_KEY_PREFIX}${bucket}:${path}`;
}

function getFromCache(bucket: string, path: string): string | null {
  // Check memory first (fastest)
  const memKey = `${bucket}:${path}`;
  if (__memoryCache.has(memKey)) {
    return __memoryCache.get(memKey)!;
  }

  // Check localStorage
  if (typeof window === "undefined") return null;
  
  try {
    const cacheKey = getCacheKey(bucket, path);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    
    // Check if expired
    if (Date.now() > entry.expires) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Store in memory for faster subsequent access
    __memoryCache.set(memKey, entry.url);
    return entry.url;
  } catch {
    return null;
  }
}

function saveToCache(bucket: string, path: string, url: string): void {
  const memKey = `${bucket}:${path}`;
  __memoryCache.set(memKey, url);

  if (typeof window === "undefined") return;

  try {
    const cacheKey = getCacheKey(bucket, path);
    const entry: CacheEntry = {
      url,
      expires: Date.now() + CACHE_DURATION,
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (e) {
    // localStorage might be full or disabled - fail gracefully
    console.warn("Failed to cache signed URL:", e);
  }
}

// Clean up expired entries periodically
// Managed via hook to ensure proper cleanup
let __cleanupIntervalId: NodeJS.Timeout | null = null;

function startCacheCleanup() {
  if (typeof window === "undefined" || __cleanupIntervalId !== null) return;

  __cleanupIntervalId = setInterval(() => {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          const cached = localStorage.getItem(key);
          if (cached) {
            const entry: CacheEntry = JSON.parse(cached);
            if (Date.now() > entry.expires) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch {}
  }, 10 * 60 * 1000); // Every 10 minutes
}

function stopCacheCleanup() {
  if (__cleanupIntervalId !== null) {
    clearInterval(__cleanupIntervalId);
    __cleanupIntervalId = null;
  }
}

export function isStoragePath(v: string | null | undefined) {
  if (!v) return false;
  if (/^(https?:)?\/\//i.test(v)) return false;
  if (v.startsWith("/")) return false;
  if (v.startsWith("data:")) return false;
  return true;
}

export function useSignedUrl(pathOrUrl: string | null | undefined, bucket = BUCKET) {
  const [url, setUrl] = useState<string | null>(() => {
    // Try to get from cache immediately on mount
    if (pathOrUrl && isStoragePath(pathOrUrl)) {
      return getFromCache(bucket, pathOrUrl);
    }
    return pathOrUrl ?? null;
  });

  // Start cache cleanup on first mount (globally shared)
  useEffect(() => {
    startCacheCleanup();
    return () => {
      // Cleanup is shared across all instances, so we don't stop it here
      // It will be cleaned up when the page unmounts
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        if (!pathOrUrl) {
          if (!ignore) setUrl(null);
          return;
        }

        if (!isStoragePath(pathOrUrl)) {
          if (!ignore) setUrl(pathOrUrl);
          return;
        }

        // Check cache first
        const cached = getFromCache(bucket, pathOrUrl);
        if (cached) {
          if (!ignore) setUrl(cached);
          return;
        }

        // Check for pending request
        const key = `${bucket}:${pathOrUrl}`;
        let promise = __pendingRequests.get(key);

        if (!promise) {
          // Create new request
          promise = fetch(
            `/api/storage/tournament-img-loader/sign?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(pathOrUrl)}`,
            {
              credentials: "include",
              // Add cache header for browser caching
              headers: { "Cache-Control": "public, max-age=3300" } // 55 minutes
            }
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
              const signed = j?.signedUrl ?? null;
              if (signed) {
                saveToCache(bucket, pathOrUrl, signed);
              }
              return signed;
            })
            .catch(() => null)
            .finally(() => {
              __pendingRequests.delete(key);
            });

          __pendingRequests.set(key, promise);
        }

        const signed = await promise;
        if (!ignore) setUrl(signed);
      } catch {
        if (!ignore) setUrl(null);
      }
    }

    run();

    return () => {
      ignore = true;
    };
  }, [pathOrUrl, bucket]);

  return url;
}

export default function SignedImg({
  src,
  alt,
  className,
  bucket = BUCKET,
  width,
  height,
  sizes,
  style,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  bucket?: string;
  width?: number;
  height?: number;
  sizes?: string;
  style?: React.CSSProperties;
}) {
  const url = useSignedUrl(src ?? null, bucket);

  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [url]);

  const reduceMotion = useReducedMotion();

  if (!url) {
    return (
      <div
        className={className}
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 8,
          ...(style || {}),
        }}
        aria-label="image placeholder"
      />
    );
  }

  return (
    <motion.img
      key={url}
      src={url}
      alt={alt}
      className={className}
      width={width}
      height={height}
      sizes={sizes}
      style={style}
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 6 }}
      animate={
        reduceMotion
          ? { opacity: 1 }
          : loaded
          ? { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0.6 }
      }
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      draggable={false}
    />
  );
}