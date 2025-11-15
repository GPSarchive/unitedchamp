// app/OMADA/[id]/TeamHeader.tsx
import { Team } from "@/app/lib/types";
import Image from "next/image";
import { FaCalendarAlt, FaShieldAlt, FaTrophy } from "react-icons/fa";

export default function TeamHeader({ team }: { team: Team }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border-2 border-amber-600/40 bg-gradient-to-r from-stone-950/95 via-amber-950/20 to-stone-950/95 shadow-2xl backdrop-blur-sm">
      {/* Horizontal Layout */}
      <div className="relative flex items-center gap-6 p-6 md:p-8">
        {/* Left: Team Logo */}
        {team.logo && (
          <div className="relative flex-shrink-0">
            <div className="relative h-24 w-24 md:h-32 md:w-32 rounded-xl overflow-hidden border-2 border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-orange-900/20 shadow-xl ring-4 ring-amber-400/10">
              <Image
                src={team.logo}
                alt={`${team.name} logo`}
                fill
                className="object-contain p-2"
                sizes="(max-width: 768px) 96px, 128px"
              />
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 bg-gradient-radial from-amber-500/20 via-transparent to-transparent blur-xl" />
            </div>
          </div>
        )}

        {/* Center/Right: Team Info */}
        <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Team Name & Details */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 tracking-tight leading-none drop-shadow-lg">
              {team.name}
            </h1>

            {/* Info Pills */}
            <div className="flex flex-wrap gap-2 mt-1">
              <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                <FaCalendarAlt className="text-amber-400 text-xs" />
                <span className="text-xs font-semibold text-zinc-200">
                  Est. {team.created_at ? new Date(team.created_at).getFullYear() : "Unknown"}
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/30">
                <FaShieldAlt className="text-amber-400 text-xs" />
                <span className="text-xs font-semibold text-zinc-200">Active Squad</span>
              </div>
            </div>
          </div>

          {/* Optional: Stats/Achievements Section */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex flex-col items-center px-6 py-3 bg-black/40 backdrop-blur-md rounded-xl border border-amber-500/30">
              <FaTrophy className="text-amber-400 text-2xl mb-1" />
              <span className="text-xs text-zinc-400 uppercase tracking-wide">Season</span>
              <span className="text-lg font-bold text-white">2024/25</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accent Line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />

      {/* Corner Decorations */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-radial from-amber-500/10 via-transparent to-transparent blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-radial from-orange-500/10 via-transparent to-transparent blur-2xl pointer-events-none" />
    </div>
  );
}