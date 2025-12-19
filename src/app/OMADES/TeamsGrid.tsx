// app/components/OMADESPageComponents/TeamsGrid.tsx
"use client";

import Link from "next/link";
import { motion, easeOut } from "framer-motion";
import TeamLogo from "@/app/components/TeamLogo";

interface Team {
  id: number;
  name: string;
  logo: string;
}
interface TeamsGridProps {
  teams: Team[];
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
};

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
      // tighter gaps between columns
      className="mx-auto max-w-5xl grid justify-items-center gap-4  lg:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {teams.map((team) => (
        <motion.div key={team.id} variants={cardVariants}>
          <Link
            href={`/OMADA/${team.id}`}
            className={[
              "group relative block overflow-hidden rounded-lg aspect-square",
              "w-28 sm:w-32 lg:w-36 xl:w-40",
              // softer tint + lighter blur
              "border border-white/20 bg-white/[0.04]",
              "ring-1 ring-white/5",
              "backdrop-blur-sm hover:backdrop-blur-md",
              "transition-all duration-300 hover:bg-white/[0.06]",
              "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_6px_18px_rgba(0,0,0,0.25)]",
            ].join(" ")}
          >
            {/* Shine sweep */}
            <span className="pointer-events-none absolute inset-0">
              <span className="absolute top-0 left-[-40%] h-full w-[45%] rotate-12 bg-gradient-to-r from-transparent via-white/12 to-transparent transition-transform duration-700 ease-out -translate-x-[120%] group-hover:translate-x-[220%] blur-[2px]" />
            </span>

            {/* slightly reduced inner blur and padding */}
            <div className="flex h-full w-full flex-col items-center justify-center p-2 sm:p-2 backdrop-blur-[1px] sm:backdrop-blur-0">
              <motion.div variants={logoVariants} className="mb-1 opacity-90 group-hover:opacity-100 transition-opacity">
                <TeamLogo
                  src={team.logo}
                  alt={`${team.name} logo`}
                  size="lg"
                  borderStyle="subtle"
                />
              </motion.div>
              <p className="mt-1 max-w-[90%] truncate text-[10px] sm:text-[11px] font-medium text-white/85 text-center">
                {team.name}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
