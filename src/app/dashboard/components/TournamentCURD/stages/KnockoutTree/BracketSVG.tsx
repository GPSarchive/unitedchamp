// KnockoutTree/BracketSvg.tsx
"use client";

export default function BracketSvg({ paths }: { paths: string[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
      <defs>
        {/* warm fire gradient: amber → red */}
        <linearGradient id="brkt" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#f59e0b" stopOpacity="0.95" /> {/* amber-500 */}
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.95" /> {/* red-500 */}
        </linearGradient>

        {/* soft neon glow */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* arrowhead inherits stroke color */}
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" opacity="0.95" />
        </marker>

        <style>{`
          .sport-path {
            filter: url(#glow);
            stroke-linecap: round;
            stroke-linejoin: round;
            vector-effect: non-scaling-stroke;
          }
          .sport-dash {
            stroke-dasharray: 12 8;
            animation: dash 1.4s linear infinite;
          }
          @keyframes dash {
            to { stroke-dashoffset: -40; }
          }
          @media (prefers-reduced-motion: reduce) {
            .sport-dash { animation: none; }
          }
        `}</style>
      </defs>

      {paths.map((d, i) => (
        <g key={i}>
          {/* back layer: bold gradient, animated dash, arrowhead */}
          <path
            d={d}
            fill="none"
            stroke="url(#brkt)"
            strokeWidth={4}
            className="sport-path sport-dash"
            markerEnd="url(#arrow)"
          />
          {/* front highlight: subtle white gloss */}
          <path
            d={d}
            fill="none"
            stroke="white"
            strokeOpacity={0.5}
            strokeWidth={1.5}
            className="sport-path"
          />
        </g>
      ))}
    </svg>
  );
}
