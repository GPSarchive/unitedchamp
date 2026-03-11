"use client";

const dots = Array.from({ length: 20 }, (_, i) => ({
  width: 4 + ((i * 7 + 3) % 6),
  left: ((i * 17 + 5) % 100),
  top: ((i * 13 + 11) % 100),
  duration: 6 + ((i * 11 + 2) % 8),
  delay: ((i * 3 + 1) % 5),
}));

export default function FloatingDotsBg({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-900 via-zinc-900/95 to-zinc-950">
        {/* Floating dots */}
        {dots.map((dot, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-orange-400/20 animate-float"
            style={{
              width: `${dot.width}px`,
              height: `${dot.width}px`,
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}
