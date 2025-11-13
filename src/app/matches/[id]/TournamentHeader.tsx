"use client";

import { motion } from "framer-motion";
import { TournamentImage } from "@/app/lib/OptimizedImage";

/**
 * TournamentHeader - Big tournament logo with title below
 * Logo appears in PNG form with no background over the text label
 */
export default function TournamentHeader({
  logo,
  name,
}: {
  logo: string | null;
  name: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 120 }}
      className="mb-8 flex flex-col items-center"
    >
      {/* Big Tournament Logo */}
      {logo && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="relative mb-6"
        >
          <div className="relative h-32 w-32 md:h-40 md:w-40 lg:h-48 lg:w-48">
            <TournamentImage
              src={logo}
              alt={name}
              width={192}
              height={192}
              className="h-full w-full object-contain drop-shadow-2xl"
              priority
            />
            {/* Glow effect behind logo */}
            <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
              <TournamentImage
                src={logo}
                alt=""
                width={192}
                height={192}
                className="h-full w-full object-contain"
                priority
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Tournament Name */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-center text-3xl font-extrabold text-white md:text-4xl lg:text-5xl"
      >
        <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent drop-shadow-lg">
          {name}
        </span>
      </motion.h1>
    </motion.div>
  );
}