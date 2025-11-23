"use client";

import React from "react";
import { useStages } from "../useStages";
import type { Stage } from "../useTournamentData";
import { useTournamentData } from "../useTournamentData";

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
      <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-lg">
        <p className="text-red-400 font-semibold">⚠️ Configuration Error</p>
        <p className="text-sm text-red-300/80 mt-2">
          Stage index not found in store.
        </p>
      </div>
    );
  }

  const GroupSection: React.FC<{ group: any; groupIdx: number }> = ({ group, groupIdx }) => {
    // Filter standings for this group
    const groupStandings = React.useMemo(() => {
      return (standings ?? [])
        .filter(s => s.stage_id === stage.id && s.group_id === group.id)
        .sort((a, b) => {
          if (a.rank && b.rank) return a.rank - b.rank;
          if (a.points !== b.points) return b.points - a.points;
          if (a.gd !== b.gd) return b.gd - a.gd;
          return b.gf - a.gf;
        });
    }, [group.id]);

    // Filter matches for this group
    const { upcomingMatches, finishedMatches } = React.useMemo(() => {
      const todayISO = new Date().toISOString();
      const groupMatches = (matches ?? []).filter(
        m => m.stageIdx === stageIdx && m.groupIdx === groupIdx
      );
      
      const upcoming = groupMatches
        .filter(m => m.status === 'scheduled' && (m.match_date ?? '') >= todayISO)
        .sort((a, b) => (a.match_date ?? '').localeCompare(b.match_date ?? ''))
        .slice(0, 3);
      
      const finished = groupMatches
        .filter(m => m.status === 'finished')
        .sort((a, b) => (b.match_date ?? '').localeCompare(a.match_date ?? ''))
        .slice(0, 3);
      
      return { upcomingMatches: upcoming, finishedMatches: finished };
    }, [groupIdx]);

    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur shadow-sm overflow-hidden hover:border-[#FFD700]/20 transition-all duration-200">
        {/* Group Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[#FFD700]/10 to-transparent">
          <h3 className="text-xl font-bold text-white">
            {group.name}
          </h3>
        </div>

        {/* Standings */}
        <div className="p-4">
          <h4 className="text-sm font-semibold text-white/80 mb-3">
            Βαθμολογία
          </h4>

          {groupStandings.length === 0 ? (
            <div className="text-center py-4 text-white/50 text-sm">
              Δεν υπάρχουν βαθμολογίες
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-white/60">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Ομάδα</th>
                    <th className="px-2 py-2 text-center">Αγ</th>
                    <th className="px-2 py-2 text-center">Π</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {groupStandings.map((standing, idx) => (
                    <tr key={standing.team_id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-2 py-2 font-bold text-white">
                        {standing.rank ?? idx + 1}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          {getTeamLogo(standing.team_id) && (
                            <img
                              src={getTeamLogo(standing.team_id)!}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          )}
                          <span className="font-medium text-white truncate">
                            {getTeamName(standing.team_id)}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-white/70">
                        {standing.played}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-[#FFD700]">
                        {standing.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Matches */}
        <div className="border-t border-white/10 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Upcoming */}
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-2">
                Επερχόμενοι
              </h4>
              {upcomingMatches.length === 0 ? (
                <p className="text-xs text-white/50">Κανένας</p>
              ) : (
                <div className="space-y-2">
                  {upcomingMatches.map(m => (
                    <div key={m.db_id} className="text-xs p-2 bg-white/[0.03] border border-white/5 rounded hover:bg-white/[0.05] transition-colors">
                      <div className="font-medium text-white">
                        {getTeamName(m.team_a_id ?? 0)} vs {getTeamName(m.team_b_id ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Finished */}
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-2">
                Ολοκληρωμένοι
              </h4>
              {finishedMatches.length === 0 ? (
                <p className="text-xs text-white/50">Κανένας</p>
              ) : (
                <div className="space-y-2">
                  {finishedMatches.map(m => (
                    <div key={m.db_id} className="text-xs p-2 bg-white/[0.03] border border-white/5 rounded hover:bg-white/[0.05] transition-colors">
                      <div className="font-medium text-white">
                        {getTeamName(m.team_a_id ?? 0)} {m.team_a_score}-{m.team_b_score} {getTeamName(m.team_b_id ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {sortedGroups.length === 0 ? (
        <div className="text-center py-8 text-white/60">
          Δεν υπάρχουν όμιλοι για αυτό το στάδιο.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {sortedGroups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              groupIdx={group.ordering - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupsStage;