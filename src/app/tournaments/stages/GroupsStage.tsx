"use client";

import React from "react";
import { useStages } from "../useStages";
import type { Stage } from "../useTournamentData";
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
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
        <p className="text-red-800 dark:text-red-400 font-semibold">⚠️ Configuration Error</p>
        <p className="text-sm text-red-600 dark:text-red-300 mt-2">
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

    return (
      <div className="bg-black text-white rounded-lg shadow-xl overflow-hidden">
        {/* Group Header */}
        <div className="px-6 py-4 border-b border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/10">
          <h3 className="text-xl font-bold">
            {group.name}
          </h3>
        </div>

        {/* Standings */}
        <div className="p-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Βαθμολογία
          </h4>

          {groupStandings.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              Δεν υπάρχουν βαθμολογίες
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-3 text-left">#</th>
                    <th className="px-3 py-3 text-left">Ομάδα</th>
                    <th className="px-3 py-3 text-center">Αγ</th>
                    <th className="px-3 py-3 text-center">Π</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {groupStandings.map((standing, idx) => (
                    <tr key={standing.team_id} className="hover:bg-orange-500/10 transition-colors">
                      <td className="px-3 py-3 font-bold text-orange-400">
                        {standing.rank ?? idx + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {getTeamLogo(standing.team_id) && (
                            <img
                              src={getTeamLogo(standing.team_id)!}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border-2 border-orange-500"
                            />
                          )}
                          <span className="font-semibold text-white truncate">
                            {getTeamName(standing.team_id)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-300">
                        {standing.played}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-orange-400">
                        {standing.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Group Standings */}
      {sortedGroups.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
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

      {/* Matches Carousel - Below standings */}
      <MatchCarousel
        stageIdx={stageIdx}
        matches={matches ?? []}
        getTeamName={getTeamName}
        getTeamLogo={getTeamLogo}
      />
    </div>
  );
};

export default GroupsStage;