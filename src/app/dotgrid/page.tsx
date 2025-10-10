// app/dotgrid/page.tsx
"use client";

import DotGrid from "@/app/OMADES/DotGrid";

export default function DotgridPage() {
  return (
    <main className="relative min-h-dvh bg-black">
      <DotGrid
        fullscreen
        className="z-0 pointer-events-none" // no negative z-index
        baseColor="#1F1B2E"
        activeColor="#F59E0B"
        dotSize={5}
        gap={15}
        proximity={120}
        shockRadius={250}
        shockStrength={5}
        resistance={750}
        returnDuration={1.5}
      />

      {/* content above the grid */}
      <div className="relative z-10">
        {/* your content */}
      </div>
    </main>
  );
}
