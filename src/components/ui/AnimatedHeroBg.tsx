"use client";

import { motion } from "framer-motion";

interface AnimatedHeroBgProps {
  className?: string;
  variant?: "matches" | "teams" | "tournaments";
}

/**
 * AnimatedHeroBg - Cinematic animated gradient background
 * Alternative to VantaBg with better performance
 */
export default function AnimatedHeroBg({ 
  className = "", 
  variant = "matches" 
}: AnimatedHeroBgProps) {
  const gradients = {
    matches: {
      primary: "rgba(251, 191, 36, 0.08)",
      secondary: "rgba(245, 158, 11, 0.05)",
      accent: "rgba(251, 191, 36, 0.03)",
    },
    teams: {
      primary: "rgba(251, 191, 36, 0.06)",
      secondary: "rgba(245, 158, 11, 0.04)",
      accent: "rgba(251, 191, 36, 0.02)",
    },
    tournaments: {
      primary: "rgba(251, 191, 36, 0.07)",
      secondary: "rgba(245, 158, 11, 0.05)",
      accent: "rgba(251, 191, 36, 0.03)",
    },
  };

  const colors = gradients[variant];

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Base dark gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, ${colors.primary} 0%, transparent 50%),
            radial-gradient(ellipse at 0% 100%, ${colors.secondary} 0%, transparent 60%),
            radial-gradient(ellipse at 100% 50%, ${colors.accent} 0%, transparent 50%),
            linear-gradient(to bottom, #09090B 0%, #0a0a0c 50%, #09090B 100%)
          `
        }}
      />

      {/* Animated floating orbs */}
      <motion.div
        className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-30 blur-[120px]"
        style={{ background: `radial-gradient(circle, ${colors.primary} 0%, transparent 70%)` }}
        animate={{
          x: [0, 50, -30, 0],
          y: [0, 30, -20, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
        style={{ background: `radial-gradient(circle, ${colors.secondary} 0%, transparent 70%)` }}
        animate={{
          x: [0, -40, 30, 0],
          y: [0, -30, 20, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Bottom gradient fade */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: 'linear-gradient(to top, #09090B 0%, transparent 100%)',
        }}
      />
    </div>
  );
}
