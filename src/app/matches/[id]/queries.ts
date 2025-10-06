// matches/[id]/queries.ts
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  normalizeTeamPlayers,
  type Id,
  type MatchWithTeams,
  type PlayerAssociation,
  type TeamPlayersRowRaw,MatchPlayerStatRow
} from "@/app/lib/types";

export type { MatchPlayerStatRow } from "@/app/lib/types";


export async function fetchMatch(id: Id) {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select([
      "id",
      "match_date",
      "status",
      "team_a_score",
      "team_b_score",
      "winner_team_id",
      "referee", // ← add
      "team_a:teams!matches_team_a_id_fkey(id,name,logo)",
      "team_b:teams!matches_team_b_id_fkey(id,name,logo)",
    ].join(","))
    
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as unknown as MatchWithTeams;
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
    .select(`
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
    `)
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
  position: string | null;
  is_captain: boolean;
  gk: boolean;
};



export async function fetchParticipantsMap(matchId: Id) {
  const { data, error } = await supabaseAdmin
    .from("match_participants")
    .select("id, match_id, team_id, player_id, played, position, is_captain, gk")
    .eq("match_id", matchId);

  const map = new Map<number, ParticipantRow>();
  if (!error && data) {
    for (const row of data as any[]) map.set(row.player_id, row as ParticipantRow);
  }
  return map;
}
