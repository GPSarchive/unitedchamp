"use client";

export default function AnimatedGradientBg({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      {/* Animated gradient blobs */}
      <div className="absolute inset-0 -z-10">
        {/* Base — slightly lighter than zinc-950 */}
        <div className="absolute inset-0 bg-zinc-900" />

        {/* Blob 1 — warm orange */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] animate-blob"
          style={{ background: "radial-gradient(circle, #f97316, transparent 70%)", top: "10%", left: "15%" }}
        />
        {/* Blob 2 — amber */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px] animate-blob animation-delay-2000"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)", top: "40%", right: "10%" }}
        />
        {/* Blob 3 — subtle blue for contrast */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-[100px] animate-blob animation-delay-4000"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)", bottom: "10%", left: "40%" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
