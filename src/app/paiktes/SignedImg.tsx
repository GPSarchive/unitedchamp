"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export const BUCKET = "GPSarchive's Project"; // your bucket id

export function isStoragePath(v: string | null | undefined) {
  if (!v) return false;
  // absolute http(s), protocol-relative //, root-relative /, or data: should NOT be signed
  if (/^(https?:)?\/\//i.test(v)) return false;
  if (v.startsWith("/")) return false;
  if (v.startsWith("data:")) return false;
  return true; // treat as storage object path
}

export function useSignedUrl(pathOrUrl: string | null | undefined, bucket = BUCKET) {
  const [url, setUrl] = useState<string | null>(null);

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
          return; // already a usable URL
        }

        const u = new URL("/api/storage/sign", window.location.origin);
        u.searchParams.set("bucket", bucket);
        u.searchParams.set("path", pathOrUrl);
        const res = await fetch(u.toString(), { credentials: "include" });
        if (!res.ok) throw new Error(`sign failed: ${res.status}`);
        const data = await res.json();
        if (!ignore) setUrl(data?.signedUrl ?? null);
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
      style={style}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 6,  }}
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
