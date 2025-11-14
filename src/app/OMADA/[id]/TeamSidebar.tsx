// app/OMADA/[id]/TeamSidebar.tsx
'use client';

import { motion } from "framer-motion";
import { FaTrophy, FaUsers, FaHashtag, FaChartLine, FaShieldAlt } from "react-icons/fa";
import { Trophy, Crown } from "lucide-react";
import { Team } from "@/app/lib/types";
import { TeamImage } from "@/app/lib/OptimizedImage";
import TournamentStandingsWidget, { type StandingRow } from "./TournamentStandingsWidget";

type TournamentWithStandings = {
  id: number;
  name: string | null;
  season: string | null;
  status?: string | null;
  winner_team_id?: number | null;
  standings: StandingRow[];
};

export default function TeamSidebar({
  team,
  tournamentsWithStandings,
  wins,
  errors,
}: {
  team: Team;
  tournamentsWithStandings: TournamentWithStandings[];
  wins: { id: number; name: string | null; season: string | null }[];
  errors?: { membership?: string; wins?: string };
}) {
  const membershipCount = tournamentsWithStandings.length;
  const winsCount = wins.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 120 }}
      className="sticky top-8 h-fit space-y-6 rounded-3xl border border-white/20 bg-black/50 p-6 shadow-lg backdrop-blur-sm relative isolate overflow-hidden"
    >
      {/* Floating Orbs - Neon Glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-32 h-64 w-64 rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.4), transparent)" }}
        animate={{ x: [0, -15, 8, 0], y: [0, 12, -8, 0] }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-32 h-72 w-72 rounded-full blur-3xl opacity-15"
        style={{ background: "radial-gradient(closest-side, rgba(249,115,22,0.35), transparent)" }}
        animate={{ x: [0, 12, -10, 0], y: [0, -15, 10, 0] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
      />

      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
        className="relative mx-auto w-48 h-48 overflow-hidden rounded-full border-4 border-white/30 shadow-[0_0_40px_rgba(251,191,36,0.3)] ring-2 ring-amber-400/20 group"
      >
        {team.logo ? (
          <>
            <TeamImage
              src={team.logo}
              alt={team.name}
              fill
              objectFit="contain"
              sizes="192px"
              className="transition-transform duration-500 group-hover:scale-110"
              priority
            />
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/10 to-orange-500/10">
            <FaShieldAlt className="h-20 w-20 text-amber-400/40" />
          </div>
        )}
      </motion.div>

      {/* Name and Established */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-center relative z-10"
      >
        <h1
          className="text-3xl font-extrabold text-white mb-2"
          style={{
            textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
          }}
        >
          {team.name}
        </h1>
        <p
          className="text-sm text-white/70"
          style={{
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          Ίδρυση: {team.created_at ? new Date(team.created_at).toLocaleDateString('el-GR') : "Άγνωστο"}
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="grid grid-cols-2 gap-3 relative z-10"
      >
        <StatCard icon={<FaHashtag />} label="Team ID" value={team.am ?? "—"} delay={0.5} />
        <StatCard icon={<FaChartLine />} label="Βαθμοί" value={team.season_score ?? 0} delay={0.55} />
        <StatCard icon={<FaUsers />} label="Τουρνουά" value={membershipCount} delay={0.6} />
        <StatCard icon={<Trophy className="h-5 w-5" />} label="Τίτλοι" value={winsCount} highlight delay={0.65} />
      </motion.div>

      {/* Tournament Standings */}
      {membershipCount > 0 && (
        <div className="relative z-10 space-y-4">
          {tournamentsWithStandings.map((tournament, index) => (
            <TournamentStandingsWidget
              key={tournament.id}
              standings={tournament.standings}
              tournamentName={tournament.name ?? "Τουρνουά"}
              season={tournament.season}
              highlightTeamId={team.id}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Championships List */}
      {winsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="relative z-10"
        >
          <h3
            className="text-lg font-bold text-white mb-3 flex items-center gap-2"
            style={{
              textShadow: '1px 1px 3px rgba(0,0,0,0.8)'
            }}
          >
            <Crown className="h-5 w-5 text-amber-400" /> Πρωταθλήματα
          </h3>
          <ul className="space-y-2">
            {wins.map((w, index) => (
              <motion.li
                key={w.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.85 + index * 0.05, duration: 0.4 }}
                className="text-sm text-white bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-400/30 hover:border-amber-400/60 hover:shadow-[0_0_20px_rgba(251,191,36,0.25)] transition-all rounded-lg px-3 py-2.5 flex items-center justify-between"
              >
                <span className="truncate font-semibold">{w.name ?? "Πρωταθλητής"}</span>
                {w.season && (
                  <span className="ml-2 shrink-0 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-amber-200 text-xs font-bold">
                    <Trophy className="h-3 w-3" />
                    {w.season}
                  </span>
                )}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Errors */}
      {errors?.membership && (
        <p className="text-red-400/90 text-sm relative z-10">Σφάλμα: {errors.membership}</p>
      )}
      {errors?.wins && (
        <p className="text-red-400/90 text-sm relative z-10">Σφάλμα: {errors.wins}</p>
      )}
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight = false,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, type: "spring" }}
      whileHover={{ scale: 1.05, y: -3 }}
      className={`p-4 rounded-xl text-center backdrop-blur-sm transition-all ${
        highlight
          ? "bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border border-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
          : "bg-white/5 border border-white/20"
      }`}
    >
      <div className={`mx-auto mb-2 ${highlight ? "text-amber-400" : "text-cyan-400"}`}>
        {icon}
      </div>
      <p
        className="text-xs text-white/70 mb-1"
        style={{
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
        }}
      >
        {label}
      </p>
      <p
        className={`text-xl font-black ${highlight ? "text-amber-300" : "text-white"}`}
        style={{
          textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
        }}
      >
        {value}
      </p>
    </motion.div>
  );
}
