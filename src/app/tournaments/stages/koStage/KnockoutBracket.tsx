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
    if (remaining === 1) return "Τελικός";
    if (remaining === 2) return "Ημιτελικοί";
    if (remaining === 3) return "Προημιτελικοί";
    if (remaining === 4) return "Φάση των 16";
    return `Γύρος ${roundNum}`;
  };

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60">Δεν υπάρχουν αγώνες νοκ-άουτ ακόμα.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-8 min-w-full p-6">
        {rounds.map(({ roundNum, matches: roundMatches }, roundIdx) => (
          <div key={roundNum} className="flex flex-col gap-4 min-w-[280px]">
            {/* Round Header */}
            <div className="sticky top-0 z-10 pb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#FFD700] to-[#B38600] text-black font-bold text-sm shadow-lg">
                <span className="text-lg">🏆</span>
                {getRoundName(roundNum, rounds.length)}
              </div>
            </div>

            {/* Matches in this round */}
            <div className="flex flex-col gap-6">
              {roundMatches.map((match) => {
                const isFinished = match.status === "finished";
                const teamAWon = match.winner_team_id === match.team_a_id;
                const teamBWon = match.winner_team_id === match.team_b_id;

                return (
                  <div
                    key={match.db_id ?? `${roundNum}-${match.bracket_pos}`}
                    className="group relative rounded-2xl border border-white/20 bg-black/60 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_8px_16px_rgba(0,0,0,0.6)] hover:border-[#FFD700]/40 hover:shadow-[inset_0_1px_1px_rgba(255,215,0,0.1),0_12px_24px_rgba(255,215,0,0.2)] transition-all duration-300"
                  >
                    {/* Match Header */}
                    <div className="px-4 py-2 border-b border-white/10 bg-gradient-to-r from-[#FFD700]/5 to-transparent">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-white/60">
                          Match {match.bracket_pos}
                        </span>
                        {match.match_date && (
                          <span className="text-[10px] text-white/50">
                            {new Date(match.match_date).toLocaleDateString("el-GR", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Teams */}
                    <div className="p-3 space-y-2">
                      {/* Team A */}
                      <div
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                          isFinished && teamAWon
                            ? "bg-[#FFD700]/20 border-2 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                            : "bg-white/[0.03] border border-white/10 hover:bg-white/[0.05]"
                        }`}
                      >
                        {getTeamLogo(match.team_a_id) && (
                          <img
                            src={getTeamLogo(match.team_a_id)!}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
                          />
                        )}
                        <span className="flex-1 text-sm font-semibold text-white truncate">
                          {getTeamName(match.team_a_id)}
                        </span>
                        {isFinished && (
                          <span
                            className={`text-xl font-bold min-w-[2rem] text-right ${
                              teamAWon ? "text-[#FFD700]" : "text-white/30"
                            }`}
                          >
                            {match.team_a_score ?? 0}
                          </span>
                        )}
                      </div>

                      {/* VS Divider */}
                      <div className="flex items-center justify-center">
                        <span className="text-xs font-bold text-white/40">VS</span>
                      </div>

                      {/* Team B */}
                      <div
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                          isFinished && teamBWon
                            ? "bg-[#FFD700]/20 border-2 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                            : "bg-white/[0.03] border border-white/10 hover:bg-white/[0.05]"
                        }`}
                      >
                        {getTeamLogo(match.team_b_id) && (
                          <img
                            src={getTeamLogo(match.team_b_id)!}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
                          />
                        )}
                        <span className="flex-1 text-sm font-semibold text-white truncate">
                          {getTeamName(match.team_b_id)}
                        </span>
                        {isFinished && (
                          <span
                            className={`text-xl font-bold min-w-[2rem] text-right ${
                              teamBWon ? "text-[#FFD700]" : "text-white/30"
                            }`}
                          >
                            {match.team_b_score ?? 0}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    {!isFinished && (
                      <div className="absolute -top-2 -right-2">
                        <div className="px-2 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-[10px] font-bold shadow-lg">
                          Upcoming
                        </div>
                      </div>
                    )}
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
