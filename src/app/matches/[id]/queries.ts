// app/tournoua/match/[id]/queries.ts
'use server';

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
  logo: string | null; // ✅ logo field
};

// Your existing type, augmented with an optional tournament
export type MatchWithTournament = MatchWithTeams & {
  tournament: TournamentLite | null;
  stage_id: number | null;
  group_id: number | null;
  video_url: string | null; // ✅ NEW: per-match YouTube URL/ID
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
        "stage_id",
        "group_id",
        "video_url", // ✅ NEW: load from DB
        // Teams (existing)
        "team_a:teams!matches_team_a_id_fkey(id,name,logo)",
        "team_b:teams!matches_team_b_id_fkey(id,name,logo)",
        // Tournament (has logo)
        "tournament:tournaments(id,name,logo)",
        // If inference doesn't work in your project, swap the line above with:
        // "tournament:tournaments!matches_tournament_id_fkey(id,name,logo)",
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

// ============================================================================
// STANDINGS
// ============================================================================

export type StandingRow = {
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
  team: {
    id: number;
    name: string;
    logo: string | null;
  };
};

/**
 * Fetch all standings for a stage (all groups)
 * Returns teams sorted by rank within each group
 */
export async function fetchStandingsByStage(
  stageId: Id
): Promise<StandingRow[]> {
  console.log('[fetchStandingsByStage] Querying stage_id:', stageId);

  // Fetch standings data
  const { data: standingsData, error: standingsError } = await supabaseAdmin
    .from("stage_standings")
    .select(
      "stage_id, group_id, team_id, played, won, drawn, lost, gf, ga, gd, points, rank"
    )
    .eq("stage_id", stageId)
    .order("group_id", { ascending: true, nullsFirst: true })
    .order("rank", { ascending: true, nullsFirst: false })
    .order("points", { ascending: false });

  console.log('[fetchStandingsByStage] Standings query result:', {
    error: standingsError?.message,
    dataCount: standingsData?.length ?? 0,
  });

  if (standingsError || !standingsData) return [];

  // Get unique team IDs
  const teamIds = [...new Set(standingsData.map((s: any) => s.team_id))];

  // Fetch team data separately
  const { data: teamsData, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo")
    .in("id", teamIds);

  console.log('[fetchStandingsByStage] Teams query result:', {
    error: teamsError?.message,
    dataCount: teamsData?.length ?? 0,
  });

  if (teamsError || !teamsData) return [];

  // Create a map for quick team lookup
  const teamsMap = new Map(teamsData.map((t: any) => [t.id, t]));

  // Combine standings with team data
  const standings: StandingRow[] = standingsData.map((s: any) => ({
    stage_id: s.stage_id,
    group_id: s.group_id,
    team_id: s.team_id,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    gf: s.gf,
    ga: s.ga,
    gd: s.gd,
    points: s.points,
    rank: s.rank,
    team: teamsMap.get(s.team_id) || {
      id: s.team_id,
      name: `Team #${s.team_id}`,
      logo: null,
    },
  }));

  console.log('[fetchStandingsByStage] Final result:', {
    count: standings.length,
    data: standings
  });

  return standings;
}
