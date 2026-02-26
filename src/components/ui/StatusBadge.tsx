"use client";

import { motion } from "framer-motion";
import { PulsingDot } from "./animations";

export type MatchStatusType = "scheduled" | "finished" | "postponed" | "running";

interface StatusBadgeProps {
  status: MatchStatusType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig: Record<MatchStatusType, {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  finished: {
    label: "ΟΛΟΚΛΗΡΩΘΗΚΕ",
    bgClass: "bg-green-500/20",
    textClass: "text-green-400",
    borderClass: "border-green-500/30",
  },
  scheduled: {
    label: "ΠΡΟΣΕΧΩΣ",
    bgClass: "bg-amber-500/20",
    textClass: "text-amber-400",
    borderClass: "border-amber-500/30",
  },
  postponed: {
    label: "ΑΝΑΒΛΗΘΗΚΕ",
    bgClass: "bg-orange-500/20",
    textClass: "text-orange-400",
    borderClass: "border-orange-500/30",
  },
  running: {
    label: "LIVE",
    bgClass: "bg-emerald-500/20",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/30",
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
  lg: "px-4 py-1.5 text-sm",
};

export function StatusBadge({ status, size = "md", className = "" }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.scheduled;
  
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        inline-flex items-center gap-1.5
        rounded-full border font-bold uppercase tracking-wider
        ${config.bgClass} ${config.textClass} ${config.borderClass}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {status === "running" && <PulsingDot />}
      {config.label}
    </motion.span>
  );
}

/**
 * Format badge for tournament format display
 */
export function FormatBadge({ 
  format, 
  className = "" 
}: { 
  format: "league" | "groups" | "knockout" | "mixed";
  className?: string;
}) {
  const labels: Record<string, string> = {
    league: "LEAGUE",
    groups: "ΟΜΙΛΟΙ",
    knockout: "KNOCKOUT",
    mixed: "MIXED",
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-3 py-1 rounded-full
        bg-black/40 border border-white/10
        text-[10px] font-mono font-medium uppercase tracking-wider text-white/60
        ${className}
      `}
    >
      {labels[format] || format.toUpperCase()}
    </span>
  );
}
