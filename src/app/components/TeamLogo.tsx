// components/TeamLogo.tsx
"use client";

import Image from "next/image";

export type TeamLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type TeamLogoBorderStyle = "none" | "subtle" | "normal" | "strong" | "neon";

export interface TeamLogoProps {
  src: string | null | undefined;
  alt: string;
  size?: TeamLogoSize;
  borderStyle?: TeamLogoBorderStyle;
  className?: string;
  priority?: boolean;
  animate?: boolean;
}

const sizeMap: Record<TeamLogoSize, number> = {
  xs: 32,       // 32px - small inline logos
  sm: 48,       // 48px - compact lists
  md: 64,       // 64px - standard display
  lg: 96,       // 96px - featured display
  xl: 128,      // 128px - hero sections
  "2xl": 160,   // 160px - large hero sections
};

const borderClasses: Record<TeamLogoBorderStyle, string> = {
  none: "",
  subtle: "ring-1 ring-white/10",
  normal: "border-2 border-white/20",
  strong: "border-3 border-orange-500/40",
  neon: "border-2 border-fuchsia-400/30 ring-2 ring-fuchsia-400/20",
};

export default function TeamLogo({
  src,
  alt,
  size = "md",
  borderStyle = "subtle",
  className = "",
  priority = false,
}: TeamLogoProps) {
  const pixelSize = sizeMap[size];
  const borderClass = borderClasses[borderStyle];

  // Fallback for missing logos
  if (!src) {
    return (
      <div
        className={`${borderClass} ${className} aspect-square rounded-full bg-zinc-800/50 grid place-items-center text-white/40 flex-shrink-0`}
        style={{ width: pixelSize, height: pixelSize }}
        title="No logo available"
      >
        <svg
          className="opacity-30"
          width={pixelSize / 2}
          height={pixelSize / 2}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`${borderClass} ${className} aspect-square rounded-full overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0`}
      style={{
        width: pixelSize,
        height: pixelSize,
        padding: pixelSize * 0.05 // 5% padding
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={pixelSize}
        height={pixelSize}
        className="w-full h-full object-contain"
        priority={priority}
        loading={priority ? undefined : "lazy"}
      />
    </div>
  );
}

// Specialized variants for common use cases
export function SmallTeamLogo(props: Omit<TeamLogoProps, "size">) {
  return <TeamLogo {...props} size="sm" />;
}

export function MediumTeamLogo(props: Omit<TeamLogoProps, "size">) {
  return <TeamLogo {...props} size="md" />;
}

export function LargeTeamLogo(props: Omit<TeamLogoProps, "size">) {
  return <TeamLogo {...props} size="lg" />;
}

// Square variant (non-circular)
export interface SquareTeamLogoProps extends TeamLogoProps {
  rounded?: "none" | "sm" | "md" | "lg" | "xl";
}

export function SquareTeamLogo({
  rounded = "lg",
  borderStyle = "subtle",
  className = "",
  ...props
}: SquareTeamLogoProps) {
  const pixelSize = sizeMap[props.size || "md"];
  const borderClass = borderClasses[borderStyle];
  const roundedClass = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
  }[rounded];

  if (!props.src) {
    return (
      <div
        className={`${borderClass} ${roundedClass} ${className} aspect-square bg-zinc-800/50 grid place-items-center text-white/40 flex-shrink-0`}
        style={{ width: pixelSize, height: pixelSize }}
        title="No logo available"
      >
        <svg
          className="opacity-30"
          width={pixelSize / 2}
          height={pixelSize / 2}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`${borderClass} ${roundedClass} ${className} aspect-square overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0`}
      style={{
        width: pixelSize,
        height: pixelSize,
        padding: pixelSize * 0.08 // 8% padding for square variant
      }}
    >
      <Image
        src={props.src}
        alt={props.alt}
        width={pixelSize}
        height={pixelSize}
        className="w-full h-full object-contain"
        priority={props.priority}
        loading={props.priority ? undefined : "lazy"}
      />
    </div>
  );
}
