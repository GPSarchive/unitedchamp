// src/app/paiktes/CardBackdrop.tsx
// Single source of truth for the gold topographic backdrop behind the profile
// card. Rendered in two places by PlayersClient: the desktop right aside and
// the mobile full-screen detail sheet. Visuals are identical in both.
"use client";

/**
 * Gold "topographic" backdrop: base gradient + repeating-radial contour lines
 * + a glow layer + spotlight + vignette + fractal-noise texture.
 *
 * NOTE: the original markup applied `animation: "meshGradient 20s …"` to the
 * glow layer, but `meshGradient` is defined inside ProfileCard.module.css and
 * CSS Modules scope/rename `@keyframes`, so that global name never resolved —
 * the glow layer has always rendered statically. We keep it static here to
 * preserve the existing look (animating it would be a visual regression).
 *
 * @param animateMesh  Reserved hook for gating the glow animation if a global
 *                     keyframe is ever introduced. Defaults to false to match
 *                     the current (static) behavior.
 */
export default function CardBackdrop({
  animateMesh = false,
}: {
  animateMesh?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-0">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />

      {/* Topographic contour lines pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            repeating-radial-gradient(circle at 20% 30%, transparent 0px, transparent 40px, rgba(212, 175, 55, 0.6) 40px, rgba(212, 175, 55, 0.6) 41px),
            repeating-radial-gradient(circle at 80% 70%, transparent 0px, transparent 35px, rgba(255, 193, 7, 0.5) 35px, rgba(255, 193, 7, 0.5) 36px),
            repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 50px, rgba(140, 108, 0, 0.7) 50px, rgba(140, 108, 0, 0.7) 51px),
            repeating-radial-gradient(circle at 10% 80%, transparent 0px, transparent 45px, rgba(212, 175, 55, 0.4) 45px, rgba(212, 175, 55, 0.4) 46px),
            repeating-radial-gradient(circle at 90% 20%, transparent 0px, transparent 38px, rgba(255, 193, 7, 0.6) 38px, rgba(255, 193, 7, 0.6) 39px)
          `,
          backgroundSize: "100% 100%",
        }}
      />

      {/* Subtle animated glow overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(circle at 30% 40%, rgba(212, 175, 55, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 70% 60%, rgba(255, 193, 7, 0.06) 0%, transparent 40%)
          `,
          backgroundSize: "200% 200%",
          animation: animateMesh
            ? "meshGradient 20s ease-in-out infinite"
            : undefined,
        }}
      />

      {/* Spotlight from top */}
      <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/[0.03] to-transparent" />

      {/* Vignette effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />

      {/* Subtle noise texture for depth */}
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
