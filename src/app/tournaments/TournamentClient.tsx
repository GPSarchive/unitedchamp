"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  Awards,
  DraftMatch,
  Group,
  Player,
  Stage,
  Standing,
  Team,
  Tournament,
} from "./useTournamentData";
import Link from "next/link";
import { useTournamentData } from "./useTournamentData";
import { useStages } from "./useStages";
import { PlayerStatistics } from "./components/PlayerStatistics";
import { Trophy, Star, Shield, ChevronRight } from "lucide-react";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

type TournamentClientProps = {
  initialData: {
    tournament: Tournament;
    teams: Team[];
    players: Player[];
    matches: DraftMatch[];
    stages: Stage[];
    standings: Standing[];
    awards: Awards | null;
    groups: Group[];
  };
};

const Skeleton: React.FC = () => (
  <div className="min-h-screen bg-zinc-950">
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="h-12 w-2/3 rounded-xl bg-zinc-900 animate-pulse" />
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-2xl bg-zinc-900 animate-pulse"
          />
        ))}
      </div>
    </div>
  </div>
);

const TournamentClient: React.FC<TournamentClientProps> = ({ initialData }) => {
  const {
    tournament,
    teams,
    players,
    matches,
    awards,
    getTeamName,
    getTeamLogo,
    setTournamentData,
    setTeams,
    setPlayers,
    setMatches,
    setStages,
    setStandings,
    setGroups,
    setAwards,
  } = useTournamentData();
  const { stages: sortedStages, getRendererForStage } = useStages();

  useEffect(() => {
    // Update store if tournament is not loaded OR if the tournament ID has changed
    if (!tournament || tournament.id !== initialData.tournament.id) {
      setTournamentData(initialData.tournament);
      setTeams(initialData.teams);
      setPlayers(initialData.players);
      setMatches(initialData.matches);
      setStages(initialData.stages);
      setStandings(initialData.standings);
      setGroups(initialData.groups);
      if (initialData.awards) setAwards(initialData.awards);
    }
  }, [
    initialData,
    tournament,
    setTournamentData,
    setTeams,
    setPlayers,
    setMatches,
    setStages,
    setStandings,
    setGroups,
    setAwards,
  ]);

  // Show skeleton if tournament is not loaded OR if the IDs don't match (during navigation)
  if (!tournament || tournament.id !== initialData.tournament.id) return <Skeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950">
      {/* Background pattern overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-white/50">
          <Link href="/" className="hover:text-white transition-colors">Αρχική</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/tournaments" className="hover:text-white transition-colors">Διοργανώσεις</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-white/80 truncate max-w-[200px]">{tournament.name}</span>
        </nav>

        {/* Tournament Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-xl shadow-black/40"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-zinc-950 to-black opacity-60" />

          <div className="relative px-8 py-10 md:px-12 md:py-14">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Left side - Title */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/30 border border-emerald-400/40 text-emerald-200 text-sm font-medium">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  {tournament.status === 'running' ? 'Σε Εξέλιξη' :
                   tournament.status === 'completed' ? 'Ολοκληρωμένο' :
                   'Προγραμματισμένο'}
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-300">
                  {tournament.name}
                </h1>

                {tournament.season && (
                  <p className="text-lg text-white/70 font-medium">
                    Σεζόν {tournament.season}
                  </p>
                )}
              </div>

              {/* Winner Banner */}
              {tournament.status === 'completed' && tournament.winner_team_id && (() => {
                const winnerTeam = teams?.find(t => t.id === tournament.winner_team_id);
                if (!winnerTeam) return null;
                return (
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-yellow-500/15 border border-yellow-500/30">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <img
                      src={winnerTeam.logo}
                      alt={winnerTeam.name}
                      className="w-8 h-8 rounded-full object-cover border border-yellow-500/40"
                      onError={(e) => { e.currentTarget.src = "/team-placeholder.svg"; }}
                    />
                    <div>
                      <p className="text-xs text-yellow-400/70">Νικητής</p>
                      <p className="font-bold text-yellow-300">{winnerTeam.name}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Right side - Stats */}
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-emerald-400">
                    {initialData.teams.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Ομάδες
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-emerald-400">
                    {sortedStages.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Στάδια
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-emerald-400">
                    {initialData.matches.length}
                  </div>
                  <div className="text-sm text-white/70 font-medium mt-1">
                    Αγώνες
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Latest Results & Upcoming Matches */}
        {matches && matches.length > 0 && (() => {
          const finished = matches
            .filter(m => m.status === 'finished')
            .sort((a, b) => (b.match_date ?? '').localeCompare(a.match_date ?? ''))
            .slice(0, 3);
          const upcoming = matches
            .filter(m => m.status === 'scheduled')
            .sort((a, b) => (a.match_date ?? '').localeCompare(b.match_date ?? ''))
            .slice(0, 3);

          if (finished.length === 0 && upcoming.length === 0) return null;

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Results */}
              {finished.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-black/60 to-zinc-900/60">
                    <h3 className="text-lg font-bold text-white">Πρόσφατα Αποτελέσματα</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {finished.map((m) => (
                      <div key={m.db_id} className="px-6 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getTeamLogo(m.team_a_id ?? 0) && (
                            <img src={getTeamLogo(m.team_a_id ?? 0)!} alt="" className="w-6 h-6 rounded-full object-cover" />
                          )}
                          <span className="text-sm text-white truncate">{getTeamName(m.team_a_id ?? 0)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-lg font-bold ${m.winner_team_id === m.team_a_id ? 'text-emerald-400' : 'text-white/50'}`}>
                            {m.team_a_score ?? 0}
                          </span>
                          <span className="text-white/30">-</span>
                          <span className={`text-lg font-bold ${m.winner_team_id === m.team_b_id ? 'text-emerald-400' : 'text-white/50'}`}>
                            {m.team_b_score ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-sm text-white truncate">{getTeamName(m.team_b_id ?? 0)}</span>
                          {getTeamLogo(m.team_b_id ?? 0) && (
                            <img src={getTeamLogo(m.team_b_id ?? 0)!} alt="" className="w-6 h-6 rounded-full object-cover" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Matches */}
              {upcoming.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-black/60 to-zinc-900/60">
                    <h3 className="text-lg font-bold text-white">Επόμενοι Αγώνες</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {upcoming.map((m) => (
                      <div key={m.db_id} className="px-6 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getTeamLogo(m.team_a_id ?? 0) && (
                            <img src={getTeamLogo(m.team_a_id ?? 0)!} alt="" className="w-6 h-6 rounded-full object-cover" />
                          )}
                          <span className="text-sm text-white truncate">{getTeamName(m.team_a_id ?? 0)}</span>
                        </div>
                        <div className="text-center shrink-0">
                          <span className="text-sm font-medium text-emerald-400">VS</span>
                          {m.match_date && (
                            <p className="text-[10px] text-white/40 mt-0.5">
                              {new Date(m.match_date).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-sm text-white truncate">{getTeamName(m.team_b_id ?? 0)}</span>
                          {getTeamLogo(m.team_b_id ?? 0) && (
                            <img src={getTeamLogo(m.team_b_id ?? 0)!} alt="" className="w-6 h-6 rounded-full object-cover" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Stages Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Στάδια Τουρνουά
            </h2>
            {sortedStages.length > 0 && (
              <span className="text-sm text-white/70">
                {sortedStages.length} {sortedStages.length === 1 ? 'στάδιο' : 'στάδια'}
              </span>
            )}
          </div>

          {sortedStages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border-2 border-dashed border-white/10 backdrop-blur-xl bg-gradient-to-br from-black/40 via-zinc-950/60 to-black/40 shadow-2xl p-12 text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white mb-2">
                Δεν υπάρχουν στάδια ακόμα
              </p>
              <p className="text-white/70">
                Τα στάδια του τουρνουά θα εμφανιστούν εδώ όταν δημιουργηθούν.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {sortedStages.map((stage, index) => {
                  const Renderer = getRendererForStage(stage);

                  return (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <div className="rounded-2xl border border-white/10 backdrop-blur-xl bg-gradient-to-br from-black/40 via-zinc-950/60 to-black/40 shadow-2xl hover:shadow-emerald-900/20 transition-all overflow-hidden">
                        {/* Stage Header */}
                        <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-black/60 via-zinc-900/60 to-black/60 backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_0_1px_rgba(16,185,129,0.3)_inset]">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-white">
                                  {stage.name}
                                </h3>
                                <p className="text-sm text-white/70">
                                  {stage.kind === 'league' && 'Πρωτάθλημα'}
                                  {stage.kind === 'groups' && 'Όμιλοι'}
                                  {stage.kind === 'knockout' && 'Νοκ-άουτ'}
                                  {stage.kind === 'mixed' && 'Μικτό'}
                                </p>
                              </div>
                            </div>

                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/15 text-white text-sm font-medium">
                              {stage.kind === 'league' && '👥'}
                              {stage.kind === 'groups' && '👥'}
                              {stage.kind === 'knockout' && '🏆'}

                              <span className="capitalize">{stage.kind}</span>
                            </div>
                          </div>
                        </div>

                        {/* Stage Content */}
                        <div className="p-6 bg-black/20">
                          <Renderer stage={stage} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Awards Section */}
        {awards && players && teams && (awards.top_scorer_id || awards.mvp_player_id || awards.best_gk_player_id) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-white">
              Βραβεία
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Top Scorer */}
              {awards.top_scorer_id && (() => {
                const player = players.find(p => p.id === awards.top_scorer_id);
                const team = player ? teams.find(t => t.id === player.teamId) : null;
                if (!player) return null;
                return (
                  <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-black/40 to-black/40 p-6 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-yellow-400 font-semibold">Πρώτος Σκόρερ</p>
                        <p className="text-xs text-white/50">{awards.top_scorer_goals} γκολ</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={resolvePlayerPhotoUrl(player.photo)}
                        alt={player.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-yellow-500/40"
                        onError={(e) => { e.currentTarget.src = "/player-placeholder.svg"; }}
                      />
                      <div>
                        <p className="font-bold text-white">{player.name}</p>
                        {team && <p className="text-xs text-white/50">{team.name}</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* MVP */}
              {awards.mvp_player_id && (() => {
                const player = players.find(p => p.id === awards.mvp_player_id);
                const team = player ? teams.find(t => t.id === player.teamId) : null;
                if (!player) return null;
                return (
                  <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-black/40 to-black/40 p-6 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                        <Star className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-sm text-emerald-400 font-semibold">MVP</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={resolvePlayerPhotoUrl(player.photo)}
                        alt={player.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/40"
                        onError={(e) => { e.currentTarget.src = "/player-placeholder.svg"; }}
                      />
                      <div>
                        <p className="font-bold text-white">{player.name}</p>
                        {team && <p className="text-xs text-white/50">{team.name}</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Best Goalkeeper */}
              {awards.best_gk_player_id && (() => {
                const player = players.find(p => p.id === awards.best_gk_player_id);
                const team = player ? teams.find(t => t.id === player.teamId) : null;
                if (!player) return null;
                return (
                  <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-black/40 to-black/40 p-6 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-sm text-blue-400 font-semibold">Καλύτερος Τερματοφύλακας</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={resolvePlayerPhotoUrl(player.photo)}
                        alt={player.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-blue-500/40"
                        onError={(e) => { e.currentTarget.src = "/player-placeholder.svg"; }}
                      />
                      <div>
                        <p className="font-bold text-white">{player.name}</p>
                        {team && <p className="text-xs text-white/50">{team.name}</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}

        {/* Teams Section */}
        {teams && teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Ομάδες</h2>
              <span className="text-sm text-white/70">{teams.length} ομάδες</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const teamPlayers = players?.filter(p => p.teamId === team.id) ?? [];
                return (
                  <div
                    key={team.id}
                    className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden"
                  >
                    <div className="px-5 py-4 flex items-center gap-3">
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                        onError={(e) => { e.currentTarget.src = "/team-placeholder.svg"; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{team.name}</p>
                        <p className="text-xs text-white/50">
                          {team.wins}Ν - {team.draws}Ι - {team.losses}Η &middot; {team.points} βαθμοί
                        </p>
                      </div>
                    </div>
                    {teamPlayers.length > 0 && (
                      <div className="border-t border-white/5 px-5 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Ρόστερ ({teamPlayers.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {teamPlayers.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/70"
                            >
                              {p.isCaptain && <span className="text-yellow-400 text-[10px]">C</span>}
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Player Statistics Section */}
        {(() => {
          if (players && teams) {
            return (
              <PlayerStatistics
                players={players}
                teams={teams}
              />
            );
          }

          return (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-white/70">
              <p>Φόρτωση στατιστικών παικτών...</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default TournamentClient;






