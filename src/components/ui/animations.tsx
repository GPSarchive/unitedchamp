"use client";

import { motion, useMotionValue, useTransform, animate, useInView } from "framer-motion";
import { useEffect, useRef, useState, ReactNode } from "react";

/**
 * FadeUp - Scroll-triggered reveal animation
 */
export function FadeUp({ 
  children, 
  delay = 0,
  className = "" 
}: { 
  children: ReactNode; 
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counter - Animated number count-up
 */
export function Counter({ 
  from = 0, 
  to, 
  suffix = "",
  className = "" 
}: { 
  from?: number; 
  to: number; 
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState(from);

  useEffect(() => {
    if (isInView) {
      const controls = animate(from, to, { 
        duration: 1.5, 
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (value) => setDisplayValue(Math.round(value))
      });
      return () => controls.stop();
    }
  }, [isInView, from, to]);

  return (
    <span ref={ref} className={className}>
      {displayValue}
      {suffix}
    </span>
  );
}

/**
 * GlassCard - Glassmorphic card component
 */
export function GlassCard({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      className={`
        rounded-2xl 
        bg-gradient-to-br from-white/[0.06] to-white/[0.02]
        backdrop-blur-xl 
        border border-white/[0.08]
        ${className}
      `}
      whileHover={hover ? { y: -8, scale: 1.02, transition: { duration: 0.25 } } : undefined}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer - Container for staggered animations
 */
export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.06,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - Individual item in stagger animation
 */
export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * WordByWord - Animated headline with word-by-word entrance
 */
export function WordByWord({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
            delay: delay + i * 0.1,
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

/**
 * PulsingDot - Animated pulsing indicator
 */
export function PulsingDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
  );
}
