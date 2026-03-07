"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useStages } from "../useStages";
import type { Stage, Standing } from "../useTournamentData";
import { useTournamentData } from "../useTournamentData";
import MatchCarousel from "./MatchCarousel";

const GroupsStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  const { getGroupsForStage } = useStages();
  const sortedGroups = getGroupsForStage(stage.id);
  const stageIdx = useTournamentData((s) => s.ids.stageIndexById[stage.id]);
  const standings = useTournamentData((s) => s.standings);
  const matches = useTournamentData((s) => s.matches);
  const getTeamName = useTournamentData((s) => s.getTeamName);
  const getTeamLogo = useTournamentData((s) => s.getTeamLogo);

  if (stageIdx === undefined) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-red-400 text-sm font-medium">⚠️ Stage index not found in store.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Group Standings */}
      {sortedGroups.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-sm">
          Δεν υπάρχουν όμιλοι για αυτό το στάδιο.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {sortedGroups.map((group, idx) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <GroupTable
                group={group}
                stageId={stage.id}
                standings={standings}
                getTeamName={getTeamName}
                getTeamLogo={getTeamLogo}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Matches Carousel */}
      <MatchCarousel
        stageIdx={stageIdx}
        matches={matches ?? []}
        getTeamName={getTeamName}
        getTeamLogo={getTeamLogo}
      />
    </div>
  );
};

/* ─── Group Table ─── */
function GroupTable({
  group,
  stageId,
  standings,
  getTeamName,
  getTeamLogo,
}: {
  group: { id: number; name: string };
  stageId: number;
  standings: Standing[] | null;
  getTeamName: (id: number) => string;
  getTeamLogo: (id: number) => string | null;
}) {
  const groupStandings = useMemo(() => {
    return (standings ?? [])
      .filter((s) => s.stage_id === stageId && s.group_id === group.id)
      .sort((a, b) => {
        if (a.rank && b.rank) return a.rank - b.rank;
        if (a.points !== b.points) return b.points - a.points;
        if (a.gd !== b.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
  }, [standings, stageId, group.id]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
      {/* Group Header */}
      <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
        <h4 className="text-sm font-bold text-white/80">{group.name}</h4>
      </div>

      {groupStandings.length === 0 ? (
        <div className="p-6 text-center text-white/25 text-xs">
          Δεν υπάρχουν βαθμολογίες
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30 w-10">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/30">Ομάδα</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">ΑΓ</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">Ν</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">Ι</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">Η</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">ΔΤ</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">ΒΘ</th>
              </tr>
            </thead>
            <tbody>
              {groupStandings.map((standing, idx) => (
                <tr
                  key={standing.team_id}
                  className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors duration-150 group"
                >
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-bold ${
                      idx < 2 ? 'text-emerald-400/80' : 'text-white/30'
                    }`}>
                      {standing.rank ?? idx + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {getTeamLogo(standing.team_id) && (
                        <img
                          src={getTeamLogo(standing.team_id)!}
                          alt=""
                          className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10"
                        />
                      )}
                      <span className="font-semibold text-white/80 text-xs truncate">
                        {getTeamName(standing.team_id)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-white/40 tabular-nums">{standing.played}</td>
                  <td className="px-3 py-3 text-center text-xs text-emerald-400/70 font-medium tabular-nums">{standing.won}</td>
                  <td className="px-3 py-3 text-center text-xs text-white/35 tabular-nums">{standing.drawn}</td>
                  <td className="px-3 py-3 text-center text-xs text-red-400/50 tabular-nums">{standing.lost}</td>
                  <td className="px-3 py-3 text-center text-xs text-white/50 font-medium tabular-nums">
                    {standing.gd > 0 ? "+" : ""}{standing.gd}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-bold text-emerald-400 tabular-nums">
                      {standing.points}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default GroupsStage;
