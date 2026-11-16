// Small shared indicator for soft-deleted ("former") players.
// Rendered in historical views (tournament stats, match rosters, match stats)
// where an archived player still needs to appear but should be clearly marked.

import type { CSSProperties } from "react";
import { CHIP } from "@/app/lib/ui/flat";

type FormerPlayerLike = { deleted_at?: string | null } | null | undefined;

export function isFormerPlayer(p: FormerPlayerLike): boolean {
  return !!p?.deleted_at;
}

type Size = "xs" | "sm";

const SIZE_CLASSES: Record<Size, string> = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-xs",
};

export function FormerPlayerBadge({
  show,
  size = "xs",
  className = "",
  style,
}: {
  show: boolean | undefined | null;
  size?: Size;
  className?: string;
  style?: CSSProperties;
}) {
  if (!show) return null;
  return (
    <span
      className={`inline-flex items-center ${CHIP} font-semibold uppercase tracking-wide text-white/60 ${SIZE_CLASSES[size]} ${className}`}
      style={style}
      title="πρώην παίκτης"
    >
      πρώην
    </span>
  );
}

export default FormerPlayerBadge;
