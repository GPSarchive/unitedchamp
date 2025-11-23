"use client";

import React from "react";
import type { Stage } from "../useTournamentData";
import { useTournamentData } from "../useTournamentData";

const LeagueStage: React.FC<{ stage: Stage }> = ({ stage }) => {
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

  const { upcomingMatches, finishedMatches } = React.useMemo(() => {
    if (!matches) return { upcomingMatches: [], finishedMatches: [] };

    const todayISO = new Date().toISOString();

    const stageMatches = matches.filter((m) => m.stageIdx === stageIdx);

    const upcoming = stageMatches
      .filter((m) => m.status === "scheduled" && (m.match_date ?? "") >= todayISO)
      .sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? ""));

    const finished = stageMatches
      .filter((m) => m.status === "finished")
      .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""));

    return { upcomingMatches: upcoming, finishedMatches: finished };
  }, [matches, stageIdx]);

  return (
    <div className="space-y-6">
      {/* Standings Table */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur shadow-sm overflow-hidden hover:border-[#FFD700]/20 transition-all duration-200">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">
            Βαθμολογία ({stageStandings.length} ομάδες)
          </h3>
        </div>

        {stageStandings.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-[#FFD700] font-semibold mb-2">Το τουρνουά ξεκίνησε!</div>
            <div className="text-sm text-white/60">Ετοιμοι Για Δράση ;</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/[0.03]">
                <tr className="text-xs font-semibold text-white/60">
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
              <tbody className="divide-y divide-white/5">
                {stageStandings.map((standing, idx) => (
                  <tr key={standing.team_id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-white">
                      {standing.rank ?? idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {getTeamLogo(standing.team_id) && (
                          <img
                            src={getTeamLogo(standing.team_id)!}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-white/10"
                          />
                        )}
                        <span className="font-medium text-white">
                          {getTeamName(standing.team_id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-white/70">{standing.played}</td>
                    <td className="px-4 py-3 text-center text-sm text-green-400 font-semibold">
                      {standing.won}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-white/50">{standing.drawn}</td>
                    <td className="px-4 py-3 text-center text-sm text-red-400">{standing.lost}</td>
                    <td className="px-4 py-3 text-center text-sm text-white/70">{standing.gf}</td>
                    <td className="px-4 py-3 text-center text-sm text-white/70">{standing.ga}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-white">
                      {standing.gd > 0 ? "+" : ""}
                      {standing.gd}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-[#FFD700]">
                      {standing.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Matches Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Matches */}
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur shadow-sm overflow-hidden hover:border-[#FFD700]/20 transition-all duration-200">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Επερχόμενοι Αγώνες</h3>
            <span className="text-xs text-white/50">{upcomingMatches.length} σύνολο</span>
          </div>

          <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
            {upcomingMatches.length === 0 ? (
              <div className="p-6 text-center text-white/60">Δεν υπάρχουν επερχόμενοι αγώνες.</div>
            ) : (
              upcomingMatches.slice(0, 5).map((match) => (
                <div key={match.db_id} className="p-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getTeamLogo(match.team_a_id ?? 0) && (
                        <img src={getTeamLogo(match.team_a_id ?? 0)!} alt="" className="w-8 h-8 rounded-full object-cover" />
                      )}
                      <span className="font-medium text-white truncate">
                        {getTeamName(match.team_a_id ?? 0)}
                      </span>
                    </div>

                    <div className="text-lg font-bold text-white/50">VS</div>

                    <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                      <span className="font-medium text-white truncate">
                        {getTeamName(match.team_b_id ?? 0)}
                      </span>
                      {getTeamLogo(match.team_b_id ?? 0) && (
                        <img src={getTeamLogo(match.team_b_id ?? 0)!} alt="" className="w-8 h-8 rounded-full object-cover" />
                      )}
                    </div>
                  </div>

                  {match.match_date && (
                    <div className="mt-2 text-xs text-white/50 text-center">
                      {new Date(match.match_date).toLocaleString("el-GR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Finished Matches */}
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur shadow-sm overflow-hidden hover:border-[#FFD700]/20 transition-all duration-200">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Ολοκληρωμένοι Αγώνες</h3>
            <span className="text-xs text-white/50">{finishedMatches.length} σύνολο</span>
          </div>

          <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
            {finishedMatches.length === 0 ? (
              <div className="p-6 text-center text-white/60">Δεν υπάρχουν ολοκληρωμένοι αγώνες ακόμη.</div>
            ) : (
              finishedMatches.slice(0, 5).map((match) => (
                <div key={match.db_id} className="p-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getTeamLogo(match.team_a_id ?? 0) && (
                        <img src={getTeamLogo(match.team_a_id ?? 0)!} alt="" className="w-8 h-8 rounded-full object-cover" />
                      )}
                      <span className="font-medium text-white truncate">
                        {getTeamName(match.team_a_id ?? 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-2xl font-bold ${
                          match.winner_team_id === match.team_a_id ? "text-[#FFD700]" : "text-white/40"
                        }`}
                      >
                        {match.team_a_score ?? 0}
                      </span>
                      <span className="text-white/40">-</span>
                      <span
                        className={`text-2xl font-bold ${
                          match.winner_team_id === match.team_b_id ? "text-[#FFD700]" : "text-white/40"
                        }`}
                      >
                        {match.team_b_score ?? 0}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                      <span className="font-medium text-white truncate">
                        {getTeamName(match.team_b_id ?? 0)}
                      </span>
                      {getTeamLogo(match.team_b_id ?? 0) && (
                        <img src={getTeamLogo(match.team_b_id ?? 0)!} alt="" className="w-8 h-8 rounded-full object-cover" />
                      )}
                    </div>
                  </div>

                  {match.match_date && (
                    <div className="mt-2 text-xs text-white/50 text-center">
                      {new Date(match.match_date).toLocaleString("el-GR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        timeZone: "UTC",
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueStage;






