"use client";

/**
 * StadiumBg - Premium dark stadium-inspired background
 * Replaces Vanta waves with a lightweight CSS-only graphic
 * Inspired by Super League broadcast overlays
 */
export default function StadiumBg({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {/* Base gradient - deep dark near-black */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 20%, #1a0608 0%, #110304 40%, #0a0202 70%, #050101 100%)",
        }}
      />

      {/* Stadium floodlight glow - top center crimson */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(220, 38, 38, 0.10) 0%, transparent 100%)",
        }}
      />

      {/* Secondary crimson glow - top left */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 30% at 20% 10%, rgba(185, 28, 28, 0.07) 0%, transparent 100%)",
        }}
      />

      {/* Secondary crimson glow - top right */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 30% at 80% 10%, rgba(185, 28, 28, 0.07) 0%, transparent 100%)",
        }}
      />

      {/* Subtle field line pattern overlay */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
      >
        {/* Center circle */}
        <circle cx="600" cy="400" r="120" stroke="white" strokeWidth="2" fill="none" />
        {/* Center line */}
        <line x1="600" y1="100" x2="600" y2="700" stroke="white" strokeWidth="2" />
        {/* Outer rectangle */}
        <rect x="100" y="100" width="1000" height="600" stroke="white" strokeWidth="2" fill="none" rx="4" />
        {/* Penalty areas */}
        <rect x="100" y="220" width="180" height="360" stroke="white" strokeWidth="1.5" fill="none" />
        <rect x="920" y="220" width="180" height="360" stroke="white" strokeWidth="1.5" fill="none" />
        {/* Goal areas */}
        <rect x="100" y="300" width="80" height="200" stroke="white" strokeWidth="1" fill="none" />
        <rect x="1020" y="300" width="80" height="200" stroke="white" strokeWidth="1" fill="none" />
        {/* Center dot */}
        <circle cx="600" cy="400" r="4" fill="white" />
      </svg>

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Bottom vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 30%)",
        }}
      />
    </div>
  );
}
