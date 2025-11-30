"use client";

import React from "react";
import type { Stage } from "../useTournamentData";
import { useTournamentData } from "../useTournamentData";
import MatchCarousel from "./MatchCarousel";

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
      {/* Matches Carousel - Now at the top */}
      <MatchCarousel
        stageIdx={stageIdx}
        matches={matches ?? []}
        getTeamName={getTeamName}
        getTeamLogo={getTeamLogo}
      />

      {/* Standings Table - Separated from matches */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Βαθμολογία ({stageStandings.length} ομάδες)
          </h3>
        </div>

        {stageStandings.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-red-600 dark:text-red-400 font-semibold mb-2">Το τουρνουά ξεκίνησε!</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Ετοιμοι Για Δράση ;</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Ομάδα</th>
                  <th className="px-4 py-3 text-center">Αγώνες</th>
                  <th className="px-4 py-3 text-center">Νίκες</th>
                  <th className="px-4 py-3 text-center">Ισοπαλίες</th>
                  <th className="px-4 py-3 text-center">Ηττες</th>
                  <th className="px-4 py-3 text-center">Γκολ Υπερ</th>
                  <th className="px-4 py-3 text-center">Γκολ Κατα</th>
                  <th className="px-4 py-3 text-center">ΔΤ</th>
                  <th className="px-4 py-3 text-center font-bold">Πόντοι</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {stageStandings.map((standing, idx) => (
                  <tr key={standing.team_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {standing.rank ?? idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {getTeamLogo(standing.team_id) && (
                          <img
                            src={getTeamLogo(standing.team_id)!}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        )}
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {getTeamName(standing.team_id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">{standing.played}</td>
                    <td className="px-4 py-3 text-center text-sm text-green-600 dark:text-green-400 font-semibold">
                      {standing.won}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">{standing.drawn}</td>
                    <td className="px-4 py-3 text-center text-sm text-red-600 dark:text-red-400">{standing.lost}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">{standing.gf}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">{standing.ga}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-slate-900 dark:text-slate-100">
                      {standing.gd > 0 ? "+" : ""}
                      {standing.gd}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-blue-600 dark:text-blue-400">
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

export default LeagueStage;






