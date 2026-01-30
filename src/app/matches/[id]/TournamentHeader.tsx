"use client";

import { motion } from "framer-motion";
import { TournamentImage } from "@/app/lib/OptimizedImage";

/**
 * TournamentHeader - Elegant tournament logo with title
 * Features emerald glow effect behind logo
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
      transition={{ duration: 0.5 }}
      className="mb-8 flex flex-col items-center"
    >
      {/* Tournament Logo */}
      {logo && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="relative mb-5"
        >
          <div className="relative h-28 w-28 md:h-36 md:w-36 lg:h-44 lg:w-44">
            <TournamentImage
              src={logo}
              alt={name}
              width={176}
              height={176}
              className="h-full w-full object-contain drop-shadow-2xl"
              priority
            />
            {/* Emerald glow effect */}
            <div className="absolute inset-0 -z-10 blur-3xl opacity-20">
              <div className="h-full w-full rounded-full bg-emerald-500" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Tournament Name */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-center text-2xl font-bold text-white md:text-3xl lg:text-4xl"
      >
        <span className="bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-300 bg-clip-text text-transparent">
          {name}
        </span>
      </motion.h1>
    </motion.div>
  );
}
