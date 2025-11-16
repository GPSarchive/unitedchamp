// components/GlossOverlay.tsx - SIMPLIFIED (No signing!)
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ImageType } from "@/app/lib/image-config";
import { useImageUrl } from "@/app/lib/OptimizedImage";

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

// Optional: lightweight alpha detection
function useHasAlpha(imageUrl: string | null) {
  const [hasAlpha, setHasAlpha] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (!imageUrl) {
      setHasAlpha(null);
      return;
    }
    
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const w = img.naturalWidth || 1;
        const h = img.naturalHeight || 1;
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);
        
        // Sample every 16th pixel for performance
        let transparent = false;
        for (let i = 3; i < data.length; i += 64) {
          if (data[i] < 255) {
            transparent = true;
            break;
          }
        }
        if (!cancelled) setHasAlpha(transparent);
      } catch {
        // CORS or other error - assume it has alpha to be safe
        if (!cancelled) setHasAlpha(true);
      }
    };
    
    img.onerror = () => !cancelled && setHasAlpha(null);
    img.src = imageUrl;
    
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);
  
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
  const resolvedSrc = useImageUrl(src, ImageType.PLAYER);
  const resolvedMaskSrc = useImageUrl(maskSrc ?? src, ImageType.PLAYER);

  const imageUrl = src ? resolvedSrc : null;
  const maskUrl = maskSrc || src ? resolvedMaskSrc : null;

  const reduce = useReducedMotion();
  const hasAlpha = useHasAlpha(maskUrl);

  const active = run && !reduce;
  const clamp = (v: number, min = 0, max = 1.5) => Math.min(Math.max(v, min), max);

  // Build clip style with the mask URL
  const clipStyle: MaskStyle = useMemo(
    () =>
      maskUrl
        ? {
            WebkitMaskImage: `url(${maskUrl})`,
            maskImage: `url(${maskUrl})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            maskMode: "alpha",
            zIndex: 3,
            borderRadius: "inherit",
            mixBlendMode: "screen",
          }
        : {},
    [maskUrl]
  );

  const shouldRender =
    !!imageUrl && !!maskUrl && !(disableIfOpaque && hasAlpha === false);

  if (!shouldRender) return null;

  const energy = clamp(intensity, 0, 2.2);

  return (
    <div className="pointer-events-none absolute inset-0" style={clipStyle}>
      {/* Static base sheen */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0) 100%)",
          opacity: 0.85 * energy,
          filter: "saturate(1.2)",
        }}
      />

      {/* Caustic bloom to make the gloss pop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 20%, rgba(255,255,200,0.4), transparent 45%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.28), transparent 40%)",
          opacity: 0.6 * energy,
          mixBlendMode: "soft-light",
        }}
      />

      {/* Sweeping specular line */}
      <motion.div
        className="absolute -inset-[30%]"
        style={{ transform: `rotate(${angle}deg)` }}
        initial={false}
        animate={active ? { x: ["-50%", "150%"] } : { x: "-50%" }}
        transition={{ duration, ease: "linear", repeat: active ? Infinity : 0 }}
      >
        <div
          style={{
            width: thickness,
            height: "160%",
            margin: "0 auto",
            background:
              "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 100%)",
            boxShadow: "0 0 45px rgba(255,255,255,0.5)",
            filter: "blur(0.3px)",
            mixBlendMode: "color-dodge",
            opacity: 1.1 * energy,
          }}
        />
      </motion.div>

      {/* Micro clearcoat */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, rgba(255,255,255,0) 2px)",
          opacity: 0.28 * energy,
        }}
      />

      {/* Rim light to emphasize silhouette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.5), transparent 45%), radial-gradient(circle at 85% 15%, rgba(255,255,255,0.3), transparent 40%), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.35), transparent 60%)",
          opacity: 0.65 * energy,
        }}
      />
    </div>
  );
}