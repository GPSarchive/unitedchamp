"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Carousel } from "@/app/components/HomePageComponents/Carousel";

type HomeHeroProps = {
  images: string[];
  logoSrc?: string;
  leftWords?: [string, string];
  rightWords?: [string, string];
  dim?: number;    // 0..1
  blurPx?: number; // e.g. 2
};

export default function HomeHero({
  images,
  logoSrc = "/UltraChampLogo.png",
  leftWords = ["Καλώς", "Ήρθατε"],
  rightWords = ["Καλή", "Διασκέδαση"],
  dim = 0.5,
  blurPx = 2,
}: HomeHeroProps) {
  return (
    <div className="relative">
      {/* Base carousel */}
      <div className="relative z-0">
        <Carousel images={images} />
      </div>

      {/* Dimming/obscuring overlay (animated) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: dim }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0 z-10"
        style={{ backdropFilter: `blur(${blurPx}px)`, backgroundColor: `rgba(0,0,0,${dim})` }}
        aria-hidden
      />

      {/* Center content: words (L/R) + logo */}
      <div className="absolute inset-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center">
        {/* Left words */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="hidden md:flex justify-end pr-6"
        >
          <p className="text-white/90 text-3xl lg:text-5xl font-semibold tracking-wide uppercase leading-none">
            {leftWords[0]} <span className="font-light">{leftWords[1]}</span>
          </p>
        </motion.div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="flex items-center justify-center px-4"
        >
          <Image
            src={logoSrc}
            alt="Ultra Champ logo"
            width={560}
            height={560}
            priority
            className="w-[min(70vw,520px)] max-w-[90vw] h-auto drop-shadow-2xl"
          />
        </motion.div>

        {/* Right words */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="hidden md:flex justify-start pl-6"
        >
          <p className="text-white/90 text-3xl lg:text-5xl font-semibold tracking-wide uppercase leading-none">
            {rightWords[0]} <span className="font-light">{rightWords[1]}</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
