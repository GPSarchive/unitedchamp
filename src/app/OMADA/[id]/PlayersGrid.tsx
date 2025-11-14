"use client";

import { motion } from "framer-motion";
import {
  FaUser,
  FaRulerVertical,
  FaFutbol,
  FaHandsHelping,
  FaExclamationTriangle,
  FaTimesCircle,
  FaCircle,
} from "react-icons/fa";
import { Users, TrendingUp, Award } from "lucide-react";
import AvatarImage from "./AvatarImage";
import { PlayerAssociation } from "@/app/lib/types";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";
import { TeamImage } from "@/app/lib/OptimizedImage";

interface PlayersGridProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
  teamLogo?: string | null;
}

const DEV = process.env.NODE_ENV !== "production";

export default function PlayersGrid({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
  teamLogo,
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
      className="relative rounded-2xl p-6 md:p-8 shadow-lg backdrop-blur-sm border border-white/10 bg-[#0b1020] isolate overflow-hidden"
    >
      {/* Floating Orb */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-64 w-64 rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(closest-side, rgba(34,211,238,0.4), transparent)" }}
        animate={{ x: [0, -12, 6, 0], y: [0, 10, -6, 0] }}
        transition={{ repeat: Infinity, duration: 11, ease: "easeInOut" }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mb-8 flex items-center gap-3 relative z-10"
      >
        <motion.div
          initial={{ rotate: -15, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 shadow-[0_0_24px_rgba(34,211,238,0.3)]"
        >
          <Users className="h-6 w-6 text-cyan-300" />
        </motion.div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-300 via-blue-200 to-purple-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(34,211,238,0.5)]">
            Αποστολή
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            {playerAssociations.length} {playerAssociations.length === 1 ? "παίκτης" : "παίκτες"}
          </p>
        </div>
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
              className="group relative overflow-hidden rounded-2xl border border-white/20 bg-[#0d1424] backdrop-blur-sm transition-all hover:border-cyan-400/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.2)]"
            >
              {/* Card Header with Photo */}
              <div className="relative p-6 pb-4 bg-gradient-to-b from-white/5 to-transparent">
                <div className="flex flex-col items-center">
                  {/* Player Photo with Team Logo Background */}
                  <div className="relative mb-4">
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-3 border-white/30 bg-gradient-to-br from-slate-700 to-slate-800 shadow-xl ring-2 ring-cyan-500/20">
                      <AvatarImage
                        src={photoUrl}
                        alt={playerName}
                        width={96}
                        height={96}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        sizes="96px"
                      />
                      {/* Hover glow */}
                      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>

                    {/* Team Logo Badge */}
                    {teamLogo && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 + index * 0.05, type: "spring" }}
                        className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full border-2 border-[#0d1424] bg-black/90 p-1.5 shadow-lg ring-1 ring-white/10"
                      >
                        <TeamImage
                          src={teamLogo}
                          alt="Team"
                          width={32}
                          height={32}
                          className="h-full w-full object-contain"
                          sizes="32px"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Player Name */}
                  <h3 className="text-xl font-bold text-white text-center mb-1">
                    {p.first_name} {p.last_name}
                  </h3>

                  {/* Position & Height */}
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <FaUser className="h-3 w-3" /> {p.position ?? "—"}
                    </span>
                    {p.height_cm && (
                      <>
                        <span className="text-white/20">•</span>
                        <span className="inline-flex items-center gap-1">
                          <FaRulerVertical className="h-3 w-3" /> {p.height_cm}cm
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats List */}
              <div className="border-t border-white/10 px-6 py-4 space-y-2">
                <StatRow
                  icon={<FaFutbol className="h-4 w-4" />}
                  label="Γκολ"
                  value={stats.total_goals ?? 0}
                  color="text-amber-400"
                  bgColor="bg-amber-500/10"
                  borderColor="border-amber-500/20"
                />
                <StatRow
                  icon={<FaHandsHelping className="h-4 w-4" />}
                  label="Ασίστ"
                  value={stats.total_assists ?? 0}
                  color="text-cyan-400"
                  bgColor="bg-cyan-500/10"
                  borderColor="border-cyan-500/20"
                />
                <StatRow
                  icon={<FaExclamationTriangle className="h-4 w-4" />}
                  label="Κίτρινες"
                  value={stats.yellow_cards ?? 0}
                  color="text-yellow-400"
                  bgColor="bg-yellow-500/10"
                  borderColor="border-yellow-500/20"
                />
                <StatRow
                  icon={<FaTimesCircle className="h-4 w-4" />}
                  label="Κόκκινες"
                  value={stats.red_cards ?? 0}
                  color="text-red-400"
                  bgColor="bg-red-500/10"
                  borderColor="border-red-500/20"
                />
                <StatRow
                  icon={<FaCircle className="h-4 w-4" />}
                  label="Μπλε"
                  value={stats.blue_cards ?? 0}
                  color="text-blue-400"
                  bgColor="bg-blue-500/10"
                  borderColor="border-blue-500/20"
                />
              </div>

              {/* Per-Season Stats */}
              {perSeason.length > 0 && (
                <div className="border-t border-white/10 px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-fuchsia-400" />
                    <h4 className="text-sm font-bold text-fuchsia-300">
                      Στατιστικά ανά Σεζόν
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {perSeason.map((row, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.05 + i * 0.03 }}
                        className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-cyan-300">{row.season}</span>
                          <span className="text-white/30">•</span>
                          <span className="text-zinc-400">{row.matches} αγ.</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-300">
                          <span className="text-emerald-400 font-bold">{row.goals}G</span>
                          <span className="text-cyan-400 font-bold">{row.assists}A</span>
                          {(row.mvp > 0 || row.best_gk > 0) && (
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3 text-amber-400" />
                              <span className="text-amber-400 font-bold">{row.mvp + row.best_gk}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {DEV && (
                <div className="border-t border-white/10 px-6 py-2">
                  <p className="text-[9px] text-zinc-700 break-all font-mono">
                    {photoUrl}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

function StatRow({
  icon,
  label,
  value,
  color,
  bgColor,
  borderColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg border ${borderColor} ${bgColor} px-3 py-2.5 hover:bg-opacity-20 transition-all`}>
      <div className="flex items-center gap-2">
        <div className={`${color} p-1.5`}>
          {icon}
        </div>
        <span className="text-sm text-zinc-300 font-medium">{label}</span>
      </div>
      <span className={`text-lg font-black ${color}`}>{value}</span>
    </div>
  );
}
