"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Carousel } from "@/app/home/Carousel";

type HomeHeroProps = {
  images: string[];
  logoSrc?: string;
  leftWords?: [string, string];
  rightWords?: [string, string];
  dim?: number;    // 0..1    /* [CTRL-1] */
  blurPx?: number; // e.g. 2  /* [CTRL-2] */
};

export default function HomeHero({
  images,
  logoSrc = "/UltraChampLogo3.png",
  leftWords = ["Καλώς", "Ήρθατε"],
  rightWords = ["Καλή", "Διασκέδαση"],
  dim = 0.5,     // darker -> higher number   /* [CTRL-1] */
  blurPx = 2,    // stronger blur -> higher   /* [CTRL-2] */
}: HomeHeroProps) {
  return (
    <section
      className="
        relative isolate overflow-hidden
        min-h-[60svh] sm:min-h-[70dvh] md:min-h-[80dvh] /* responsive hero height */
      "
      aria-label="Ultra Champ hero"
    >
      {/* Background carousel fills the hero */}
      <div className="absolute inset-0 -z-10">
        <Carousel images={images} />
      </div>

      {/* Dimming/obscuring overlay (animated) — non-blocking for touch */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: dim }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backdropFilter: `blur(${blurPx}px)`, backgroundColor: `rgba(0,0,0,${dim})` }}
        aria-hidden
      />

      {/* Subtle bottom gradient for legibility on busy photos */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 z-20 bg-gradient-to-t from-black/40 via-black/10 to-transparent" aria-hidden />

      {/* Content: mobile stack + desktop 3-column layout */}
      <div
        className="
          relative z-30 h-full
          grid grid-rows-[1fr_auto_1fr] md:grid-rows-1
          grid-cols-1 md:grid-cols-[1fr_auto_1fr]
          place-items-center md:items-center
          px-4 sm:px-6
        "
      >
        {/* Left words (md+) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="hidden md:flex justify-end pr-6"
        >
          <p className="text-white/90 text-3xl lg:text-5xl font-semibold tracking-wide uppercase leading-none drop-shadow">
            {leftWords[0]} <span className="font-light">{leftWords[1]}</span>
          </p>
        </motion.div>

        {/* Logo (center) */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="flex items-center justify-center px-2 sm:px-4"
        >
          <Image
            src={logoSrc}
            alt="Ultra Champ"
            width={560}
            height={560}
            priority
            className="
              h-auto drop-shadow-2xl select-none
              w-[62vw] max-w-[360px]            /* mobile size */       /* [CTRL-3] */
              sm:w-[52vw] sm:max-w-[420px]      /* small tablets */     /* [CTRL-3] */
              md:w-[min(42vw,520px)]            /* desktop scale */     /* [CTRL-3] */
            "
            sizes="(max-width: 640px) 62vw, (max-width: 1024px) 52vw, 520px" /* [CTRL-4] */
          />
        </motion.div>

        {/* Right words (md+) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="hidden md:flex justify-start pl-6"
        >
          <p className="text-white/90 text-3xl lg:text-5xl font-semibold tracking-wide uppercase leading-none drop-shadow">
            {rightWords[0]} <span className="font-light">{rightWords[1]}</span>
          </p>
        </motion.div>

        {/* Mobile tagline (shown when md:hidden) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="md:hidden col-span-1 row-start-3 flex flex-col items-center gap-1 pb-6 text-center"
        >
          <p className="text-white/90 text-2xl font-semibold uppercase leading-none drop-shadow-sm"> {/* [CTRL-5] */}
            {leftWords[0]} <span className="font-light">{leftWords[1]}</span>
          </p>
          <p className="text-white/90 text-2xl font-semibold uppercase leading-none drop-shadow-sm"> {/* [CTRL-5] */}
            {rightWords[0]} <span className="font-light">{rightWords[1]}</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
