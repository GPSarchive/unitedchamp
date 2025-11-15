// components/OptimizedImage.tsx (OPTIMIZED - React.memo)
"use client";

import { useEffect, useState, memo } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { 
  imageConfig, 
  ImageType, 
  isStoragePath,
  getPlaceholder 
} from "./image-config";

// ============================================================================
// PRIVATE MODE: Client-side signing with localStorage cache
// ============================================================================

const CACHE_KEY_PREFIX = "img_cache_";
const CACHE_DURATION = 55 * 60 * 1000; // 55 minutes

interface CacheEntry {
  url: string;
  expires: number;
}

// In-memory cache for session
const memoryCache = new Map<string, string>();

// Pending requests to prevent duplicate fetches
const pendingRequests = new Map<string, Promise<string | null>>();

function getCacheKey(path: string): string {
  return `${CACHE_KEY_PREFIX}${imageConfig.bucketName}:${path}`;
}

function getFromCache(path: string): string | null {
  // Check memory first (fastest)
  if (memoryCache.has(path)) {
    return memoryCache.get(path)!;
  }

  // Check localStorage
  if (typeof window === "undefined") return null;
  
  try {
    const cacheKey = getCacheKey(path);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    
    // Check if expired
    if (Date.now() > entry.expires) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Store in memory for faster subsequent access
    memoryCache.set(path, entry.url);
    return entry.url;
  } catch {
    return null;
  }
}

function saveToCache(path: string, url: string): void {
  memoryCache.set(path, url);

  if (typeof window === "undefined") return;

  try {
    const cacheKey = getCacheKey(path);
    const entry: CacheEntry = {
      url,
      expires: Date.now() + CACHE_DURATION,
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (e) {
    console.warn("Failed to cache image URL:", e);
  }
}

// Clean up expired entries periodically
if (typeof window !== "undefined") {
  setInterval(() => {
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

async function fetchSignedUrl(path: string): Promise<string | null> {
  // Check for pending request
  if (pendingRequests.has(path)) {
    return pendingRequests.get(path)!;
  }

  // Create new request
  const promise = fetch(
    `/api/storage/sign?bucket=${encodeURIComponent(imageConfig.bucketName)}&path=${encodeURIComponent(path)}`,
    { 
      credentials: "include",
      headers: { "Cache-Control": "public, max-age=3300" }
    }
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const signed = j?.signedUrl ?? null;
      if (signed) {
        saveToCache(path, signed);
      }
      return signed;
    })
    .catch(() => null)
    .finally(() => {
      pendingRequests.delete(path);
    });
  
  pendingRequests.set(path, promise);
  return promise;
}

// ============================================================================
// Hook: Get image URL (public or signed)
// ============================================================================

function useImageUrl(
  src: string | null | undefined,
  type: ImageType
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!src) return getPlaceholder(type);
    
    // PUBLIC MODE: Return direct URL immediately
    if (imageConfig.usePublic) {
      return imageConfig.resolve(src, type);
    }
    
    // PRIVATE MODE: Check cache first
    if (isStoragePath(src)) {
      const cached = getFromCache(src);
      return cached || null;
    }
    
    return src;
  });

  useEffect(() => {
    let ignore = false;
    
    async function load() {
      if (!src) {
        if (!ignore) setUrl(getPlaceholder(type));
        return;
      }
      
      // PUBLIC MODE: Direct URL
      if (imageConfig.usePublic) {
        const resolved = imageConfig.resolve(src, type);
        if (!ignore) setUrl(resolved);
        return;
      }
      
      // PRIVATE MODE: Sign URL
      if (!isStoragePath(src)) {
        if (!ignore) setUrl(src);
        return;
      }

      // Check cache
      const cached = getFromCache(src);
      if (cached) {
        if (!ignore) setUrl(cached);
        return;
      }

      // Fetch signed URL
      const signed = await fetchSignedUrl(src);
      if (!ignore) setUrl(signed || getPlaceholder(type));
    }
    
    load();
    
    return () => {
      ignore = true;
    };
  }, [src, type]);

  return url;
}

// ============================================================================
// Component: OptimizedImage
// ============================================================================

export interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  type?: ImageType;
  className?: string;
  width?: number;
  height?: number;
  sizes?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  fill?: boolean;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  animate?: boolean;
}

function OptimizedImageComponent({
  src,
  alt,
  type = ImageType.PLAYER,
  className,
  width,
  height,
  sizes,
  style,
  priority = false,
  fill = false,
  objectFit = "cover",
  animate = true,
}: OptimizedImageProps) {
  const url = useImageUrl(src, type);
  const [loaded, setLoaded] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => setLoaded(false), [url]);

  if (!url) {
    return (
      <div
        className={className}
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 8,
          ...(style || {}),
        }}
        aria-label={`${alt} placeholder`}
      />
    );
  }

  const imageProps = {
    src: url,
    alt,
    className,
    style,
    onLoad: () => setLoaded(true),
    loading: priority ? undefined : ("lazy" as const),
    ...(fill ? { fill: true } : { width, height }),
    ...(sizes && { sizes }),
    ...(objectFit && fill && { style: { ...style, objectFit } }),
  };

  // No animation requested or reduced motion
  if (!animate || reduceMotion) {
    return <Image {...imageProps} priority={priority} />;
  }

  // Animated version
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={
        loaded
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 0.6 }
      }
      transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
    >
      <Image
        {...imageProps}
        priority={priority}
        className={undefined}
        style={{ width: "100%", height: "100%", ...(objectFit && { objectFit }) }}
      />
    </motion.div>
  );
}

// ✅ Export memoized component
const OptimizedImage = memo(OptimizedImageComponent);
export default OptimizedImage;

// ============================================================================
// Specialized Components (also memoized)
// ============================================================================

export const PlayerImage = memo(function PlayerImage(props: Omit<OptimizedImageProps, "type">) {
  return <OptimizedImage {...props} type={ImageType.PLAYER} />;
});

export const TeamImage = memo(function TeamImage(props: Omit<OptimizedImageProps, "type">) {
  return <OptimizedImage {...props} type={ImageType.TEAM} />;
});

export const TournamentImage = memo(function TournamentImage(props: Omit<OptimizedImageProps, "type">) {
  return <OptimizedImage {...props} type={ImageType.TOURNAMENT} />;
});