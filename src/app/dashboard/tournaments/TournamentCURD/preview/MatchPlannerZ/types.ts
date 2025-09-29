// ===============================
// File: app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner/types.ts
// ===============================
"use client";

import type { DraftMatch, TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

export type EditableDraftMatch = DraftMatch & {
  locked?: boolean;
  _localId?: number;
  // Advanced fields stored/loaded from DB
  status?: "scheduled" | "finished";
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  // KO stable pointers:
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
};

export type DbOverlay = Pick<
  EditableDraftMatch,
  | "status"
  | "team_a_score"
  | "team_b_score"
  | "winner_team_id"
  | "home_source_round"
  | "home_source_bracket_pos"
  | "away_source_round"
  | "away_source_bracket_pos"
>;

export type TeamMetaMap = Record<number, { name: string }>; 

export type TeamOption = { id: number; label: string };

export type { DraftMatch, TeamDraft };
