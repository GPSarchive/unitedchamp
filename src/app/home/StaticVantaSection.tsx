// Server Component - No 'use client' directive!
import React from "react";
import Image from "next/image";

type Props = React.PropsWithChildren<{
  className?: string;
  overlayClassName?: string; // e.g. "bg-black/20"
  priority?: boolean; // for above-the-fold images
}>;

/**
 * Static version of VantaSection - uses optimized background images
 * instead of animated Vanta effect for better performance.
 *
 * Benefits:
 * - Zero JavaScript
 * - Faster page load
 * - Lower CPU/GPU usage
 * - Works in server components
 * - Better Core Web Vitals scores
 */
export default function StaticVantaSection({
  className = "",
  overlayClassName = "bg-black/20",
  priority = false,
  children,
}: Props) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      {/* Background Image - Responsive */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/vanta/vanta-bg-desktop.webp"
          alt=""
          fill
          priority={priority}
          quality={90}
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "center" }}
        />
      </div>

      {/* Optional dark overlay for text contrast */}
      {overlayClassName && (
        <div className={`absolute inset-0 z-10 ${overlayClassName}`} />
      )}

      {/* Content */}
      <div className="relative z-20">
        {children}
      </div>
    </section>
  );
}
