"use client";

import { create } from "zustand";

// Types to represent tournament data
export type Tournament = {
  id: number;
  name: string;
  slug: string;
  format: "league" | "groups" | "knockout" | "mixed";
  season: string | null;
  logo: string | null;
  status: "scheduled" | "running" | "completed" | "archived";
  winner_team_id: number | null;
};

export type Team = {
  id: number;
  name: string;
  logo: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  topScorer: { id: number; name: string; goals: number } | null;
  stageStandings: { stageId: number; rank: number | null; points: number }[];
  yellowCards: number;
  redCards: number;
  blueCards: number;
};

export type Player = {
  id: number;
  name: string;
  position: string | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  blueCards: number;
  mvp: number;
  bestGoalkeeper: number;
  matchesPlayed: number;
  teamId: number;
  photo: string;
  isCaptain: boolean;
};

export type Match = {
  round: number | null;
  home_source_round: number | null;
  home_source_bracket_pos: number | null;
  away_source_round: number | null;
  away_source_bracket_pos: number | null;
  bracket_pos: number | null;
  id: number;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  match_date: string;
  status: "scheduled" | "finished";
  stage_id: number;
};

export type Stage = {
  id: number;
  tournament_id: number;
  name: string;
  kind: "league" | "groups" | "knockout";
  ordering: number;
  config: any | null;
};

export type Standing = {
  stage_id: number;
  group_id: number | null;
  team_id: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number | null;
};

export type Awards = {
  tournament_id: number;
  top_scorer_id: number | null;
  top_scorer_goals: number;
  mvp_player_id: number | null;
  best_gk_player_id: number | null;
};

// Store to manage tournament data
export type TournamentState = {
  tournament: Tournament | null;
  teams: Team[] | null;
  players: Player[] | null;
  matches: Match[] | null;
  stages: Stage[] | null;
  standings: Standing[] | null;
  awards: Awards | null;
  setTournamentData: (data: Tournament) => void;
  setTeams: (teams: Team[]) => void;
  setPlayers: (players: Player[]) => void;
  setMatches: (matches: Match[]) => void;
  setStages: (stages: Stage[]) => void;
  setStandings: (standings: Standing[]) => void;
  setAwards: (awards: Awards) => void;
};

// Mock data for a tournament with 8 teams
const mockTournament: Tournament = {
  id: 1,
  name: "Mock Cup",
  slug: "mock-cup",
  format: "knockout",
  season: "2025",
  logo: "/logo.jpg",
  status: "scheduled",
  winner_team_id: null,
};

const mockTeams: Team[] = [
  "Team A", "Team B", "Team C", "Team D", "Team E", "Team F", "Team G", "Team H",
].map((name, i) => ({
  id: i + 1,
  name,
  logo: "/logo.jpg",
  matchesPlayed: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
  topScorer: null,
  stageStandings: [],
  yellowCards: 0,
  redCards: 0,
  blueCards: 0,
}));

const mockStages: Stage[] = [
  { id: 1, tournament_id: 1, name: "Knockout Stage", kind: "knockout", ordering: 1, config: null },
];

// Correct number of matches (7 matches total)
const mockMatches: Match[] = [
  // Quarterfinals (Round 1)
  { id: 1, stage_id: 1, round: 1, bracket_pos: 1, team_a_id: 1, team_b_id: 2, team_a_score: null, team_b_score: null, match_date: "2025-10-24T10:00:00Z", status: "scheduled", home_source_round: null, home_source_bracket_pos: null, away_source_round: null, away_source_bracket_pos: null },
  { id: 2, stage_id: 1, round: 1, bracket_pos: 2, team_a_id: 3, team_b_id: 4, team_a_score: null, team_b_score: null, match_date: "2025-10-24T12:00:00Z", status: "scheduled", home_source_round: null, home_source_bracket_pos: null, away_source_round: null, away_source_bracket_pos: null },
  { id: 3, stage_id: 1, round: 1, bracket_pos: 3, team_a_id: 5, team_b_id: 6, team_a_score: null, team_b_score: null, match_date: "2025-10-24T14:00:00Z", status: "scheduled", home_source_round: null, home_source_bracket_pos: null, away_source_round: null, away_source_bracket_pos: null },
  { id: 4, stage_id: 1, round: 1, bracket_pos: 4, team_a_id: 7, team_b_id: 8, team_a_score: null, team_b_score: null, match_date: "2025-10-24T16:00:00Z", status: "scheduled", home_source_round: null, home_source_bracket_pos: null, away_source_round: null, away_source_bracket_pos: null },

  // Semifinals (Round 2)
  { id: 5, stage_id: 1, round: 2, bracket_pos: 1, team_a_id: null, team_b_id: null, team_a_score: null, team_b_score: null, match_date: "2025-10-25T10:00:00Z", status: "scheduled", home_source_round: 1, home_source_bracket_pos: 1, away_source_round: 1, away_source_bracket_pos: 2 },
  { id: 6, stage_id: 1, round: 2, bracket_pos: 2, team_a_id: null, team_b_id: null, team_a_score: null, team_b_score: null, match_date: "2025-10-25T12:00:00Z", status: "scheduled", home_source_round: 1, home_source_bracket_pos: 3, away_source_round: 1, away_source_bracket_pos: 4 },

  // Final (Round 3)
  { id: 7, stage_id: 1, round: 3, bracket_pos: 1, team_a_id: null, team_b_id: null, team_a_score: null, team_b_score: null, match_date: "2025-10-26T12:00:00Z", status: "scheduled", home_source_round: 2, home_source_bracket_pos: 1, away_source_round: 2, away_source_bracket_pos: 2 },
];

export const useTournamentData = create<TournamentState>((set) => ({
  tournament: mockTournament,
  teams: mockTeams,
  players: [],
  matches: mockMatches,
  stages: mockStages,
  standings: [],
  awards: {
    tournament_id: 0,
    top_scorer_id: null,
    top_scorer_goals: 0,
    mvp_player_id: null,
    best_gk_player_id: null
  },
  setTournamentData: (data) => set({ tournament: data }),
  setTeams: (teams) => set({ teams }),
  setPlayers: (players) => set({ players }),
  setMatches: (matches) => set({ matches }),
  setStages: (stages) => set({ stages }),
  setStandings: (standings) => set({ standings }),
  setAwards: (awards) => set({ awards }),
}));
