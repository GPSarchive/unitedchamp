// src/app/api/matches/[id]/stats/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    // Auth check
    const supa = await createSupabaseRouteClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: matchIdParam } = await ctx.params;
    const matchId = Number(matchIdParam);

    if (!matchId || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
    }

    // Fetch match to verify it exists and get team IDs
    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id, team_a_id, team_b_id")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Fetch match_player_stats
    const { data: stats, error: statsError } = await supabaseAdmin
      .from("match_player_stats")
      .select(`
        id,
        player_id,
        team_id,
        goals,
        assists,
        own_goals,
        yellow_cards,
        red_cards,
        blue_cards,
        mvp,
        best_goalkeeper,
        position,
        is_captain,
        gk
      `)
      .eq("match_id", matchId);

    if (statsError) {
      console.error("Error fetching match stats:", statsError);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    // Fetch match_participants
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("match_participants")
      .select("id, player_id, team_id, played")
      .eq("match_id", matchId);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
    }

    // Build response: map by player_id for easy lookup
    const statsByPlayer: Record<number, any> = {};
    const participationByPlayer: Record<number, boolean> = {};

    // Map stats
    (stats || []).forEach(stat => {
      statsByPlayer[stat.player_id] = {
        goals: stat.goals,
        assists: stat.assists,
        own_goals: stat.own_goals,
        yellow_cards: stat.yellow_cards,
        red_cards: stat.red_cards,
        blue_cards: stat.blue_cards,
        mvp: stat.mvp,
        best_goalkeeper: stat.best_goalkeeper,
        position: stat.position,
        is_captain: stat.is_captain,
        gk: stat.gk,
      };
    });

    // Map participation
    (participants || []).forEach(part => {
      participationByPlayer[part.player_id] = part.played;
    });

    // Merge stats and participation
    const combinedStats: Record<number, any> = {};

    // Get all unique player IDs
    const allPlayerIds = new Set([
      ...Object.keys(statsByPlayer).map(Number),
      ...Object.keys(participationByPlayer).map(Number),
    ]);

    allPlayerIds.forEach(playerId => {
      combinedStats[playerId] = {
        ...(statsByPlayer[playerId] || {}),
        played: participationByPlayer[playerId] || false,
      };
    });

    return NextResponse.json({
      matchId,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      stats: combinedStats,
    }, { status: 200 });

  } catch (error) {
    console.error("Error in GET /api/matches/[id]/stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
