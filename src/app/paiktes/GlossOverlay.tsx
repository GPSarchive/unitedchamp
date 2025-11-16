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
            zIndex: 1,
            borderRadius: "inherit",
          }
        : {},
    [maskUrl]
  );

  const shouldRender =
    !!imageUrl && !!maskUrl && !(disableIfOpaque && hasAlpha === false);

  if (!shouldRender) return null;

  return (
    <div className="pointer-events-none absolute inset-0" style={clipStyle}>
      {/* Static subtle gloss */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "screen",
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.03) 40%, rgba(255,255,255,0) 70%)",
          opacity: 0.6 * clamp(intensity),
        }}
      />
      
      {/* Sweeping specular line */}
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
      
      {/* Micro clearcoat */}
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