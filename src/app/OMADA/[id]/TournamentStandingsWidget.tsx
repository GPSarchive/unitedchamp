"use client";

import { motion } from "framer-motion";
import { Trophy, Crown, Medal, Award } from "lucide-react";
import { TeamImage } from "@/app/lib/OptimizedImage";

export type StandingRow = {
  stage_id: number;
  group_id: number | null;
  team_id: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number | null;
  team: {
    id: number;
    name: string;
    logo: string | null;
  };
};

interface TournamentStandingsWidgetProps {
  standings: StandingRow[];
  tournamentName: string;
  season?: string | null;
  highlightTeamId?: number;
  index: number;
}

export default function TournamentStandingsWidget({
  standings,
  tournamentName,
  season,
  highlightTeamId,
  index,
}: TournamentStandingsWidgetProps) {
  if (!standings || standings.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
      className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/5 via-purple-500/5 to-cyan-500/5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 bg-white/5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-fuchsia-400" />
          <h4
            className="text-sm font-bold text-white flex-1"
            style={{
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
            }}
          >
            {tournamentName}
          </h4>
          {season && (
            <span className="text-xs text-fuchsia-300 font-semibold px-2 py-0.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20">
              {season}
            </span>
          )}
        </div>
      </div>

      {/* Standings List */}
      <div className="px-2 py-2 space-y-1">
        {standings.map((standing, idx) => {
          const position = standing.rank ?? idx + 1;
          const isHighlighted = highlightTeamId === standing.team_id;
          const isTopThree = position <= 3;

          const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

          const getBadgeStyle = () => {
            switch (position) {
              case 1:
                return "bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950";
              case 2:
                return "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900";
              case 3:
                return "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100";
              default:
                return "bg-white/5 text-zinc-400";
            }
          };

          return (
            <motion.div
              key={standing.team_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.75 + index * 0.1 + idx * 0.03, duration: 0.3 }}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition-all ${
                isHighlighted
                  ? "bg-amber-500/15 border border-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                  : isTopThree
                  ? "bg-white/5 border border-white/10 hover:bg-white/10"
                  : "hover:bg-white/5"
              }`}
            >
              {/* Position Badge */}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${getBadgeStyle()}`}
              >
                {PositionIcon ? (
                  <PositionIcon className="h-3.5 w-3.5" />
                ) : (
                  position
                )}
              </div>

              {/* Team Logo */}
              <div className="relative h-8 w-8 overflow-hidden rounded-lg border border-white/20 bg-black/50 flex-shrink-0">
                {standing.team.logo ? (
                  <TeamImage
                    src={standing.team.logo}
                    alt={standing.team.name}
                    fill
                    objectFit="contain"
                    sizes="32px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-bold text-fuchsia-300">
                    {standing.team.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Team Name */}
              <span
                className={`text-xs font-semibold flex-1 truncate ${
                  isHighlighted ? "text-amber-200" : position === 1 ? "text-amber-200" : "text-zinc-200"
                }`}
              >
                {standing.team.name}
              </span>

              {/* Stats */}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-emerald-400 font-bold">{standing.won}N</span>
                <span className="text-cyan-400 font-bold">{standing.drawn}I</span>
                <span className="text-rose-400 font-bold">{standing.lost}H</span>
              </div>

              {/* Points */}
              <div
                className={`flex items-center justify-center rounded-md px-2 py-1 text-xs font-black min-w-[32px] ${
                  position === 1
                    ? "bg-gradient-to-r from-amber-400/20 to-yellow-500/20 text-amber-200 ring-1 ring-amber-400/40"
                    : isHighlighted
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/5 text-zinc-100"
                }`}
              >
                {standing.points}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
