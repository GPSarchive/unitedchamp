"use client";

import React from "react";
import type { Stage } from "../useTournamentData";
import { useTournamentData } from "../useTournamentData";
import MatchCarousel from "./MatchCarousel";
import { SmallTeamLogo } from "@/app/components/TeamLogo";

const LeagueStage: React.FC<{ stage: Stage }> = ({ stage }) => {
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
          Stage index not found. ID: {stage.id}, Ordering: {stage.ordering}
        </p>
      </div>
    );
  }

  const stageStandings = React.useMemo(() => {
    if (!standings) return [];
    const filtered = standings.filter((s) => s.stage_id === stage.id);
    if (filtered.length === 0) return [];
    return filtered.sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.points !== b.points) return b.points - a.points;
      if (a.gd !== b.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
  }, [standings, stage.id]);

  return (
    <div className="space-y-8">
      {/* Standings Table */}
      <div className="bg-black text-white rounded-lg shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/10">
          <h3 className="text-2xl font-bold">
            Βαθμολογία ({stageStandings.length} ομάδες)
          </h3>
        </div>

        {stageStandings.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-orange-400 font-semibold mb-2 text-xl">Το τουρνουά ξεκίνησε!</div>
            <div className="text-sm text-gray-400">Ετοιμοι Για Δράση ;</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-4 text-left">#</th>
                  <th className="px-4 py-4 text-left">Ομάδα</th>
                  <th className="px-4 py-4 text-center">Αγώνες</th>
                  <th className="px-4 py-4 text-center">Νίκες</th>
                  <th className="px-4 py-4 text-center">Ισοπαλίες</th>
                  <th className="px-4 py-4 text-center">Ηττες</th>
                  <th className="px-4 py-4 text-center">Γκολ Υπερ</th>
                  <th className="px-4 py-4 text-center">Γκολ Κατα</th>
                  <th className="px-4 py-4 text-center">ΔΤ</th>
                  <th className="px-4 py-4 text-center font-bold">Πόντοι</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {stageStandings.map((standing, idx) => (
                  <tr key={standing.team_id} className="hover:bg-orange-500/10 transition-colors">
                    <td className="px-4 py-4 text-sm font-bold text-orange-400">
                      {standing.rank ?? idx + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <SmallTeamLogo
                          src={getTeamLogo(standing.team_id)}
                          alt={getTeamName(standing.team_id)}
                          borderStyle="normal"
                        />
                        <span className="font-semibold text-white">
                          {getTeamName(standing.team_id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-gray-300">{standing.played}</td>
                    <td className="px-4 py-4 text-center text-sm text-green-400 font-semibold">
                      {standing.won}
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-gray-400">{standing.drawn}</td>
                    <td className="px-4 py-4 text-center text-sm text-red-400">{standing.lost}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-300">{standing.gf}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-300">{standing.ga}</td>
                    <td className="px-4 py-4 text-center text-sm font-medium text-white">
                      {standing.gd > 0 ? "+" : ""}
                      {standing.gd}
                    </td>
                    <td className="px-4 py-4 text-center text-lg font-bold text-orange-400">
                      {standing.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

export default LeagueStage;






