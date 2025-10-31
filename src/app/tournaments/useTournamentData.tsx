// useTournamentData.ts (unchanged, provided for completeness if needed in actual app; not used in standalone test versions)

"use client";

import { create } from "zustand";

// Types to represent tournament data
export type Tournament = {
  matches_count: string;
  teams_count: string;
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

export type DraftMatch = {
  db_id?: number | null;
  stageIdx: number;
  groupIdx?: number | null;
  bracket_pos?: number | null;
  matchday?: number | null;
  match_date?: string | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  round?: number | null;

  status?: "scheduled" | "finished" | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;

  home_source_match_idx?: number | null;
  away_source_match_idx?: number | null;
  home_source_outcome?: "W" | "L" | null;
  away_source_outcome?: "W" | "L" | "L" | null;
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
};

export type Stage = {
  id: number;
  tournament_id: number;
  name: string;
  kind: "league" | "groups" | "knockout" | "mixed";
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

// New type for awards
export type Awards = {
  tournament_id: number;
  top_scorer_id: number | null;
  top_scorer_goals: number;
  mvp_player_id: number | null;
  best_gk_player_id: number | null;
};

// New Group type (from schema/load function)
export type Group = {
  id: number;
  stage_id: number;
  name: string;
  ordering: number;
};

// Store to manage tournament data
export type TournamentState = {
  tournament: Tournament | null;
  teams: Team[] | null;
  players: Player[] | null;
  matches: DraftMatch[] | null;
  stages: Stage[] | null;
  standings: Standing[] | null;
  awards: Awards | null;
  groups: Group[] | null; // Added
  ids: { // Added computed ID maps like in tournamentStore
    stageIdByIndex: Record<number, number | undefined>;
    stageIndexById: Record<number, number | undefined>;
    groupIdByStage: Record<number, Record<number, number | undefined>>;
    groupIndexByStageAndId: Record<number, Record<number, number | undefined>>;
  };
  setTournamentData: (data: Tournament) => void;
  setTeams: (teams: Team[]) => void;
  setPlayers: (players: Player[]) => void;
  setMatches: (matches: DraftMatch[]) => void;
  setStages: (stages: Stage[]) => void;
  setStandings: (standings: Standing[]) => void;
  setAwards: (awards: Awards) => void;
  setGroups: (groups: Group[]) => void; // Added
  // Added selectors like in tournamentStore
  getTeamName: (id: number) => string;
  getTeamLogo: (id: number) => string | null;
};

export const useTournamentData = create<TournamentState>((set, get) => ({
  tournament: null,
  teams: null,
  players: null,
  matches: null,
  stages: null,
  standings: null,
  awards: null,
  groups: null,
  ids: {
    stageIdByIndex: {},
    stageIndexById: {},
    groupIdByStage: {},
    groupIndexByStageAndId: {},
  },
  setTournamentData: (data) => set({ tournament: data }),
  setTeams: (teams) => set({ teams }),
  setPlayers: (players) => set({ players }),
  setMatches: (matches) => set({ matches }),
  setStages: (stages) => {
    // Compute stageIdByIndex and stageIndexById like in hydrateFromSnapshot
    const sortedStages = (stages || []).slice().sort((a, b) => a.ordering - b.ordering);
    const stageIdByIndex: Record<number, number> = {};
    const stageIndexById: Record<number, number> = {};
    sortedStages.forEach((s, i) => {
      stageIdByIndex[i] = s.id;
      stageIndexById[s.id] = i;
    });
    set((state) => ({
      stages,
      ids: {
        ...state.ids,
        stageIdByIndex,
        stageIndexById,
      },
    }));
  },
  setStandings: (standings) => set({ standings }),
  setAwards: (awards) => set({ awards }),
  setGroups: (groups) => {
    // Compute groupIdByStage and groupIndexByStageAndId like in hydrateFromSnapshot
    const state = get();
    const groupsByStageId: Record<number, Group[]> = {};
    (groups || []).forEach((g) => {
      (groupsByStageId[g.stage_id] ??= []).push(g);
    });
    const groupIdByStage: Record<number, Record<number, number>> = {};
    const groupIndexByStageAndId: Record<number, Record<number, number>> = {};
    Object.entries(groupsByStageId).forEach(([sid, arr]) => {
      arr.sort((a, b) => a.ordering - b.ordering || a.name.localeCompare(b.name));
      const sIdx = state.ids.stageIndexById[Number(sid)] ?? -1;
      if (sIdx >= 0) {
        groupIdByStage[sIdx] = {};
        groupIndexByStageAndId[Number(sid)] = {};
        arr.forEach((g, gi) => {
          groupIdByStage[sIdx][gi] = g.id;
          groupIndexByStageAndId[Number(sid)][g.id] = gi;
        });
      }
    });
    set((state) => ({
      groups,
      ids: {
        ...state.ids,
        groupIdByStage,
        groupIndexByStageAndId,
      },
    }));
  },
  getTeamName: (id: number) => {
    const teams = get().teams;
    return teams?.find(t => t.id === id)?.name ?? `Team #${id}`;
  },
  getTeamLogo: (id: number) => {
    const teams = get().teams;
    return teams?.find(t => t.id === id)?.logo ?? null;
  },
}));