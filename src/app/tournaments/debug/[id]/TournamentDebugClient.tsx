"use client";

import React, { useState } from "react";

type DebugData = {
  tournament: any;
  stages: any[];
  groups: any[];
  tournamentTeams: any[];
  allTeams: any[];
  matches: any[];
  standings: any[];
  stageSlots: any[];
};

export default function TournamentDebugClient({ data }: { data: DebugData }) {
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
  const [selectedStageFilter, setSelectedStageFilter] = useState<number | null>(null);
  const [recalculating, setRecalculating] = useState<Record<number, boolean>>({});
  const [recalcResults, setRecalcResults] = useState<Record<number, { success: boolean; message: string } | null>>({});

  const toggleStage = (stageId: number) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const expandAll = () => {
    setExpandedStages(new Set(data.stages.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedStages(new Set());
  };

  // Helper functions
  const getTeamName = (teamId: number | null) => {
    if (!teamId) return "N/A";
    const team = data.allTeams.find((t) => t.id === teamId);
    return team ? team.name : `Team #${teamId}`;
  };

  const getStageMatches = (stageId: number, groupId?: number | null) => {
    return data.matches.filter((m) => {
      if (m.stage_id !== stageId) return false;
      if (groupId !== undefined) {
        return m.group_id === groupId;
      }
      return true;
    });
  };

  const getStageStandings = (stageId: number, groupId?: number | null) => {
    return data.standings.filter((s) => {
      if (s.stage_id !== stageId) return false;
      if (groupId !== undefined) {
        return s.group_id === groupId;
      }
      return true;
    });
  };

  const getStageGroups = (stageId: number) => {
    return data.groups.filter((g) => g.stage_id === stageId);
  };

  const getStageSlots = (stageId: number, groupId?: number) => {
    return data.stageSlots.filter((s) => {
      if (s.stage_id !== stageId) return false;
      if (groupId !== undefined) {
        return s.group_id === groupId;
      }
      return true;
    });
  };

  const getTournamentTeamsForStage = (stageId: number) => {
    return data.tournamentTeams.filter((tt) => tt.stage_id === stageId);
  };

  const recalculateStandings = async (stageId: number) => {
    setRecalculating((prev) => ({ ...prev, [stageId]: true }));
    setRecalcResults((prev) => ({ ...prev, [stageId]: null }));

    try {
      const response = await fetch(`/api/stages/${stageId}/reseed?recompute=true&force=true`, {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        setRecalcResults((prev) => ({
          ...prev,
          [stageId]: { success: true, message: "✅ Standings recalculated successfully! Refresh the page to see updates." },
        }));

        // Auto-dismiss success message after 5 seconds
        setTimeout(() => {
          setRecalcResults((prev) => ({ ...prev, [stageId]: null }));
        }, 5000);
      } else {
        setRecalcResults((prev) => ({
          ...prev,
          [stageId]: { success: false, message: `❌ Error: ${result.error || "Unknown error"}` },
        }));
      }
    } catch (error) {
      setRecalcResults((prev) => ({
        ...prev,
        [stageId]: {
          success: false,
          message: `❌ Network error: ${error instanceof Error ? error.message : "Unknown error"}`
        },
      }));
    } finally {
      setRecalculating((prev) => ({ ...prev, [stageId]: false }));
    }
  };

  const diagnoseStage = (stage: any) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    const stageMatches = getStageMatches(stage.id);
    const stageStandings = getStageStandings(stage.id);
    const stageGroups = getStageGroups(stage.id);
    const stageSlots = getStageSlots(stage.id);
    const tournamentTeams = getTournamentTeamsForStage(stage.id);

    // Check for matches
    if (stageMatches.length === 0) {
      warnings.push("No matches found for this stage");
    } else {
      info.push(`${stageMatches.length} matches found`);

      const finishedMatches = stageMatches.filter((m) => m.status === "finished");
      const scheduledMatches = stageMatches.filter((m) => m.status === "scheduled");
      const postponedMatches = stageMatches.filter((m) => m.status === "postponed");

      info.push(`${finishedMatches.length} finished, ${scheduledMatches.length} scheduled, ${postponedMatches.length} postponed`);

      if (finishedMatches.length === 0) {
        warnings.push("No finished matches yet - standings will be empty until matches are played");
      }
    }

    // Check for standings
    if (stageStandings.length === 0) {
      issues.push("⚠️ NO STANDINGS DATA FOUND - This is likely why standings aren't displaying!");
    } else {
      info.push(`${stageStandings.length} standing records found`);

      // Check if all standings have valid data
      const emptyStandings = stageStandings.filter((s) => s.played === 0);
      if (emptyStandings.length === stageStandings.length) {
        warnings.push("All standings show 0 games played");
      }
    }

    // Check for groups (if applicable)
    if (stage.kind === "groups") {
      if (stageGroups.length === 0) {
        issues.push("Stage is 'groups' type but no groups are defined");
      } else {
        info.push(`${stageGroups.length} groups defined`);

        // Check each group
        stageGroups.forEach((group) => {
          const groupStandings = getStageStandings(stage.id, group.id);
          const groupMatches = getStageMatches(stage.id, group.id);

          if (groupStandings.length === 0) {
            issues.push(`Group "${group.name}" (ID: ${group.id}) has NO STANDINGS`);
          }
          if (groupMatches.length === 0) {
            warnings.push(`Group "${group.name}" has no matches`);
          }
        });
      }
    }

    // Check for stage slots vs tournament_teams
    if (stageSlots.length > 0) {
      info.push(`${stageSlots.length} stage slots defined`);
      const filledSlots = stageSlots.filter((s) => s.team_id !== null);
      info.push(`${filledSlots.length} slots filled with teams`);
    } else {
      warnings.push("No stage slots defined (teams might be assigned via tournament_teams only)");
    }

    if (tournamentTeams.length > 0) {
      info.push(`${tournamentTeams.length} teams assigned via tournament_teams`);
    }

    return { issues, warnings, info };
  };

  const stagesToDisplay = selectedStageFilter
    ? data.stages.filter((s) => s.id === selectedStageFilter)
    : data.stages;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 shadow-xl">
          <h1 className="text-3xl font-bold mb-2">🔍 Tournament Debug Dashboard</h1>
          <p className="text-blue-100">
            Tournament: <span className="font-semibold">{data.tournament.name}</span>
          </p>
          <p className="text-sm text-blue-200 mt-1">
            ID: {data.tournament.id} | Season: {data.tournament.season || "N/A"} | Status:{" "}
            {data.tournament.status}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-2xl font-bold text-blue-400">{data.stages.length}</div>
            <div className="text-sm text-gray-400">Stages</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-2xl font-bold text-green-400">{data.matches.length}</div>
            <div className="text-sm text-gray-400">Matches</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-2xl font-bold text-purple-400">{data.standings.length}</div>
            <div className="text-sm text-gray-400">Standing Records</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-2xl font-bold text-orange-400">{data.tournamentTeams.length}</div>
            <div className="text-sm text-gray-400">Teams</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex flex-wrap gap-4 items-center">
            <button
              onClick={expandAll}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-sm font-medium transition"
            >
              Collapse All
            </button>

            <div className="flex-1 min-w-[200px]">
              <select
                value={selectedStageFilter || ""}
                onChange={(e) =>
                  setSelectedStageFilter(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm"
              >
                <option value="">All Stages</option>
                {data.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name} (ID: {stage.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Stages Analysis</h2>

          {stagesToDisplay.map((stage) => {
            const isExpanded = expandedStages.has(stage.id);
            const diagnosis = diagnoseStage(stage);
            const hasIssues = diagnosis.issues.length > 0;
            const hasWarnings = diagnosis.warnings.length > 0;

            return (
              <div
                key={stage.id}
                className={`bg-gray-800 rounded-lg border-2 ${
                  hasIssues
                    ? "border-red-500"
                    : hasWarnings
                    ? "border-yellow-500"
                    : "border-green-500"
                } overflow-hidden`}
              >
                {/* Stage Header */}
                <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-750 transition">
                  <button
                    onClick={() => toggleStage(stage.id)}
                    className="flex items-center gap-4 flex-1"
                  >
                    <span className="text-2xl">
                      {hasIssues ? "🔴" : hasWarnings ? "🟡" : "🟢"}
                    </span>
                    <div className="text-left">
                      <h3 className="text-xl font-bold">
                        {stage.name}{" "}
                        <span className="text-sm text-gray-400">
                          (ID: {stage.id}, Order: {stage.ordering})
                        </span>
                      </h3>
                      <p className="text-sm text-gray-400">
                        Type: {stage.kind} | Config: {stage.config ? "Yes" : "No"}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    {/* Recalculate Button - Only show for league/groups stages */}
                    {(stage.kind === "league" || stage.kind === "groups") && (
                      <button
                        onClick={() => recalculateStandings(stage.id)}
                        disabled={recalculating[stage.id]}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          recalculating[stage.id]
                            ? "bg-gray-600 cursor-not-allowed"
                            : hasIssues
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                        title="Recalculate standings from all finished matches"
                      >
                        {recalculating[stage.id] ? "⏳ Calculating..." : "🔄 Recalculate Standings"}
                      </button>
                    )}

                    <button
                      onClick={() => toggleStage(stage.id)}
                      className="text-2xl"
                    >
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  </div>
                </div>

                {/* Stage Content */}
                {isExpanded && (
                  <div className="px-6 pb-6 space-y-6">
                    {/* Recalculation Result Message */}
                    {recalcResults[stage.id] && (
                      <div
                        className={`rounded-md p-4 ${
                          recalcResults[stage.id]!.success
                            ? "bg-green-900/30 border border-green-500"
                            : "bg-red-900/30 border border-red-500"
                        }`}
                      >
                        <p
                          className={`font-semibold ${
                            recalcResults[stage.id]!.success ? "text-green-300" : "text-red-300"
                          }`}
                        >
                          {recalcResults[stage.id]!.message}
                        </p>
                      </div>
                    )}

                    {/* Diagnosis */}
                    <div className="space-y-2">
                      {diagnosis.issues.length > 0 && (
                        <div className="bg-red-900/30 border border-red-500 rounded-md p-4">
                          <h4 className="font-bold text-red-400 mb-2">❌ Critical Issues:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {diagnosis.issues.map((issue, idx) => (
                              <li key={idx} className="text-red-300">
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {diagnosis.warnings.length > 0 && (
                        <div className="bg-yellow-900/30 border border-yellow-500 rounded-md p-4">
                          <h4 className="font-bold text-yellow-400 mb-2">⚠️ Warnings:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {diagnosis.warnings.map((warning, idx) => (
                              <li key={idx} className="text-yellow-300">
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {diagnosis.info.length > 0 && (
                        <div className="bg-blue-900/30 border border-blue-500 rounded-md p-4">
                          <h4 className="font-bold text-blue-400 mb-2">ℹ️ Information:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {diagnosis.info.map((info, idx) => (
                              <li key={idx} className="text-blue-300">
                                {info}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Groups (for group stages) */}
                    {stage.kind === "groups" && (
                      <div>
                        <h4 className="font-bold text-lg mb-3">📊 Groups</h4>
                        {getStageGroups(stage.id).length === 0 ? (
                          <p className="text-red-400">No groups defined!</p>
                        ) : (
                          <div className="space-y-4">
                            {getStageGroups(stage.id).map((group) => {
                              const groupStandings = getStageStandings(stage.id, group.id);
                              const groupMatches = getStageMatches(stage.id, group.id);

                              return (
                                <div
                                  key={group.id}
                                  className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                                >
                                  <h5 className="font-semibold text-lg mb-2">
                                    {group.name} (ID: {group.id}, Order: {group.ordering})
                                  </h5>

                                  <div className="grid md:grid-cols-2 gap-4 mt-3">
                                    <div>
                                      <p className="text-sm font-medium text-gray-300 mb-2">
                                        Matches: {groupMatches.length}
                                      </p>
                                      {groupMatches.length > 0 && (
                                        <div className="text-xs space-y-1">
                                          {groupMatches.slice(0, 3).map((m) => (
                                            <div
                                              key={m.id}
                                              className="bg-gray-800 p-2 rounded"
                                            >
                                              {getTeamName(m.team_a_id)} vs{" "}
                                              {getTeamName(m.team_b_id)} -{" "}
                                              <span
                                                className={
                                                  m.status === "finished"
                                                    ? "text-green-400"
                                                    : m.status === "postponed"
                                                    ? "text-yellow-400"
                                                    : "text-gray-400"
                                                }
                                              >
                                                {m.status}
                                              </span>
                                            </div>
                                          ))}
                                          {groupMatches.length > 3 && (
                                            <p className="text-gray-400">
                                              ... and {groupMatches.length - 3} more
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <p className="text-sm font-medium text-gray-300 mb-2">
                                        Standings: {groupStandings.length} teams
                                      </p>
                                      {groupStandings.length > 0 ? (
                                        <div className="text-xs space-y-1">
                                          {groupStandings.map((s) => (
                                            <div
                                              key={s.team_id}
                                              className="bg-gray-800 p-2 rounded flex justify-between"
                                            >
                                              <span>{getTeamName(s.team_id)}</span>
                                              <span className="text-gray-400">
                                                {s.points}pts ({s.played}P {s.won}W {s.drawn}D{" "}
                                                {s.lost}L)
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-red-400 text-sm">
                                          ❌ No standings data!
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* League/Knockout Standings */}
                    {(stage.kind === "league" || stage.kind === "knockout") && (
                      <div>
                        <h4 className="font-bold text-lg mb-3">📊 Standings</h4>
                        {getStageStandings(stage.id).length === 0 ? (
                          <div className="bg-red-900/30 border border-red-500 rounded-md p-4">
                            <p className="text-red-400 font-semibold">
                              ❌ No standings data found for this stage!
                            </p>
                            <p className="text-red-300 text-sm mt-2">
                              This is likely why the standings table isn't displaying on the
                              tournament page.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-gray-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-600">
                                <tr>
                                  <th className="px-3 py-2 text-left">Rank</th>
                                  <th className="px-3 py-2 text-left">Team</th>
                                  <th className="px-3 py-2 text-center">P</th>
                                  <th className="px-3 py-2 text-center">W</th>
                                  <th className="px-3 py-2 text-center">D</th>
                                  <th className="px-3 py-2 text-center">L</th>
                                  <th className="px-3 py-2 text-center">GF</th>
                                  <th className="px-3 py-2 text-center">GA</th>
                                  <th className="px-3 py-2 text-center">GD</th>
                                  <th className="px-3 py-2 text-center">Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getStageStandings(stage.id).map((s, idx) => (
                                  <tr
                                    key={`${s.team_id}-${s.group_id}`}
                                    className={idx % 2 === 0 ? "bg-gray-750" : ""}
                                  >
                                    <td className="px-3 py-2">{s.rank || idx + 1}</td>
                                    <td className="px-3 py-2">{getTeamName(s.team_id)}</td>
                                    <td className="px-3 py-2 text-center">{s.played}</td>
                                    <td className="px-3 py-2 text-center">{s.won}</td>
                                    <td className="px-3 py-2 text-center">{s.drawn}</td>
                                    <td className="px-3 py-2 text-center">{s.lost}</td>
                                    <td className="px-3 py-2 text-center">{s.gf}</td>
                                    <td className="px-3 py-2 text-center">{s.ga}</td>
                                    <td className="px-3 py-2 text-center">{s.gd}</td>
                                    <td className="px-3 py-2 text-center font-bold">
                                      {s.points}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Matches Summary */}
                    <div>
                      <h4 className="font-bold text-lg mb-3">⚽ Matches</h4>
                      {getStageMatches(stage.id).length === 0 ? (
                        <p className="text-yellow-400">No matches found for this stage</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="bg-green-900/30 border border-green-600 rounded p-3 text-center">
                              <div className="text-2xl font-bold text-green-400">
                                {
                                  getStageMatches(stage.id).filter((m) => m.status === "finished")
                                    .length
                                }
                              </div>
                              <div className="text-gray-300">Finished</div>
                            </div>
                            <div className="bg-blue-900/30 border border-blue-600 rounded p-3 text-center">
                              <div className="text-2xl font-bold text-blue-400">
                                {
                                  getStageMatches(stage.id).filter(
                                    (m) => m.status === "scheduled"
                                  ).length
                                }
                              </div>
                              <div className="text-gray-300">Scheduled</div>
                            </div>
                            <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 text-center">
                              <div className="text-2xl font-bold text-yellow-400">
                                {
                                  getStageMatches(stage.id).filter(
                                    (m) => m.status === "postponed"
                                  ).length
                                }
                              </div>
                              <div className="text-gray-300">Postponed</div>
                            </div>
                          </div>

                          <details className="bg-gray-700 rounded-lg p-4">
                            <summary className="cursor-pointer font-semibold">
                              View all matches ({getStageMatches(stage.id).length})
                            </summary>
                            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                              {getStageMatches(stage.id).map((match) => (
                                <div
                                  key={match.id}
                                  className="bg-gray-800 rounded p-3 text-sm"
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-medium">
                                        {getTeamName(match.team_a_id)}
                                      </span>
                                      {match.status === "finished" && (
                                        <span className="mx-2 font-bold">
                                          {match.team_a_score} - {match.team_b_score}
                                        </span>
                                      )}
                                      {match.status !== "finished" && (
                                        <span className="mx-2 text-gray-500">vs</span>
                                      )}
                                      <span className="font-medium">
                                        {getTeamName(match.team_b_id)}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        match.status === "finished"
                                          ? "bg-green-600"
                                          : match.status === "postponed"
                                          ? "bg-yellow-600"
                                          : "bg-gray-600"
                                      }`}
                                    >
                                      {match.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    ID: {match.id} | Group: {match.group_id || "N/A"} | Round:{" "}
                                    {match.round || "N/A"} | Matchday: {match.matchday || "N/A"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>

                    {/* Raw Data */}
                    <details className="bg-gray-700 rounded-lg p-4">
                      <summary className="cursor-pointer font-semibold">
                        🔍 View Raw Stage Data
                      </summary>
                      <pre className="mt-3 text-xs bg-gray-900 p-4 rounded overflow-x-auto">
                        {JSON.stringify(stage, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Raw Data Section */}
        <details className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <summary className="cursor-pointer font-bold text-xl">
            📦 View All Raw Data (Advanced)
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Tournament</h3>
              <pre className="text-xs bg-gray-900 p-4 rounded overflow-x-auto">
                {JSON.stringify(data.tournament, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">All Standings</h3>
              <pre className="text-xs bg-gray-900 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(data.standings, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">All Matches</h3>
              <pre className="text-xs bg-gray-900 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(data.matches, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Stage Slots</h3>
              <pre className="text-xs bg-gray-900 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(data.stageSlots, null, 2)}
              </pre>
            </div>
          </div>
        </details>

        {/* Footer with recommendations */}
        <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-3">💡 Common Issues & Solutions</h3>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold text-blue-300">Issue: No standings data found</h4>
              <p className="text-gray-300 mt-1">
                <strong>Cause:</strong> The stage_standings table is empty for this stage.
                <br />
                <strong>Solution:</strong> You need to calculate and insert standings data. This
                typically happens after matches are marked as "finished". Check if your backend
                has a function to calculate standings from match results.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-300">
                Issue: Standings exist but show 0 games
              </h4>
              <p className="text-gray-300 mt-1">
                <strong>Cause:</strong> Standings records exist but haven't been updated with
                match results.
                <br />
                <strong>Solution:</strong> Trigger a standings recalculation after matches are
                finished.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-300">
                Issue: No matches for stage/group
              </h4>
              <p className="text-gray-300 mt-1">
                <strong>Cause:</strong> Matches haven't been created for this stage yet.
                <br />
                <strong>Solution:</strong> Use the tournament wizard to generate matches for this
                stage.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-300">
                Issue: Group stage has no groups
              </h4>
              <p className="text-gray-300 mt-1">
                <strong>Cause:</strong> Stage is marked as "groups" but no groups are defined in
                tournament_groups table.
                <br />
                <strong>Solution:</strong> Create groups for this stage in the tournament setup.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
