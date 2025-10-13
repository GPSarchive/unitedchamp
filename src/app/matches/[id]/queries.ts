// app/tournoua/match/[id]/queries.ts
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  normalizeTeamPlayers,
  type Id,
  type MatchWithTeams,
  type PlayerAssociation,
  type TeamPlayersRowRaw,
  type MatchPlayerStatRow,
} from "@/app/lib/types";

export type { MatchPlayerStatRow } from "@/app/lib/types";

// Lightweight type for the tournament relation
type TournamentLite = {
  id: number;
  name: string;
};

// Your existing type, augmented with an optional tournament
export type MatchWithTournament = MatchWithTeams & {
  tournament: TournamentLite | null;
};

export async function fetchMatch(id: Id) {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      [
        "id",
        "match_date",
        "status",
        "team_a_score",
        "team_b_score",
        "winner_team_id",
        "referee",
        // Teams (existing)
        "team_a:teams!matches_team_a_id_fkey(id,name,logo)",
        "team_b:teams!matches_team_b_id_fkey(id,name,logo)",
        // Tournament (NEW)
        // If your FK column is matches.tournament_id -> tournaments.id, Supabase can infer:
        "tournament:tournaments(id,name)",
        // If inference doesn't work in your project, swap the line above with:
        // "tournament:tournaments!matches_tournament_id_fkey(id,name)",
      ].join(",")
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as unknown as MatchWithTournament;
}

export async function fetchPlayersForTeam(teamId: Id): Promise<PlayerAssociation[]> {
  const { data, error } = await supabaseAdmin
    .from("player_teams")
    .select(
      `
      id,
      player:player_id(
        id,
        first_name,
        last_name,
        photo,
        player_statistics(
          id,
          age,
          total_goals,
          total_assists,
          yellow_cards,
          red_cards,
          blue_cards,
          created_at,
          updated_at
        )
      )
    `
    )
    .eq("team_id", teamId)
    .order("player_id", { ascending: true })
    .order("id", { foreignTable: "player.player_statistics", ascending: false })
    .limit(1, { foreignTable: "player.player_statistics" });

  if (error || !data) return [];
  return normalizeTeamPlayers(data as TeamPlayersRowRaw[]);
}

export async function fetchMatchStatsMap(matchId: Id) {
  const { data, error } = await supabaseAdmin
    .from("match_player_stats")
    .select(
      `
      id,
      match_id,
      team_id,
      player_id,
      goals,
      assists,
      yellow_cards,
      red_cards,
      blue_cards,
      position,
      is_captain,
      gk,
      mvp,
      best_goalkeeper
    `
    )
    .eq("match_id", matchId);

  const map = new Map<number, MatchPlayerStatRow>();
  if (!error && data) {
    for (const row of data as any[]) map.set(row.player_id, row as MatchPlayerStatRow);
  }
  return map;
}

export type ParticipantRow = {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number;
  played: boolean;
  // optional legacy fields (not selected here)
  position?: string | null;
  is_captain?: boolean;
  gk?: boolean;
};

export async function fetchParticipantsMap(matchId: Id) {
  const { data, error } = await supabaseAdmin
    .from("match_participants")
    .select("id, match_id, team_id, player_id, played")
    .eq("match_id", matchId);

  const map = new Map<number, ParticipantRow>();
  if (!error && data) {
    for (const row of data as any[]) map.set(row.player_id, row as ParticipantRow);
  }
  return map;
}
