// src/app/paiktes/SportyBackground.tsx - Modern football-themed backgrounds
"use client";

import { motion } from "framer-motion";
import { CSSProperties } from "react";

type BackgroundVariant = "pitch" | "hexagon" | "dots" | "gradient" | "tactical";

type SportyBackgroundProps = {
  variant?: BackgroundVariant;
  opacity?: number;
  animate?: boolean;
  className?: string;
};

export default function SportyBackground({
  variant = "pitch",
  opacity = 0.15,
  animate = true,
  className = "",
}: SportyBackgroundProps) {
  const baseStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity,
    zIndex: 0,
  };

  switch (variant) {
    case "pitch":
      return (
        <div style={baseStyle} className={className}>
          {/* Football pitch lines pattern */}
          <svg
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", inset: 0 }}
          >
            <defs>
              <pattern
                id="pitch-pattern"
                x="0"
                y="0"
                width="200"
                height="300"
                patternUnits="userSpaceOnUse"
              >
                {/* Vertical lines */}
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="300"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                <line
                  x1="100"
                  y1="0"
                  x2="100"
                  y2="300"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                  strokeDasharray="10,10"
                />
                <line
                  x1="200"
                  y1="0"
                  x2="200"
                  y2="300"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />

                {/* Horizontal lines */}
                <line
                  x1="0"
                  y1="0"
                  x2="200"
                  y2="0"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                <line
                  x1="0"
                  y1="150"
                  x2="200"
                  y2="150"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                  strokeDasharray="10,10"
                />
                <line
                  x1="0"
                  y1="300"
                  x2="200"
                  y2="300"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />

                {/* Center circle */}
                <circle
                  cx="100"
                  cy="150"
                  r="30"
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2"
                />

                {/* Penalty box */}
                <rect
                  x="40"
                  y="10"
                  width="120"
                  height="60"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.5"
                />
              </pattern>

              <linearGradient id="pitch-fade" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
                <stop offset="50%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
              </linearGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#pitch-pattern)" />
            <rect width="100%" height="100%" fill="url(#pitch-fade)" />
          </svg>

          {/* Animated overlay */}
          {animate && (
            <motion.div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(212,175,55,0.15) 0%, transparent 50%)",
              }}
              animate={{
                "--x": ["30%", "70%", "30%"],
                "--y": ["40%", "60%", "40%"],
              } as any}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </div>
      );

    case "hexagon":
      return (
        <div style={baseStyle} className={className}>
          <svg
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", inset: 0 }}
          >
            <defs>
              <pattern
                id="hexagon-pattern"
                x="0"
                y="0"
                width="80"
                height="70"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20,5 L 40,5 L 50,25 L 40,45 L 20,45 L 10,25 Z"
                  fill="none"
                  stroke="rgba(212,175,55,0.3)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 60,40 L 80,40 L 90,60 L 80,80 L 60,80 L 50,60 Z"
                  fill="none"
                  stroke="rgba(212,175,55,0.2)"
                  strokeWidth="1"
                />
              </pattern>

              <radialGradient id="hex-glow" cx="50%" cy="50%">
                <stop offset="0%" stopColor="rgba(212,175,55,0.2)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#hexagon-pattern)" />
            <rect width="100%" height="100%" fill="url(#hex-glow)" />
          </svg>

          {animate && (
            <motion.div
              style={{
                position: "absolute",
                top: "20%",
                left: "20%",
                width: "60%",
                height: "60%",
                background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </div>
      );

    case "dots":
      return (
        <div style={baseStyle} className={className}>
          <svg
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", inset: 0 }}
          >
            <defs>
              <pattern
                id="dot-pattern"
                x="0"
                y="0"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.4)" />
                <circle cx="40" cy="40" r="1.5" fill="rgba(212,175,55,0.3)" />
              </pattern>

              <radialGradient id="dot-fade" cx="50%" cy="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
              </radialGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#dot-pattern)" />
            <rect width="100%" height="100%" fill="url(#dot-fade)" />
          </svg>
        </div>
      );

    case "tactical":
      return (
        <div style={baseStyle} className={className}>
          {/* Tactical formation board style */}
          <svg
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", inset: 0 }}
          >
            <defs>
              <pattern
                id="tactical-grid"
                x="0"
                y="0"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="60"
                  y2="0"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="60"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />
              </pattern>

              <filter id="tactical-glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#tactical-grid)" />

            {/* Connecting lines - tactical board style */}
            <motion.line
              x1="20%"
              y1="30%"
              x2="50%"
              y2="50%"
              stroke="rgba(212,175,55,0.3)"
              strokeWidth="2"
              strokeDasharray="5,5"
              filter="url(#tactical-glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
            <motion.line
              x1="80%"
              y1="30%"
              x2="50%"
              y2="50%"
              stroke="rgba(212,175,55,0.3)"
              strokeWidth="2"
              strokeDasharray="5,5"
              filter="url(#tactical-glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2, delay: 0.5, repeat: Infinity, repeatDelay: 1 }}
            />
            <motion.line
              x1="50%"
              y1="50%"
              x2="50%"
              y2="80%"
              stroke="rgba(212,175,55,0.3)"
              strokeWidth="2"
              strokeDasharray="5,5"
              filter="url(#tactical-glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2, delay: 1, repeat: Infinity, repeatDelay: 1 }}
            />

            {/* Player position markers */}
            <motion.circle
              cx="50%"
              cy="50%"
              r="8"
              fill="rgba(212,175,55,0.2)"
              stroke="rgba(212,175,55,0.5)"
              strokeWidth="2"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </svg>
        </div>
      );

    case "gradient":
    default:
      return (
        <div style={baseStyle} className={className}>
          {/* Modern gradient mesh */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(circle at 20% 30%, rgba(212,175,55,0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, rgba(140,108,0,0.1) 0%, transparent 50%),
                radial-gradient(circle at 50% 50%, rgba(212,175,55,0.05) 0%, transparent 70%)
              `,
            }}
          />

          {animate && (
            <>
              <motion.div
                style={{
                  position: "absolute",
                  top: "10%",
                  left: "10%",
                  width: "200px",
                  height: "200px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)",
                  filter: "blur(60px)",
                }}
                animate={{
                  x: [0, 100, 0],
                  y: [0, 50, 0],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              <motion.div
                style={{
                  position: "absolute",
                  bottom: "20%",
                  right: "20%",
                  width: "250px",
                  height: "250px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(140,108,0,0.15) 0%, transparent 70%)",
                  filter: "blur(70px)",
                }}
                animate={{
                  x: [0, -80, 0],
                  y: [0, -40, 0],
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </>
          )}
        </div>
      );
  }
}