"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Stars } from "lucide-react";
import * as React from "react";
import type { Id } from "@/app/lib/types";
import { TeamImage } from "@/app/lib/OptimizedImage";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TeamBadge({
  team,
  className = "",
  highlight = false,
}: {
  team: { id: Id; name: string; logo: string | null };
  className?: string;
  highlight?: boolean;
}) {
  const cardBg = "bg-neutral-900/90";
  const baseRing =
    "border border-amber-800/40 ring-1 ring-amber-700/20 shadow-[0_2px_12px_rgba(0,0,0,0.6)]";
  const winRing =
    "ring-2 ring-amber-400/80 border-amber-400/50 shadow-[0_0_36px_rgba(251,191,36,0.5)]";

  const ringClass = highlight ? winRing : baseRing;
  const nameClass = highlight
    ? "text-white drop-shadow-[0_1px_3px_rgba(251,191,36,0.6)]"
    : "text-amber-50";
  const subClass = highlight ? "text-amber-200" : "text-amber-300/60";

  return (
    <motion.div
      className={`group relative isolate overflow-hidden rounded-3xl ${cardBg} ${
        highlight ? "border border-amber-400/40" : "border border-neutral-700/50"
      } p-3 backdrop-blur-sm ${className}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      {/* Animated gold edge aura */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[1px] -z-10 rounded-3xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.2))",
          mask: "linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)",
          WebkitMask:
            "linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: highlight ? 1 : 0.5 }}
      />

      {/* Subtle gold glow orbs */}
      <motion.div
        aria-hidden
        className="absolute -right-16 -top-24 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.2), transparent)" }}
        animate={{ x: [0, -8, 4, 0], y: [0, 6, -4, 0] }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex items-center gap-4">
        {/* Crest */}
        <motion.div
          className={
            `relative shrink-0 h-14 w-14 md:h-16 md:w-16 lg:h-20 lg:w-20 aspect-square overflow-hidden rounded-2xl ${ringClass} bg-black/90`
          }
          title={team.name}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Subtle rotating gold highlight */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(251,191,36,0.15), transparent 30%, rgba(251,191,36,0.15) 60%, transparent 90%, rgba(251,191,36,0.15))",
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          />

          {/* logo / fallback */}
          {team.logo ? (
            <TeamImage
              src={team.logo}
              alt={`${team.name} logo`}
              fill
              objectFit="contain"
              sizes="(min-width: 1280px) 96px, (min-width: 1024px) 80px, (min-width: 768px) 64px, 56px"
              priority={false}
              animate={true}
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/20">
                {initials(team.name) || "—"}
              </span>
            </div>
          )}

          {/* Gold trophy for winners */}
          <AnimatePresence>
            {highlight && (
              <motion.div
                className="absolute -right-1 -top-1"
                initial={{ opacity: 0, rotate: -15, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
              >
                <Trophy className="h-4 w-4 text-amber-400 drop-shadow-[0_2px_6px_rgba(251,191,36,0.8)]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Name + meta */}
        <div className="leading-tight min-w-0 flex-1">
          <div className={`truncate text-base md:text-lg font-semibold ${nameClass}`}>
            {team.name}
          </div>
          <div className={`text-xs ${subClass}`}>Team #{team.id}</div>
        </div>
      </div>

      {/* Gold sparkle when highlighted */}
      <AnimatePresence>
        {highlight && (
          <motion.div
            className="pointer-events-none absolute right-3 top-3 text-amber-300"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <Stars className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}