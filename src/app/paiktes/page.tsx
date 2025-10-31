// src/app/paiktes/page.tsx (OPTIMIZED)
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import PlayersClient from "./PlayersClient";
import type { PlayerLite } from "./types";

export const revalidate = 300; // Increase from 60 to 5 minutes (match sign TTL)

// INCREASE sign TTL to reduce re-signing frequency
const BUCKET = "GPSarchive's Project";
const SIGN_TTL_SECONDS = 60 * 60; // 1 hour instead of 5 minutes

// Add pagination constants
const DEFAULT_PAGE_SIZE = 50; // Only load 50 players initially
const MAX_PAGE_SIZE = 100;

type PLWithTGoals = PlayerLite & { tournament_goals?: number };

type PlayerRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  position: string | null;
  height_cm: number | null;
  birth_date: string | null;
};

type PlayerTeamRow = {
  player_id: number;
  team_id: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type TeamRow = { id: number; name: string | null; logo: string | null };

type PlayerStatsRow = {
  player_id: number;
  total_goals: number | null;
  total_assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
};

type MPSRow = {
  player_id: number;
  match_id: number;
  team_id: number;
  mvp: boolean | null;
  best_goalkeeper: boolean | null;
};

type MatchWinnerRow = {
  id: number;
  winner_team_id: number | null;
};

type MatchIdRow = { id: number };
type MpsGoalsRow = { player_id: number; goals: number | null; match_id: number };

function isStoragePathServer(v: string | null | undefined) {
  if (!v) return false;
  if (/^(https?:)?\/\//i.test(v)) return false;
  if (v.startsWith("/")) return false;
  if (v.startsWith("data:")) return false;
  return true;
}

// OPTIMIZATION: Batch sign multiple URLs at once to reduce API calls
async function signMultiplePaths(paths: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  
  // Filter to only storage paths
  const storagePaths = paths.filter(isStoragePathServer);
  
  if (storagePaths.length === 0) {
    paths.forEach(p => results.set(p, p)); // Return as-is if not storage paths
    return results;
  }

  // Sign in parallel with Promise.all (faster than sequential)
  const signPromises = storagePaths.map(async (path) => {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGN_TTL_SECONDS);
    
    return { path, url: error ? null : data?.signedUrl ?? null };
  });

  const signed = await Promise.all(signPromises);
  signed.forEach(({ path, url }) => results.set(path, url));
  
  return results;
}

async function signIfStoragePath(v: string | null | undefined) {
  if (!v) return null;
  if (!isStoragePathServer(v)) return v;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(v, SIGN_TTL_SECONDS);

  return error ? null : data?.signedUrl ?? null;
}

type SP = { 
  sort?: string; 
  tournament_id?: string; 
  top?: string;
  page?: string; // NEW: Add pagination support
};

export default async function PaiktesPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  // Parse search params
  const sp = await searchParams;
  const sortMode = (sp?.sort ?? "alpha").toLowerCase();
  const tournamentId = sp?.tournament_id ? Number(sp.tournament_id) : null;
  const topN = sp?.top ? Number(sp.top) : null;
  const page = sp?.page ? Math.max(1, Number(sp.page)) : 1;
  const pageSize = topN ?? DEFAULT_PAGE_SIZE;

  // Fetch tournaments (unchanged)
  const { data: tournamentRows, error: tErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, season")
    .order("created_at", { ascending: false });

  if (tErr) console.error("[paiktes] tournaments query error:", tErr.message);
  const tournaments = (tournamentRows ?? []) as {
    id: number;
    name: string;
    season: string | null;
  }[];

  // OPTIMIZATION: Add pagination to query
  const offset = (page - 1) * pageSize;
  
  // Fetch paginated players with count
  const { data: players, error: pErr, count: totalCount } = await supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, position, height_cm, birth_date", { count: "exact" })
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .range(offset, offset + pageSize - 1); // Pagination

  if (pErr) console.error("[paiktes] players query error:", pErr.message);
  const p = (players ?? []) as PlayerRow[];
  const playerIds = p.map((x) => x.id);

  // Fetch all player_teams
  const { data: ptRows, error: ptErr } = await supabaseAdmin
    .from("player_teams")
    .select("player_id, team_id, created_at, updated_at")
    .in("player_id", playerIds)
    .order("player_id", { ascending: true })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (ptErr) console.error("[paiktes] player_teams query error:", ptErr.message);

  // Get all team IDs
  const allTeamIdsSet = new Set(
    (ptRows ?? []).map((r: PlayerTeamRow) => r.team_id).filter(Boolean)
  );
  const allTeamIds = Array.from(allTeamIdsSet);

  // Fetch all teams
  const { data: teams } = allTeamIds.length
    ? await supabaseAdmin.from("teams").select("id, name, logo").in("id", allTeamIds)
    : { data: [] as TeamRow[] };

  // OPTIMIZATION: Batch sign all images at once
  const allImagePaths = [
    ...p.map(pl => pl.photo).filter(Boolean) as string[],
    ...(teams ?? []).map(t => t.logo).filter(Boolean) as string[]
  ];
  
  const signedUrls = await signMultiplePaths(allImagePaths);

  // Build team map with signed URLs
  const teamMap: Record<number, { id: number; name: string; logo: string | null }> = {};
  for (const t of (teams ?? [])) {
    teamMap[t.id] = {
      id: t.id,
      name: t.name ?? "",
      logo: t.logo ? (signedUrls.get(t.logo) ?? null) : null
    };
  }

  // Group teams by player
  const teamsByPlayer = new Map<
    number,
    { id: number; name: string; logo: string | null }[]
  >();
  for (const r of (ptRows ?? []) as PlayerTeamRow[]) {
    if (r.team_id != null) {
      if (!teamsByPlayer.has(r.player_id)) teamsByPlayer.set(r.player_id, []);
      const teamData = teamMap[r.team_id];
      if (teamData) teamsByPlayer.get(r.player_id)!.push(teamData);
    }
  }

  // Fetch player statistics
  const { data: statsRows } = playerIds.length
    ? await supabaseAdmin
        .from("player_statistics")
        .select(
          "player_id, total_goals, total_assists, yellow_cards, red_cards, blue_cards"
        )
        .in("player_id", playerIds)
    : { data: [] as PlayerStatsRow[] };

  const totalsByPlayer = new Map<number, PlayerStatsRow>();
  for (const r of (statsRows ?? []) as PlayerStatsRow[])
    totalsByPlayer.set(r.player_id, r);

  // Fetch match player stats
  const { data: mps } = playerIds.length
    ? await supabaseAdmin
        .from("match_player_stats")
        .select("player_id, match_id, team_id, mvp, best_goalkeeper")
        .in("player_id", playerIds)
    : { data: [] as MPSRow[] };

  const mpsRows = (mps ?? []) as MPSRow[];

  const matchesByPlayer = new Map<number, Set<number>>();
  const mvpByPlayer = new Map<number, number>();
  const gkByPlayer = new Map<number, number>();

  for (const r of mpsRows) {
    if (!matchesByPlayer.has(r.player_id))
      matchesByPlayer.set(r.player_id, new Set());
    matchesByPlayer.get(r.player_id)!.add(r.match_id);
    if (r.mvp) mvpByPlayer.set(r.player_id, (mvpByPlayer.get(r.player_id) ?? 0) + 1);
    if (r.best_goalkeeper)
      gkByPlayer.set(r.player_id, (gkByPlayer.get(r.player_id) ?? 0) + 1);
  }

  // Calculate wins
  const matchIdsSet = new Set(mpsRows.map((r) => r.match_id));
  const matchIds = Array.from(matchIdsSet);
  const { data: matchWinners } = matchIds.length
    ? await supabaseAdmin
        .from("matches")
        .select("id, winner_team_id")
        .in("id", matchIds)
    : { data: [] as MatchWinnerRow[] };

  const winnerByMatch = new Map(
    (matchWinners ?? []).map((m) => [m.id, m.winner_team_id])
  );

  const winsByPlayer = new Map<number, number>();
  for (const r of mpsRows) {
    const winner = winnerByMatch.get(r.match_id);
    if (winner != null && winner === r.team_id) {
      winsByPlayer.set(r.player_id, (winsByPlayer.get(r.player_id) ?? 0) + 1);
    }
  }

  // Enrich player data with signed URLs from batch
  const now = new Date();
  const enriched: PLWithTGoals[] = p.map((pl) => {
    const age = pl.birth_date
      ? Math.floor(
          (now.getTime() - new Date(pl.birth_date).getTime()) /
            (365.25 * 24 * 3600 * 1000)
        )
      : null;

    const playerTeams = teamsByPlayer.get(pl.id) ?? [];
    const totals = totalsByPlayer.get(pl.id);
    const matches = matchesByPlayer.get(pl.id)?.size ?? 0;
    const mvp = mvpByPlayer.get(pl.id) ?? 0;
    const best_gk = gkByPlayer.get(pl.id) ?? 0;
    const wins = winsByPlayer.get(pl.id) ?? 0;

    // Use pre-signed URL from batch
    const signedPhoto = pl.photo 
      ? (signedUrls.get(pl.photo) ?? "/player-placeholder.jpg")
      : "/player-placeholder.jpg";

    return {
      id: pl.id,
      first_name: pl.first_name ?? "",
      last_name: pl.last_name ?? "",
      photo: signedPhoto,
      position: pl.position ?? "",
      height_cm: pl.height_cm ?? null,
      birth_date: pl.birth_date ?? null,
      age,
      teams: playerTeams,
      team: playerTeams[0] ?? null,
      matches,
      goals: totals?.total_goals ?? 0,
      assists: totals?.total_assists ?? 0,
      yellow_cards: totals?.yellow_cards ?? 0,
      red_cards: totals?.red_cards ?? 0,
      blue_cards: totals?.blue_cards ?? 0,
      mvp,
      best_gk,
      wins,
    };
  });

  // Apply sorting
  switch (sortMode) {
    case "goals":
      enriched.sort((a, b) => b.goals - a.goals);
      break;
    case "matches":
      enriched.sort((a, b) => b.matches - a.matches);
      break;
    case "wins":
      enriched.sort((a, b) => b.wins - a.wins);
      break;
    case "assists":
      enriched.sort((a, b) => b.assists - a.assists);
      break;
    case "mvp":
      enriched.sort((a, b) => b.mvp - a.mvp);
      break;
    case "bestgk":
      enriched.sort((a, b) => b.best_gk - a.best_gk);
      break;
    case "tournament_goals":
      if (Number.isFinite(tournamentId)) {
        const { data: matchRows } = await supabaseAdmin
          .from("matches")
          .select("id")
          .eq("tournament_id", tournamentId as number);

        const tMatchIds = (matchRows ?? []).map((m) => (m as MatchIdRow).id);

        const { data: mpsGoalRows } = tMatchIds.length
          ? await supabaseAdmin
              .from("match_player_stats")
              .select("player_id, goals, match_id")
              .in("match_id", tMatchIds)
          : { data: [] as MpsGoalsRow[] };

        const tGoals = new Map<number, number>();
        for (const r of (mpsGoalRows ?? []) as MpsGoalsRow[]) {
          tGoals.set(r.player_id, (tGoals.get(r.player_id) ?? 0) + (r.goals ?? 0));
        }

        for (const pl of enriched) pl.tournament_goals = tGoals.get(pl.id) ?? 0;
        enriched.sort((a, b) => (b.tournament_goals ?? 0) - (a.tournament_goals ?? 0));
      }
      break;
  }

  return (
    <div className="h-screen bg-black overflow-hidden">
      <PlayersClient 
        initialPlayers={enriched} 
        tournaments={tournaments}
        totalCount={totalCount ?? 0}
        currentPage={page}
        pageSize={pageSize}
      />
    </div>
  );
}






