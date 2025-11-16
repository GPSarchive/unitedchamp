// src/app/paiktes/page.tsx (FIXED - NO SIGNING)
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import PlayersClient from "./PlayersClient";
import type { PlayerLite } from "./types";

export const revalidate = 300;

const DEFAULT_PAGE_SIZE = 50;

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

// Type for tournament stats match_player_stats rows
type TournamentMPSRow = {
  match_id: number;
  player_id: number;
  team_id: number;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
  mvp: boolean | null;
  best_goalkeeper: boolean | null;
};

type SP = {
  sort?: string;
  tournament_id?: string;
  top?: string;
  page?: string;
  q?: string;
};

export default async function PaiktesPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = await searchParams;
  const sortMode = (sp?.sort ?? "alpha").toLowerCase();
  const tournamentId = sp?.tournament_id ? Number(sp.tournament_id) : null;
  const topN = sp?.top ? Number(sp.top) : null;
  const page = sp?.page ? Math.max(1, Number(sp.page)) : 1;
  const searchTerm = sp?.q ? sp.q.trim() : "";

  // ✅ HYBRID PAGINATION: Load ALL data when filters are active
  // When user applies filters (sort, tournament), load everything for accurate results
  // Only use pagination for default alphabetical view
  // If topN is set, load exactly topN results (no pagination)
  const hasFilters =
    sortMode !== "alpha" || tournamentId !== null || searchTerm.length > 0;
  const usePagination = !hasFilters && topN === null;

  // Determine how many rows to fetch
  let pageSize: number;
  if (topN !== null) {
    pageSize = topN; // Load exactly topN results
  } else if (usePagination) {
    pageSize = DEFAULT_PAGE_SIZE; // Paginated view
  } else {
    pageSize = 999999; // Load all for filtering/sorting
  }

  // Fetch tournaments
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

  const offset = usePagination ? (page - 1) * pageSize : 0;

  // ✅ FILTER BY TOURNAMENT: If tournament is selected, get only players who played in that tournament
  let tournamentPlayerIds: number[] | null = null;
  if (Number.isFinite(tournamentId)) {
    // Get all matches for this tournament
    const { data: tournamentMatches } = await supabaseAdmin
      .from("matches")
      .select("id")
      .eq("tournament_id", tournamentId as number);

    const tMatchIds = (tournamentMatches ?? []).map((m) => (m as MatchIdRow).id);

    if (tMatchIds.length > 0) {
      // Get all player IDs who played in those matches
      const { data: tournamentMps } = await supabaseAdmin
        .from("match_player_stats")
        .select("player_id")
        .in("match_id", tMatchIds);

      const playerIdSet = new Set((tournamentMps ?? []).map((r: { player_id: number }) => r.player_id));
      tournamentPlayerIds = Array.from(playerIdSet);
    } else {
      // No matches in this tournament = no players
      tournamentPlayerIds = [];
    }
  }

  // Fetch paginated players with count, filtered by tournament if needed
  let playersQuery = supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, position, height_cm, birth_date", { count: "exact" });

  // ✅ Apply tournament filter if tournament is selected
  if (tournamentPlayerIds !== null) {
    if (tournamentPlayerIds.length === 0) {
      // No players in this tournament, return empty result
      playersQuery = playersQuery.in("id", [-1]); // Query that returns no results
    } else {
      playersQuery = playersQuery.in("id", tournamentPlayerIds);
    }
  }

  const { data: players, error: pErr, count: totalCount } = await playersQuery
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (pErr) console.error("[paiktes] players query error:", pErr.message);
  const p = (players ?? []) as PlayerRow[];
  const playerIds = p.map((x) => x.id);

  // Fetch player_teams
  const { data: ptRows, error: ptErr } = await supabaseAdmin
    .from("player_teams")
    .select("player_id, team_id, created_at, updated_at")
    .in("player_id", playerIds)
    .order("player_id", { ascending: true })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (ptErr) console.error("[paiktes] player_teams query error:", ptErr.message);

  const allTeamIdsSet = new Set(
    (ptRows ?? []).map((r: PlayerTeamRow) => r.team_id).filter(Boolean)
  );
  const allTeamIds = Array.from(allTeamIdsSet);

  // Fetch teams
  const { data: teams } = allTeamIds.length
    ? await supabaseAdmin.from("teams").select("id, name, logo").in("id", allTeamIds)
    : { data: [] as TeamRow[] };

  // ✅ NO SIGNING - Just build team map with raw paths
  const teamMap: Record<number, { id: number; name: string; logo: string | null }> = {};
  for (const t of (teams ?? [])) {
    teamMap[t.id] = {
      id: t.id,
      name: t.name ?? "",
      logo: t.logo, // ✅ Raw path
    };
  }

  const teamsByPlayer = new Map<  // ✅ Add < here
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

  // ✅ NO SIGNING - Pass raw paths
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

    return {
      id: pl.id,
      first_name: pl.first_name ?? "",
      last_name: pl.last_name ?? "",
      photo: pl.photo ?? "/player-placeholder.jpg", 
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

  // ✅ TOURNAMENT-SCOPED STATS: Compute all tournament stats when tournament is selected
  if (tournamentId) {
    const { data: matchRows } = await supabaseAdmin
      .from("matches")
      .select("id, winner_team_id")
      .eq("tournament_id", tournamentId);

    const tMatches = matchRows ?? [];
    const tMatchIds = tMatches.map((m) => m.id as number);

    if (tMatchIds.length) {
      const winnerByMatch = new Map<number, number | null>();
      for (const m of tMatches) {
        winnerByMatch.set(m.id as number, m.winner_team_id as number | null);
      }

      const { data: mpsRows } = await supabaseAdmin
        .from("match_player_stats")
        .select(
          [
            "match_id",
            "player_id",
            "team_id",
            "goals",
            "assists",
            "yellow_cards",
            "red_cards",
            "blue_cards",
            "mvp",
            "best_goalkeeper",
          ].join(",")
        )
        .in("match_id", tMatchIds);

      const typedMpsRows = (mpsRows ?? []) as unknown as TournamentMPSRow[];

      type TStats = {
        matches: number;
        goals: number;
        assists: number;
        yellow_cards: number;
        red_cards: number;
        blue_cards: number;
        mvp: number;
        best_gk: number;
        wins: number;
      };

      const tStatsByPlayer = new Map<number, TStats>();

      const ensure = (playerId: number): TStats => {
        let s = tStatsByPlayer.get(playerId);
        if (!s) {
          s = {
            matches: 0,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            blue_cards: 0,
            mvp: 0,
            best_gk: 0,
            wins: 0,
          };
          tStatsByPlayer.set(playerId, s);
        }
        return s;
      };

      // Track unique matches per player
      const matchesByTPlayer = new Map<number, Set<number>>();

      for (const r of typedMpsRows) {
        const pid = r.player_id;
        const s = ensure(pid);

        // Track unique matches
        if (!matchesByTPlayer.has(pid)) {
          matchesByTPlayer.set(pid, new Set());
        }
        matchesByTPlayer.get(pid)!.add(r.match_id);

        s.goals += r.goals ?? 0;
        s.assists += r.assists ?? 0;
        s.yellow_cards += r.yellow_cards ?? 0;
        s.red_cards += r.red_cards ?? 0;
        s.blue_cards += r.blue_cards ?? 0;
        s.mvp += r.mvp ? 1 : 0;
        s.best_gk += r.best_goalkeeper ? 1 : 0;

        const winnerTeamId = winnerByMatch.get(r.match_id);
        if (winnerTeamId && winnerTeamId === r.team_id) {
          s.wins += 1;
        }
      }

      // Set match counts based on unique matches
      for (const [playerId, matchSet] of matchesByTPlayer) {
        const s = tStatsByPlayer.get(playerId);
        if (s) {
          s.matches = matchSet.size;
        }
      }

      // Apply tournament stats to enriched players
      for (const pl of enriched) {
        const s = tStatsByPlayer.get(pl.id);
        if (!s) continue;

        pl.tournament_matches = s.matches;
        pl.tournament_goals = s.goals;
        pl.tournament_assists = s.assists;
        pl.tournament_yellow_cards = s.yellow_cards;
        pl.tournament_red_cards = s.red_cards;
        pl.tournament_blue_cards = s.blue_cards;
        pl.tournament_mvp = s.mvp;
        pl.tournament_best_gk = s.best_gk;
        pl.tournament_wins = s.wins;
      }
    }
  }

  // ✅ TOURNAMENT-AWARE SORTING: Helper function to get the right metric
  const hasTournament = !!tournamentId;

  function metric(
    p: PLWithTGoals,
    globalKey: keyof PLWithTGoals,
    tournamentKey: keyof PLWithTGoals
  ): number {
    if (hasTournament) {
      const t = p[tournamentKey];
      if (typeof t === "number") return t;
    }
    const g = p[globalKey];
    return typeof g === "number" ? g : 0;
  }

  // Apply sorting (tournament-aware when tournament is selected)
  switch (sortMode) {
    case "goals":
    case "tournament_goals":
      enriched.sort(
        (a, b) =>
          metric(b, "goals", "tournament_goals") -
          metric(a, "goals", "tournament_goals")
      );
      break;
    case "matches":
      enriched.sort(
        (a, b) =>
          metric(b, "matches", "tournament_matches") -
          metric(a, "matches", "tournament_matches")
      );
      break;
    case "wins":
      enriched.sort(
        (a, b) =>
          metric(b, "wins", "tournament_wins") -
          metric(a, "wins", "tournament_wins")
      );
      break;
    case "assists":
      enriched.sort(
        (a, b) =>
          metric(b, "assists", "tournament_assists") -
          metric(a, "assists", "tournament_assists")
      );
      break;
    case "mvp":
      enriched.sort(
        (a, b) =>
          metric(b, "mvp", "tournament_mvp") -
          metric(a, "mvp", "tournament_mvp")
      );
      break;
    case "bestgk":
      enriched.sort(
        (a, b) =>
          metric(b, "best_gk", "tournament_best_gk") -
          metric(a, "best_gk", "tournament_best_gk")
      );
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
        usePagination={usePagination}
        initialSearchQuery={searchTerm}
      />
    </div>
  );
}