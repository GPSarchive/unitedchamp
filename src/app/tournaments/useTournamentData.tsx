// app/dashboard/tournaments/TournamentCURD/submit/useTournamentData.ts

"use client";

import { create } from "zustand";

// Types to represent tournament data (updated to match DB schema)
export type Tournament = {
  id: number;
  name: string;
  slug: string;
  format: "league" | "groups" | "knockout" | "mixed"; // Matches DB 'format'
  season: string | null; // Matches DB 'season' (text, nullable)
  logo: string | null; // Matches DB 'logo' (text, nullable)
  status: "scheduled" | "running" | "completed" | "archived"; // Add from DB for completeness
  winner_team_id: number | null; // Add from DB
};

 export type Team = {
  id: number;
  name: string;
  logo: string; // DB 'logo' defaults to '/logo.jpg'
  matchesPlayed: number; // Aggregated from standings.played
  wins: number; // From standings.won
  draws: number; // From standings.drawn
  losses: number; // From standings.lost
  goalsFor: number; // From standings.gf
  goalsAgainst: number; // From standings.ga
  goalDifference: number; // From standings.gd
  points: number; // From standings.points
  topScorer: { id: number; name: string; goals: number } | null; // Updated: Object instead of string, derived from players
  stageStandings: { stageId: number; rank: number | null; points: number }[]; // Array for multiple stages
  yellowCards: number; // New: Aggregated team yellow cards
  redCards: number; // New: Aggregated
  blueCards: number; // New: Aggregated
};

export type Player = {
  id: number;
  name: string; // Derived: first_name + last_name
  position: string | null; // DB 'position' (text, nullable)
  goals: number; // From player_statistics.total_goals or season_stats
  assists: number; // From player_statistics.total_assists
  yellowCards: number;
  redCards: number;
  blueCards: number;
  mvp: number; // Count of MVP awards
  bestGoalkeeper: number; // Count (already in your type, but ensure display)
  matchesPlayed: number; // From player_season_stats.matches
  teamId: number;
  photo: string; // Add from DB 'photo' (defaults to placeholder)
  isCaptain: boolean; // New: Derived from match_player_stats
};

export type Match = {
  id: number;
  team_a_id: number | null; // DB allows null for TBD
  team_b_id: number | null;
  team_a_score: number | null; // DB 'team_a_score' (bigint, nullable)
  team_b_score: number | null;
  match_date: string; // DB 'match_date' (timestamp)
  status: "scheduled" | "finished"; // Matches DB
  stage_id: number; // Already there
};

export type Stage = {
  id: number;
  tournament_id: number;
  name: string;
  kind: "league" | "groups" | "knockout"; // Matches DB
  ordering: number;
  config: any | null; // DB 'config' (jsonb, nullable)
};

export type Standing = {
  stage_id: number;
  group_id: number | null; // DB 'group_id' (integer)
  team_id: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number | null; // DB 'rank' (integer, nullable)
};

// New: Add awards type
export type Awards = {
  tournament_id: number;
  top_scorer_id: number | null;
  top_scorer_goals: number;
  mvp_player_id: number | null;
  best_gk_player_id: number | null;
};

// Updated Store
export type TournamentState = {
  tournament: Tournament | null;
  teams: Team[] | null;
  players: Player[] | null;
  matches: Match[] | null;
  stages: Stage[] | null;
  standings: Standing[] | null;
  awards: Awards | null; // New: For tournament awards
  setTournamentData: (data: Tournament) => void;
  setTeams: (teams: Team[]) => void;
  setPlayers: (players: Player[]) => void;
  setMatches: (matches: Match[]) => void;
  setStages: (stages: Stage[]) => void;
  setStandings: (standings: Standing[]) => void;
  setAwards: (awards: Awards) => void; // New setter
};

export const useTournamentData = create<TournamentState>((set) => ({
  tournament: null,
  teams: null,
  players: null,
  matches: null,
  stages: null,
  standings: null,
  awards: null, // New
  setTournamentData: (data) => set({ tournament: data }),
  setTeams: (teams) => set({ teams }),
  setPlayers: (players) => set({ players }),
  setMatches: (matches) => set({ matches }),
  setStages: (stages) => set({ stages }),
  setStandings: (standings) => set({ standings }),
  setAwards: (awards) => set({ awards }), // New
}));