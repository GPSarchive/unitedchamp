"use client";

import React, { useMemo } from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData";

type Match = {
  db_id?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  status?: "scheduled" | "finished" | null;
  match_date?: string | null;
};

type KnockoutBracketProps = {
  matches: Match[];
};

const KnockoutBracket: React.FC<KnockoutBracketProps> = ({ matches }) => {
  const teams = useTournamentData((state) => state.teams);

  const getTeamName = (id: number | null) => {
    if (!id) return "TBD";
    const team = teams?.find((t) => t.id === id);
    return team?.name ?? "TBD";
  };

  const getTeamLogo = (id: number | null) => {
    if (!id) return null;
    const team = teams?.find((t) => t.id === id);
    return team?.logo ?? null;
  };

  // Organize matches by round
  const rounds = useMemo(() => {
    const roundMap = new Map<number, Match[]>();

    matches.forEach((match) => {
      const round = match.round ?? 1;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(match);
    });

    // Sort matches within each round by bracket_pos
    roundMap.forEach((matchList) => {
      matchList.sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0));
    });

    // Convert to array and sort by round number
    return Array.from(roundMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([roundNum, matchList]) => ({ roundNum, matches: matchList }));
  }, [matches]);

  const getRoundName = (roundNum: number, totalRounds: number) => {
    const remaining = totalRounds - roundNum + 1;
    if (remaining === 1) return "ΤΕΛΙΚΟΣ";
    if (remaining === 2) return "ΗΜΙΤΕΛΙΚΟΙ";
    if (remaining === 3) return "ΠΡΟΗΜΙΤΕΛΙΚΟΙ";
    if (remaining === 4) return "ΦΑΣΗ ΤΩΝ 16";
    return `ΓΥΡΟΣ ${roundNum}`;
  };

  if (matches.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <span className="text-4xl">🏆</span>
          </div>
          <p className="text-white/60 text-lg">Δεν υπάρχουν αγώνες νοκ-άουτ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Rounds */}
      <div className="space-y-16">
        {rounds.map(({ roundNum, matches: roundMatches }) => (
          <div key={roundNum}>
            {/* Round Title */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-[#FFD700] via-[#E6BE00] to-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.4)]">
                <span className="text-2xl">🏆</span>
                <h3 className="text-xl font-black text-black tracking-wider">
                  {getRoundName(roundNum, rounds.length)}
                </h3>
              </div>
            </div>

            {/* Matches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto px-4">
              {roundMatches.map((match) => {
                const isFinished = match.status === "finished";
                const teamAWon = isFinished && match.winner_team_id === match.team_a_id;
                const teamBWon = isFinished && match.winner_team_id === match.team_b_id;
                const logoA = getTeamLogo(match.team_a_id);
                const logoB = getTeamLogo(match.team_b_id);

                return (
                  <div
                    key={match.db_id ?? `${roundNum}-${match.bracket_pos}`}
                    className="relative group"
                  >
                    {/* Match Card */}
                    <div className="relative rounded-3xl border-2 border-white/20 bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl overflow-hidden shadow-2xl hover:border-[#FFD700]/50 hover:shadow-[0_0_40px_rgba(255,215,0,0.3)] transition-all duration-500">
                      {/* Match Number Badge */}
                      <div className="absolute top-4 right-4 z-10">
                        <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                          <span className="text-xs font-bold text-white/80">
                            #{match.bracket_pos}
                          </span>
                        </div>
                      </div>

                      {/* Team A */}
                      <div
                        className={`relative p-6 ${
                          teamAWon
                            ? "bg-gradient-to-br from-[#FFD700]/30 to-[#B38600]/20"
                            : "bg-black/20"
                        } transition-all duration-300`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Logo */}
                          <div
                            className={`flex-shrink-0 w-16 h-16 rounded-2xl ${
                              teamAWon
                                ? "bg-gradient-to-br from-[#FFD700] to-[#B38600] p-0.5 shadow-[0_0_20px_rgba(255,215,0,0.6)]"
                                : "bg-white/10"
                            } overflow-hidden`}
                          >
                            {logoA ? (
                              <div className="w-full h-full bg-black/90 rounded-2xl flex items-center justify-center p-2">
                                <img
                                  src={logoA}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 rounded-2xl flex items-center justify-center">
                                <span className="text-2xl font-bold text-white/40">?</span>
                              </div>
                            )}
                          </div>

                          {/* Team Info */}
                          <div className="flex-1 min-w-0">
                            <h4
                              className={`font-bold text-sm mb-1 truncate ${
                                teamAWon ? "text-[#FFD700]" : "text-white"
                              }`}
                            >
                              {getTeamName(match.team_a_id)}
                            </h4>
                            {match.match_date && !isFinished && (
                              <p className="text-xs text-white/50">
                                {new Date(match.match_date).toLocaleDateString("el-GR", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            )}
                          </div>

                          {/* Score */}
                          {isFinished && (
                            <div
                              className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                                teamAWon
                                  ? "bg-[#FFD700] text-black shadow-lg"
                                  : "bg-white/10 text-white/50"
                              }`}
                            >
                              <span className="text-2xl font-black">
                                {match.team_a_score ?? 0}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* VS Divider */}
                      <div className="relative h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent">
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                          <div className="px-3 py-1 rounded-full bg-black border border-white/20">
                            <span className="text-xs font-bold text-white/60">VS</span>
                          </div>
                        </div>
                      </div>

                      {/* Team B */}
                      <div
                        className={`relative p-6 ${
                          teamBWon
                            ? "bg-gradient-to-br from-[#FFD700]/30 to-[#B38600]/20"
                            : "bg-black/20"
                        } transition-all duration-300`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Logo */}
                          <div
                            className={`flex-shrink-0 w-16 h-16 rounded-2xl ${
                              teamBWon
                                ? "bg-gradient-to-br from-[#FFD700] to-[#B38600] p-0.5 shadow-[0_0_20px_rgba(255,215,0,0.6)]"
                                : "bg-white/10"
                            } overflow-hidden`}
                          >
                            {logoB ? (
                              <div className="w-full h-full bg-black/90 rounded-2xl flex items-center justify-center p-2">
                                <img
                                  src={logoB}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 rounded-2xl flex items-center justify-center">
                                <span className="text-2xl font-bold text-white/40">?</span>
                              </div>
                            )}
                          </div>

                          {/* Team Info */}
                          <div className="flex-1 min-w-0">
                            <h4
                              className={`font-bold text-sm mb-1 truncate ${
                                teamBWon ? "text-[#FFD700]" : "text-white"
                              }`}
                            >
                              {getTeamName(match.team_b_id)}
                            </h4>
                            {match.match_date && !isFinished && (
                              <p className="text-xs text-white/50">
                                {new Date(match.match_date).toLocaleString("el-GR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}
                          </div>

                          {/* Score */}
                          {isFinished && (
                            <div
                              className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                                teamBWon
                                  ? "bg-[#FFD700] text-black shadow-lg"
                                  : "bg-white/10 text-white/50"
                              }`}
                            >
                              <span className="text-2xl font-black">
                                {match.team_b_score ?? 0}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Winner Crown */}
                      {isFinished && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#B38600] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.8)] border-4 border-black">
                            <span className="text-xl">👑</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnockoutBracket;
