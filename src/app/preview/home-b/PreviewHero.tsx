"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Carousel } from "@/app/home/Carousel";

type PreviewHeroProps = {
  images: string[];
  logoSrc?: string;
  dim?: number;
  blurPx?: number;
};

export default function PreviewHero({
  images,
  logoSrc = "/UltraChampLogo3.png",
  dim = 0.55,
  blurPx = 2,
}: PreviewHeroProps) {
  return (
    <section
      className="relative isolate overflow-hidden min-h-[62svh] sm:min-h-[72dvh] md:min-h-[82dvh]"
      aria-label="Ultra Champ hero"
    >
      {/* Background photo carousel */}
      <div className="absolute inset-0 -z-10">
        <Carousel images={images} />
      </div>

      {/* Dim overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: dim }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backdropFilter: `blur(${blurPx}px)`, backgroundColor: `rgba(8,8,15,${dim})` }}
        aria-hidden
      />

      {/* Vignette + bottom fade to blend into PaperBackground */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(8,8,15,0.55)_100%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 z-20 bg-gradient-to-t from-[#08080f] via-[#08080f]/70 to-transparent" aria-hidden />

      {/* Fine grid over hero to match editorial pages */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 z-20 h-full w-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hgrid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hgrid)" />
      </svg>

      {/* Orange accent bar — signature editorial marker */}
      <div aria-hidden className="absolute top-0 left-0 h-[3px] w-40 md:w-72 z-30 bg-[#fb923c]" />

      {/* Content */}
      <div className="relative z-30 h-full flex flex-col items-center justify-center px-4 sm:px-6 pt-16 pb-24 md:pb-32">
        {/* Mono kicker */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex items-center gap-3 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.35em] text-[#fb923c] mb-6"
        >
          <span className="h-[2px] w-8 bg-[#fb923c]" />
          Edition · <span className="text-[#F3EFE6]/70">{new Date().getFullYear()} / Season</span>
        </motion.div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="mb-6 md:mb-8"
        >
          <Image
            src={logoSrc}
            alt="UltraChamp"
            width={180}
            height={180}
            priority
            className="h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 object-contain drop-shadow-[0_8px_40px_rgba(251,146,60,0.35)]"
          />
        </motion.div>

        {/* Display headline — Fraunces italic */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="font-[var(--f-display)] font-black italic text-center leading-[0.92] tracking-[-0.02em] text-[#F3EFE6]"
          style={{ fontSize: "clamp(2.4rem, 7vw, 5.75rem)" }}
        >
          Mini Football,
          <br />
          <span className="text-[#fb923c]">grown-up</span> ambitions.
        </motion.h1>

        {/* Body subtitle — Figtree */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-6 max-w-2xl text-center text-base md:text-lg text-[#F3EFE6]/75 leading-relaxed"
        >
          Ο απόλυτος προορισμός για συναρπαστικούς αγώνες mini football στην Ελλάδα —
          ασφάλεια, οργάνωση, ποδοσφαιρική παιδεία.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3"
        >
          <a
            href="/tournaments"
            className="group inline-flex items-center gap-3 border-2 border-[#fb923c] bg-[#fb923c] px-7 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-[#08080f] hover:bg-[#fb923c]/90 transition-all"
          >
            Τα Τουρνουά
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </a>
          <a
            href="/paiktes"
            className="group inline-flex items-center gap-3 border-2 border-[#F3EFE6]/40 bg-transparent px-7 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-[#F3EFE6] hover:border-[#F3EFE6]/70 hover:bg-[#F3EFE6]/5 transition-all"
          >
            Οι Παίκτες
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
