"use client";

import { motion } from "framer-motion";
import {
  FaUser,
  FaRulerVertical,
  FaBirthdayCake,
  FaFutbol,
  FaHandsHelping,
  FaExclamationTriangle,
  FaTimesCircle,
  FaCircle,
} from "react-icons/fa";
import { Users, Star, Award } from "lucide-react";
import AvatarImage from "./AvatarImage";
import { PlayerAssociation } from "@/app/lib/types";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

interface PlayersGridProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
}

const DEV = process.env.NODE_ENV !== "production";

export default function PlayersGrid({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
}: PlayersGridProps) {
  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-white/20 bg-black/50 p-6 backdrop-blur-sm">
        <p className="text-red-400">Σφάλμα φόρτωσης παικτών: {errorMessage}</p>
      </div>
    );
  }

  if (!playerAssociations || playerAssociations.length === 0) {
    return (
      <div className="rounded-2xl border border-white/20 bg-black/50 p-6 backdrop-blur-sm">
        <p className="text-white/70">Δεν υπάρχουν παίκτες σε αυτή την ομάδα.</p>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative rounded-2xl p-6 shadow-lg backdrop-blur-sm border border-white/20 bg-black/50 isolate overflow-hidden"
    >
      {/* Floating Orb */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-64 w-64 rounded-full blur-3xl opacity-15"
        style={{ background: "radial-gradient(closest-side, rgba(34,211,238,0.4), transparent)" }}
        animate={{ x: [0, -12, 6, 0], y: [0, 10, -6, 0] }}
        transition={{ repeat: Infinity, duration: 11, ease: "easeInOut" }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mb-6 flex items-center gap-3 relative z-10"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30">
          <Users className="h-5 w-5 text-cyan-300" />
        </div>
        <h2
          className="text-3xl font-bold text-white"
          style={{
            textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
          }}
        >
          Αποστολή
        </h2>
        <span
          className="text-lg text-white/60"
          style={{
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          ({playerAssociations.length} {playerAssociations.length === 1 ? "παίκτης" : "παίκτες"})
        </span>
      </motion.div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
        {playerAssociations.map((assoc, index) => {
          const p = assoc.player;
          const photoUrl = resolvePlayerPhotoUrl(p.photo);

          const stats =
            p.player_statistics?.[0] ?? {
              age: null,
              total_goals: 0,
              total_assists: 0,
              yellow_cards: 0,
              red_cards: 0,
              blue_cards: 0,
            };

          const perSeason = (seasonStatsByPlayer?.[p.id] ?? []) as Array<{
            season: string;
            matches: number;
            goals: number;
            assists: number;
            yellow_cards: number;
            red_cards: number;
            blue_cards: number;
            mvp: number;
            best_gk: number;
            updated_at: string;
          }>;

          const playerName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Άγνωστος";
          const firstName = p.first_name || "Άγνωστος";

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: 0.4 + index * 0.05,
                duration: 0.5,
                type: "spring",
                stiffness: 200,
              }}
              whileHover={{ scale: 1.03, y: -5 }}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/20 bg-black/40 p-4 backdrop-blur-sm transition-all hover:border-cyan-400/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.2)]"
            >
              {/* Card Content */}
              <div className="flex flex-col gap-3">
                {/* Player Avatar & Name */}
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border-3 border-white/30 bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg">
                    <AvatarImage
                      src={photoUrl}
                      alt={playerName}
                      width={64}
                      height={64}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      sizes="64px"
                    />
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-base font-bold text-white truncate"
                      style={{
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000'
                      }}
                    >
                      {firstName}
                    </p>
                    {p.last_name && (
                      <p
                        className="text-sm text-white/80 truncate"
                        style={{
                          textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                        }}
                      >
                        {p.last_name}
                      </p>
                    )}

                    {/* Quick info */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                      <span className="inline-flex items-center gap-1">
                        <FaUser className="h-3 w-3" /> {p.position ?? "—"}
                      </span>
                      {p.height_cm && (
                        <span className="inline-flex items-center gap-1">
                          <FaRulerVertical className="h-3 w-3" /> {p.height_cm}cm
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Star icon on hover */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    className="absolute right-3 top-3"
                  >
                    <Star className="h-4 w-4 text-cyan-400" />
                  </motion.div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-5 gap-1.5 text-xs">
                  <div className="flex flex-col items-center rounded-lg bg-orange-900/20 border border-orange-600/30 p-2">
                    <FaFutbol className="h-4 w-4 mb-1 text-amber-400" />
                    <p className="font-bold text-white">{stats.total_goals ?? 0}</p>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-cyan-900/20 border border-cyan-600/30 p-2">
                    <FaHandsHelping className="h-4 w-4 mb-1 text-cyan-400" />
                    <p className="font-bold text-white">{stats.total_assists ?? 0}</p>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-yellow-900/20 border border-yellow-600/30 p-2">
                    <FaExclamationTriangle className="h-4 w-4 mb-1 text-yellow-400" />
                    <p className="font-bold text-white">{stats.yellow_cards ?? 0}</p>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-red-900/20 border border-red-600/30 p-2">
                    <FaTimesCircle className="h-4 w-4 mb-1 text-red-400" />
                    <p className="font-bold text-white">{stats.red_cards ?? 0}</p>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-blue-900/20 border border-blue-600/30 p-2">
                    <FaCircle className="h-4 w-4 mb-1 text-blue-400" />
                    <p className="font-bold text-white">{stats.blue_cards ?? 0}</p>
                  </div>
                </div>

                {/* Per-Season Stats */}
                {perSeason.length > 0 && (
                  <div className="mt-2 rounded-lg bg-white/5 border border-white/10 p-3 overflow-x-auto">
                    <p
                      className="text-xs font-semibold text-cyan-300 mb-2 flex items-center gap-1"
                      style={{
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}
                    >
                      <Award className="h-3 w-3" /> Στατιστικά ανά Σεζόν
                    </p>
                    <table className="w-full text-[10px] text-white/80">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-1 pr-2 font-semibold">Σεζόν</th>
                          <th className="text-left py-1 pr-2 font-semibold">M</th>
                          <th className="text-left py-1 pr-2 font-semibold">G/A</th>
                          <th className="text-left py-1 pr-2 font-semibold">Κάρτες</th>
                          <th className="text-left py-1 font-semibold">Βραβεία</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perSeason.map((row, i) => (
                          <tr key={i} className="border-b border-white/5 last:border-0">
                            <td className="py-1 pr-2 text-cyan-300">{row.season}</td>
                            <td className="py-1 pr-2">{row.matches}</td>
                            <td className="py-1 pr-2 font-semibold">
                              {row.goals}/{row.assists}
                            </td>
                            <td className="py-1 pr-2 text-yellow-300">
                              {row.yellow_cards}/{row.red_cards}/{row.blue_cards}
                            </td>
                            <td className="py-1 text-amber-300">
                              {row.mvp}/{row.best_gk}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {DEV && (
                  <p className="text-[9px] text-zinc-600 break-all mt-1 font-mono">
                    {photoUrl}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
