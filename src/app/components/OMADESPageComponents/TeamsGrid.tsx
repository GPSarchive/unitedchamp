// app/components/OMADESPageComponents/TeamsGrid.tsx (updated with correct redirect path)
"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { easeOut } from "framer-motion";

interface Team {
  id: number;
  name: string;
  logo: string;
}

interface TeamsGridProps {
  teams: Team[];
}

// Variants for the whole grid (stagger children)
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Variants for each card
const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

// Variants for the logo grayscale → color
const logoVariants = {
  hidden: { filter: "grayscale(100%)", opacity: 0 },
  show: {
    filter: "grayscale(0%)",
    opacity: 1,
    transition: { duration: 1, ease: easeOut },
  },
};

export default function TeamsGrid({ teams }: TeamsGridProps) {
  return (
    <motion.div
      // Full-width, auto-fit responsive columns
      className="grid gap-6 w-full
                 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {teams.map((team) => (
        <motion.div key={team.id} variants={cardVariants}>
          <Link
            href={`/OMADA/${team.id}`} // Updated to match the detail page path /OMADA/[id]
            className="block rounded-xl border border-white/10 
                       bg-gradient-to-b from-zinc-950 to-zinc-900
                       hover:border-white/30 hover:shadow-lg hover:shadow-white/10 
                       transition-all duration-300"
          >
            <div className="flex flex-col items-center p-6">
              <motion.div variants={logoVariants}>
                <Image
                  src={team.logo}
                  alt={`${team.name} logo`}
                  width={80}
                  height={80}
                  className="object-contain mb-4"
                />
              </motion.div>
              <p className="text-base font-medium text-white text-center">
                {team.name}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}