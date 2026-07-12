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
  video_url: string | null; // ✅ NEW: per-match YouTube URL/ID
  // KO context (single-leg pens + two-legged deciders)
  is_ko: boolean | null;
  leg: number | null;
  tie_leg1_match_id: number | null;
  penalty_a: number | null;
  penalty_b: number | null;
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
        "referee",
        "video_url", // ✅ NEW: load from DB
        // KO context (single-leg pens + two-legged deciders)
        "is_ko",
        "leg",
        "tie_leg1_match_id",
        "penalty_a",
        "penalty_b",
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

/** Leg-1 scores for a two-legged tie (used to show aggregate on the leg-2 match). */
export async function fetchLegOneScores(legOneMatchId: Id) {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select("team_a_id, team_b_id, team_a_score, team_b_score, status")
    .eq("id", legOneMatchId)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    team_a_id: number | null;
    team_b_id: number | null;
    team_a_score: number | null;
    team_b_score: number | null;
    status: string;
  };
}

export async function fetchPlayersForTeam(teamId: Id): Promise<PlayerAssociation[]> {
  // No player_statistics join here: the match page renders only identity
  // fields (roster, stats editor), never the career aggregates.
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
        deleted_at
      )
    `
    )
    .eq("team_id", teamId)
    .order("player_id", { ascending: true });

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
      own_goals,
      yellow_cards,
      red_cards,
      blue_cards,
      position,
      is_captain,
      gk,
      mvp,
      best_goalkeeper,
      player_number
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
  group_name: string | null;
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

export type StandingsResult = {
  standings: StandingRow[];
  stageKind: "league" | "groups" | "knockout" | null;
  stageName: string | null;
};

/**
 * Fetch all standings for a stage (all groups)
 * Returns teams sorted by rank within each group, plus stage metadata
 */
export async function fetchStandingsByStage(
  stageId: Id
): Promise<StandingsResult> {
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

  if (standingsError || !standingsData) return { standings: [], stageKind: null, stageName: null };

  // Get unique team IDs and real group IDs (> 0; 0 is sentinel for league/no-group)
  const teamIds = [...new Set(standingsData.map((s: any) => s.team_id))];
  const groupIds = [...new Set(standingsData.map((s: any) => s.group_id).filter((id: any) => id > 0))];

  // Fetch teams, group names, and stage metadata in parallel
  const [teamsResult, groupsResult, stageResult] = await Promise.all([
    supabaseAdmin.from("teams").select("id, name, logo").in("id", teamIds),
    groupIds.length
      ? supabaseAdmin.from("tournament_groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("tournament_stages").select("id, name, kind").eq("id", stageId).single(),
  ]);

  const { data: teamsData, error: teamsError } = teamsResult;
  const { data: groupsData } = groupsResult;
  const { data: stageData } = stageResult;

  if (teamsError || !teamsData) return { standings: [], stageKind: null, stageName: null };

  // Create lookup maps
  const teamsMap = new Map(teamsData.map((t: any) => [t.id, t]));
  const groupsMap = new Map((groupsData ?? []).map((g: any) => [g.id, g.name as string]));

  // Combine standings with team and group data
  // group_id = 0 is a sentinel for "no real group" (league stages); normalise to null
  const standings: StandingRow[] = standingsData.map((s: any) => {
    const realGroupId: number | null = s.group_id > 0 ? s.group_id : null;
    return {
      stage_id: s.stage_id,
      group_id: realGroupId,
      group_name: realGroupId ? (groupsMap.get(realGroupId) ?? null) : null,
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
    };
  });

  return {
    standings,
    stageKind: (stageData?.kind as StandingsResult["stageKind"]) ?? null,
    stageName: stageData?.name ?? null,
  };
}
