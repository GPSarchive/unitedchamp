"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Stars } from "lucide-react";
import * as React from "react";
import type { Id } from "@/app/lib/types";
import { SquareTeamLogo } from "@/app/components/TeamLogo";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * TeamBadge — Neon Triumph Edition
 * - Deep navy card with neon magenta→cyan accents
 * - Animated gradient outline & hover lift
 * - Image shimmer-in + subtle parallax
 * - Trophy pulse + stardust when highlight=true
 */
export default function TeamBadge({
  team,
  className = "",
  highlight = false,
}: {
  team: { id: Id; name: string; logo: string | null };
  className?: string;
  highlight?: boolean;
}) {
  // Palette
  const cardBg = "bg-[#0b1020]";
  const baseRing =
    "border border-white/10 ring-1 ring-white/10 shadow-[0_1px_0_rgba(255,255,255,0.05)]";
  const winRing =
    "ring-2 ring-fuchsia-400/70 border-fuchsia-400/20 shadow-[0_0_36px_rgba(240,46,170,0.25)]";

  const ringClass = highlight ? winRing : baseRing;
  const nameClass = highlight
    ? "text-white drop-shadow-[0_1px_0_rgba(0,0,0,.25)]"
    : "text-zinc-100";
  const subClass = highlight ? "text-cyan-300/90" : "text-zinc-400";

  return (
    <motion.div
      className={`group relative isolate overflow-hidden rounded-3xl ${cardBg} ${
        highlight ? "border border-fuchsia-400/20" : "border border-white/10"
      } p-3 backdrop-blur-sm ${className}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      {/* Animated edge aura */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[1px] -z-10 rounded-3xl"
        style={{
          background:
            "linear-gradient(120deg, rgba(240,46,170,0.22), rgba(0,212,255,0.18))",
          mask: "linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)",
          WebkitMask:
            "linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: highlight ? 1 : 0.6 }}
      />

      {/* flowing background ribbons */}
      <motion.div
        aria-hidden
        className="absolute -right-16 -top-24 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(240,46,170,0.16), transparent)" }}
        animate={{ x: [0, -8, 4, 0], y: [0, 6, -4, 0] }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -left-20 -bottom-24 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(0,212,255,0.16), transparent)" }}
        animate={{ x: [0, 6, -4, 0], y: [0, -8, 6, 0] }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex items-center gap-4">
        {/* Crest */}
        <div className="relative shrink-0">
          <SquareTeamLogo
            src={team.logo}
            alt={`${team.name} logo`}
            size="lg"
            borderStyle={highlight ? "neon" : "subtle"}
            rounded="lg"
            priority={false}
            animate={true}
            className="!h-14 !w-14 md:!h-16 md:!w-16 lg:!h-20 lg:!w-20"
          />

          {/* Winning trophy & stardust */}
          <AnimatePresence>
            {highlight && (
              <motion.div
                className="absolute -right-1 -top-1 z-10"
                initial={{ opacity: 0, rotate: -15, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
              >
                <Trophy className="h-4 w-4 text-amber-300 drop-shadow" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Name + meta */}
        <div className="leading-tight min-w-0 flex-1">
          <div className={`truncate text-base md:text-lg font-semibold ${nameClass}`}>
            {team.name}
          </div>
          <div className={`text-xs ${subClass}`}>Team #{team.id}</div>
        </div>
      </div>

      {/* Stardust burst when highlighted */}
      <AnimatePresence>
        {highlight && (
          <motion.div
            className="pointer-events-none absolute right-3 top-3 text-cyan-200/70"
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






