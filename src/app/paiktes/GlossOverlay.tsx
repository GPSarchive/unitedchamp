"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSignedUrl } from "./SignedImg";

type MaskStyle = CSSProperties & {
  WebkitMaskImage?: string;
  maskImage?: string;
  WebkitMaskRepeat?: string;
  maskRepeat?: string;
  WebkitMaskSize?: string;
  maskSize?: string;
  WebkitMaskPosition?: string;
  maskPosition?: string;
  maskMode?: "match-source" | "luminance" | "alpha";
};

// One-time blob fallback cache per URL if you ever need it.
const __blobOnceCache = new Map<string, Promise<string>>();
async function toBlobUrlOnce(u: string) {
  if (!__blobOnceCache.has(u)) {
    __blobOnceCache.set(
      u,
      fetch(u, { credentials: "omit", mode: "cors" })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.blob();
        })
        .then((b) => URL.createObjectURL(b))
    );
  }
  return __blobOnceCache.get(u)!;
}

// Optional: lightweight alpha detection (returns null if we can't tell)
function useHasAlpha(maskUrl: string | null) {
  const [hasAlpha, setHasAlpha] = useState<boolean | null>(null);
  useEffect(() => {
    if (!maskUrl) {
      setHasAlpha(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);
        let transparent = false;
        for (let i = 3; i < data.length; i += 16) {
          if (data[i] < 255) { transparent = true; break; }
        }
        if (!cancelled) setHasAlpha(transparent);
      } catch {
        if (!cancelled) setHasAlpha(null);
      }
    };
    img.onerror = () => !cancelled && setHasAlpha(null);
    img.src = maskUrl;
    return () => { cancelled = true; };
  }, [maskUrl]);
  return hasAlpha;
}

export default function GlossOverlay({
  src,
  maskSrc,
  run = true,
  angle = 18,
  thickness = 120,
  duration = 3.2,
  intensity = 1,
  disableIfOpaque = true,
}: {
  src: string | null | undefined;
  maskSrc?: string | null | undefined;
  run?: boolean;
  angle?: number;
  thickness?: number;
  duration?: number;
  intensity?: number;
  disableIfOpaque?: boolean;
}) {
  // Signed URLs for image and mask
  const imageUrl = useSignedUrl(src ?? null);
  const maskUrl = useSignedUrl((maskSrc ?? src) ?? null);

  // Prefer direct reuse of the signed URL. Fallback to a cached blob only if you detect issues.
  const [cssMaskUrl, setCssMaskUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!maskUrl) { setCssMaskUrl(null); return; }
      // Direct URL first: zero extra transfer when cached.
      setCssMaskUrl(maskUrl);

      // If you hit a browser that blocks CSS masks by CORP/CORS and you detect it,
      // you can uncomment the next two lines to switch to a blob once:
      // const blob = await toBlobUrlOnce(maskUrl);
      // if (!cancel) setCssMaskUrl(blob);
    })();
    return () => { cancel = true; };
  }, [maskUrl]);

  const reduce = useReducedMotion();
  const hasAlpha = useHasAlpha(maskUrl ?? null); // probe the real image; returns null if blocked

  const active = run && !reduce;
  const clamp = (v: number, min = 0, max = 1.5) => Math.min(Math.max(v, min), max);

  // Build clip style with the mask URL
  const clipStyle: MaskStyle = useMemo(
    () => ({
      WebkitMaskImage: cssMaskUrl ? `url(${cssMaskUrl})` : undefined,
      maskImage: cssMaskUrl ? `url(${cssMaskUrl})` : undefined,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "cover",
      maskSize: "cover",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      maskMode: "alpha",
      zIndex: 1,
      borderRadius: "inherit",
    }),
    [cssMaskUrl]
  );

  const shouldRender =
    !!imageUrl && !!cssMaskUrl && !(disableIfOpaque && hasAlpha === false);

  if (!shouldRender) return null;

  return (
    <div className="pointer-events-none absolute inset-0" style={clipStyle}>
      {/* static subtle gloss */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "screen",
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.03) 40%, rgba(255,255,255,0) 70%)",
          opacity: 0.6 * clamp(intensity),
        }}
      />
      {/* sweeping specular line */}
      <motion.div
        className="absolute -inset-[20%]"
        style={{ transform: `rotate(${angle}deg)` }}
        initial={false}
        animate={active ? { x: ["-40%", "140%"] } : { x: "-40%" }}
        transition={{ duration, ease: "linear", repeat: active ? Infinity : 0 }}
      >
        <div
          style={{
            width: thickness,
            height: "140%",
            margin: "0 auto",
            background:
              "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.26) 50%, rgba(255,255,255,0) 100%)",
            filter: "blur(0.6px)",
            mixBlendMode: "screen",
            opacity: 0.8 * clamp(intensity),
          }}
        />
      </motion.div>
      {/* micro clearcoat */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "screen",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, rgba(255,255,255,0) 2px)",
          opacity: 0.14 * clamp(intensity),
        }}
      />
    </div>
  );
}
