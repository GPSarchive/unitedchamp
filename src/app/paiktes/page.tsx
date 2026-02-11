// src/app/paiktes/page.tsx (FIXED - NO SIGNING, MAIN + SECONDARY TEAMS BY PARTICIPATION)
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import PlayersClient from "./PlayersClient";
import type { PlayerLite } from "./types";
import {
  parseSearchQuery,
  normalizeForSearch,
  removeGreekDiacritics,
} from "@/app/lib/searchUtils";

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

type MPSRow = {
  player_id: number;
  match_id: number;
  team_id: number;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
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
  const parsedTop = sp?.top ? Number(sp.top) : NaN;
  const topN =
    Number.isFinite(parsedTop) && parsedTop > 0 ? Math.floor(parsedTop) : null;
  const page = sp?.page ? Math.max(1, Number(sp.page)) : 1;
  const rawSearchTerm = sp?.q ? sp.q.trim() : "";

  // Parse search query for field-specific searches
  const parsedSearch = parseSearchQuery(rawSearchTerm);

  // UNIFIED PAGINATION - Always use pagination for consistency
  const pageSize = DEFAULT_PAGE_SIZE;

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

  const offset = (page - 1) * pageSize;

  // TEAM FILTER → player ids (from parsed search)
  let teamFilteredPlayerIds: number[] | null = null;
  if (parsedSearch.team && parsedSearch.team.length > 0) {
    // Get all search variants for each team term
    const teamSearchVariants = parsedSearch.team.flatMap((teamTerm) =>
      normalizeForSearch(teamTerm)
    );

    // Build OR conditions for team name search
    const teamConditions = teamSearchVariants
      .map((variant) => `name.ilike.%${variant}%`)
      .join(",");

    const { data: matchingTeams } = await supabaseAdmin
      .from("teams")
      .select("id")
      .or(teamConditions);

    if (matchingTeams && matchingTeams.length > 0) {
      const teamIds = matchingTeams.map((t) => t.id);

      // Get players belonging to these teams
      const { data: playerTeams } = await supabaseAdmin
        .from("player_teams")
        .select("player_id")
        .in("team_id", teamIds);

      const playerIdSet = new Set(
        (playerTeams ?? []).map((pt: { player_id: number }) => pt.player_id)
      );
      teamFilteredPlayerIds = Array.from(playerIdSet);
    } else {
      // No matching teams found, return empty result
      teamFilteredPlayerIds = [];
    }
  }

  // TOURNAMENT FILTER → player ids
  let tournamentPlayerIds: number[] | null = null;
  if (Number.isFinite(tournamentId)) {
    const { data: tournamentMatches } = await supabaseAdmin
      .from("matches")
      .select("id")
      .eq("tournament_id", tournamentId as number);

    const tMatchIds = (tournamentMatches ?? []).map(
      (m) => (m as MatchIdRow).id
    );

    if (tMatchIds.length > 0) {
      const { data: tournamentMps } = await supabaseAdmin
        .from("match_player_stats")
        .select("player_id")
        .in("match_id", tMatchIds);

      const playerIdSet = new Set(
        (tournamentMps ?? []).map((r: { player_id: number }) => r.player_id)
      );
      tournamentPlayerIds = Array.from(playerIdSet);
    } else {
      tournamentPlayerIds = [];
    }
  }

  // Combine filters (team + tournament)
  let combinedPlayerIds: number[] | null = null;

  if (teamFilteredPlayerIds !== null && tournamentPlayerIds !== null) {
    // Both filters active - find intersection
    const teamSet = new Set(teamFilteredPlayerIds);
    combinedPlayerIds = tournamentPlayerIds.filter((id) => teamSet.has(id));
  } else if (teamFilteredPlayerIds !== null) {
    // Only team filter
    combinedPlayerIds = teamFilteredPlayerIds;
  } else if (tournamentPlayerIds !== null) {
    // Only tournament filter
    combinedPlayerIds = tournamentPlayerIds;
  }

  // Fetch players with search filters
  let playersQuery = supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, position, height_cm, birth_date", {
      count: "exact",
    });

  // Apply combined ID filter (team + tournament)
  if (combinedPlayerIds !== null) {
    if (combinedPlayerIds.length === 0) {
      playersQuery = playersQuery.in("id", [-1]);
    } else {
      playersQuery = playersQuery.in("id", combinedPlayerIds);
    }
  }

  // Apply position filter from parsed search
  if (parsedSearch.position && parsedSearch.position.length > 0) {
    // Create case-insensitive search for positions
    const posFilters = parsedSearch.position
      .flatMap((pos) => normalizeForSearch(pos))
      .map((variant) => variant.toLowerCase());

    // Use OR condition for multiple position variants
    const positionConditions = posFilters
      .map((_, idx) => `position.ilike.%${posFilters[idx]}%`)
      .join(",");

    if (posFilters.length === 1) {
      playersQuery = playersQuery.ilike("position", `%${posFilters[0]}%`);
    } else {
      // For multiple position searches, we need to use or syntax
      // Supabase format: .or('position.ilike.%Forward%,position.ilike.%Goalkeeper%')
      playersQuery = playersQuery.or(positionConditions);
    }
  }

  // Apply text search from parsed search (name search)
  if (parsedSearch.text.length > 0) {
    // Combine all text search terms
    const textSearchTerms = parsedSearch.text.join(" ");
    const searchVariants = normalizeForSearch(textSearchTerms);

    // Build OR conditions for first_name and last_name across all variants
    const nameConditions: string[] = [];

    for (const variant of searchVariants) {
      const pattern = `%${variant}%`;
      nameConditions.push(`first_name.ilike.${pattern}`);
      nameConditions.push(`last_name.ilike.${pattern}`);
    }

    if (nameConditions.length > 0) {
      playersQuery = playersQuery.or(nameConditions.join(","));
    }
  }

  // IMPORTANT: When tournament filter is active OR when using non-alpha sort,
  // we need to fetch ALL players first, then calculate stats, then sort, then paginate.
  // Otherwise top scorers with last names late in alphabet won't appear.
  // Only use early pagination for alphabetical sorting (where DB ordering matches display order).
  const shouldDeferPagination = !!tournamentId || sortMode !== "alpha";

  let playersQueryWithOrder = playersQuery
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  // Only apply pagination now if NOT tournament-filtered
  if (!shouldDeferPagination) {
    playersQueryWithOrder = playersQueryWithOrder.range(offset, offset + pageSize - 1);
  }

  const {
    data: players,
    error: pErr,
    count: totalCount,
  } = await playersQueryWithOrder;

  if (pErr) console.error("[paiktes] players query error:", pErr.message);
  const p = (players ?? []) as PlayerRow[];
  const playerIds = p.map((x) => x.id);

  // Fetch player_teams (membership source)
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

  const teamMap: Record<number, { id: number; name: string; logo: string | null }> =
    {};
  for (const t of (teams ?? [])) {
    teamMap[t.id] = {
      id: t.id,
      name: t.name ?? "",
      logo: t.logo,
    };
  }

  // Membership: which teams each player currently belongs to
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

  // Fetch match_player_stats (source for participation + stats + MVP/GK)
  const { data: mps } = playerIds.length
    ? await supabaseAdmin
        .from("match_player_stats")
        .select("player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper")
        .in("player_id", playerIds)
    : { data: [] as MPSRow[] };

  const mpsRows = (mps ?? []) as MPSRow[];

  // Global matches per player (for "matches" column)
  const matchesByPlayer = new Map<number, Set<number>>();

  // Matches per (player, team) for ranking memberships
  const matchesByPlayerTeam = new Map<string, Set<number>>();

  const mvpByPlayer = new Map<number, number>();
  const gkByPlayer = new Map<number, number>();

  // Aggregate goals/assists/cards from match_player_stats (single source of truth)
  const goalsByPlayer = new Map<number, number>();
  const assistsByPlayer = new Map<number, number>();
  const yellowByPlayer = new Map<number, number>();
  const redByPlayer = new Map<number, number>();
  const blueByPlayer = new Map<number, number>();

  for (const r of mpsRows) {
    // total matches per player
    if (!matchesByPlayer.has(r.player_id))
      matchesByPlayer.set(r.player_id, new Set());
    matchesByPlayer.get(r.player_id)!.add(r.match_id);

    // matches per player+team (only used later for membership teams)
    const key = `${r.player_id}:${r.team_id}`;
    if (!matchesByPlayerTeam.has(key)) {
      matchesByPlayerTeam.set(key, new Set());
    }
    matchesByPlayerTeam.get(key)!.add(r.match_id);

    // Aggregate stats per player
    goalsByPlayer.set(r.player_id, (goalsByPlayer.get(r.player_id) ?? 0) + (r.goals ?? 0));
    assistsByPlayer.set(r.player_id, (assistsByPlayer.get(r.player_id) ?? 0) + (r.assists ?? 0));
    yellowByPlayer.set(r.player_id, (yellowByPlayer.get(r.player_id) ?? 0) + (r.yellow_cards ?? 0));
    redByPlayer.set(r.player_id, (redByPlayer.get(r.player_id) ?? 0) + (r.red_cards ?? 0));
    blueByPlayer.set(r.player_id, (blueByPlayer.get(r.player_id) ?? 0) + (r.blue_cards ?? 0));

    if (r.mvp)
      mvpByPlayer.set(r.player_id, (mvpByPlayer.get(r.player_id) ?? 0) + 1);
    if (r.best_goalkeeper)
      gkByPlayer.set(
        r.player_id,
        (gkByPlayer.get(r.player_id) ?? 0) + 1
      );
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

  const now = new Date();

  let enriched: PLWithTGoals[] = p.map((pl) => {
    const age = pl.birth_date
      ? Math.floor(
          (now.getTime() - new Date(pl.birth_date).getTime()) /
            (365.25 * 24 * 3600 * 1000)
        )
      : null;

    // Membership teams for this player
    const membershipTeams =
      teamsByPlayer.get(pl.id) ?? [];

    // Rank membership teams by matches played for that team
    type TeamWithMatches = {
      id: number;
      name: string;
      logo: string | null;
      matchesForTeam: number;
    };

    const rankedTeams: TeamWithMatches[] = membershipTeams
      .map((t) => {
        const key = `${pl.id}:${t.id}`;
        const matchSet = matchesByPlayerTeam.get(key);
        const matchesForTeam = matchSet ? matchSet.size : 0;
        return { ...t, matchesForTeam };
      })
      .sort((a, b) => {
        // Primary: more matches first
        if (b.matchesForTeam !== a.matchesForTeam) {
          return b.matchesForTeam - a.matchesForTeam;
        }
        // Tie-breaker: name, then id for determinism
        if (a.name !== b.name) {
          return a.name.localeCompare(b.name);
        }
        return a.id - b.id;
      });

    // Main + up to 2 secondary teams
    const topTeams = rankedTeams
      .slice(0, 3)
      .map(({ matchesForTeam, ...rest }) => rest);

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
      // membership-based team fields:
      teams: topTeams, // up to 3 current teams, sorted by matches played
      team: topTeams[0] ?? null, // main team = most matches among membership teams
      matches,
      goals: goalsByPlayer.get(pl.id) ?? 0,
      assists: assistsByPlayer.get(pl.id) ?? 0,
      yellow_cards: yellowByPlayer.get(pl.id) ?? 0,
      red_cards: redByPlayer.get(pl.id) ?? 0,
      blue_cards: blueByPlayer.get(pl.id) ?? 0,
      mvp,
      best_gk,
      wins,
    };
  });

  // TOURNAMENT-SCOPED STATS
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

      const matchesByTPlayer = new Map<number, Set<number>>();

      for (const r of typedMpsRows) {
        const pid = r.player_id;
        const s = ensure(pid);

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

      for (const [playerId, matchSet] of matchesByTPlayer) {
        const s = tStatsByPlayer.get(playerId);
        if (s) {
          s.matches = matchSet.size;
        }
      }

      for (const pl of enriched) {
        const s = tStatsByPlayer.get(pl.id);

        // Initialize tournament stats to 0 if player didn't play in tournament
        // This ensures sorting and filtering work correctly (no undefined values)
        pl.tournament_matches = s?.matches ?? 0;
        pl.tournament_goals = s?.goals ?? 0;
        pl.tournament_assists = s?.assists ?? 0;
        pl.tournament_yellow_cards = s?.yellow_cards ?? 0;
        pl.tournament_red_cards = s?.red_cards ?? 0;
        pl.tournament_blue_cards = s?.blue_cards ?? 0;
        pl.tournament_mvp = s?.mvp ?? 0;
        pl.tournament_best_gk = s?.best_gk ?? 0;
        pl.tournament_wins = s?.wins ?? 0;
      }
    }
  }

  // Apply tournament-aware stats filters AFTER tournament stats are calculated
  const hasTournament = !!tournamentId;

  // Helper function to get the correct stat value (tournament or global)
  function getStatValue(
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

  if (parsedSearch.minGoals !== undefined) {
    enriched = enriched.filter(
      (p) => getStatValue(p, "goals", "tournament_goals") >= parsedSearch.minGoals!
    );
  }
  if (parsedSearch.minMatches !== undefined) {
    enriched = enriched.filter(
      (p) => getStatValue(p, "matches", "tournament_matches") >= parsedSearch.minMatches!
    );
  }
  if (parsedSearch.minAssists !== undefined) {
    enriched = enriched.filter(
      (p) => getStatValue(p, "assists", "tournament_assists") >= parsedSearch.minAssists!
    );
  }

  // TOURNAMENT-AWARE SORTING
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

  switch (sortMode) {
    case "goals":
    case "tournament_goals":
      enriched.sort((a, b) => {
        const goalDiff =
          metric(b, "goals", "tournament_goals") -
          metric(a, "goals", "tournament_goals");
        if (goalDiff !== 0) return goalDiff;

        // Tiebreaker 1: assists (higher is better)
        const assistDiff =
          metric(b, "assists", "tournament_assists") -
          metric(a, "assists", "tournament_assists");
        if (assistDiff !== 0) return assistDiff;

        // Tiebreaker 2: alphabetical by last name
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      });
      break;
    case "matches":
      enriched.sort((a, b) => {
        const matchDiff =
          metric(b, "matches", "tournament_matches") -
          metric(a, "matches", "tournament_matches");
        if (matchDiff !== 0) return matchDiff;

        // Tiebreaker 1: goals (higher is better)
        const goalDiff =
          metric(b, "goals", "tournament_goals") -
          metric(a, "goals", "tournament_goals");
        if (goalDiff !== 0) return goalDiff;

        // Tiebreaker 2: alphabetical by last name
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      });
      break;
    case "wins":
      enriched.sort((a, b) => {
        const winDiff =
          metric(b, "wins", "tournament_wins") -
          metric(a, "wins", "tournament_wins");
        if (winDiff !== 0) return winDiff;

        // Tiebreaker 1: matches (more matches played as tiebreaker)
        const matchDiff =
          metric(b, "matches", "tournament_matches") -
          metric(a, "matches", "tournament_matches");
        if (matchDiff !== 0) return matchDiff;

        // Tiebreaker 2: alphabetical by last name
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      });
      break;
    case "assists":
      enriched.sort((a, b) => {
        const assistDiff =
          metric(b, "assists", "tournament_assists") -
          metric(a, "assists", "tournament_assists");
        if (assistDiff !== 0) return assistDiff;

        // Tiebreaker 1: goals (higher is better)
        const goalDiff =
          metric(b, "goals", "tournament_goals") -
          metric(a, "goals", "tournament_goals");
        if (goalDiff !== 0) return goalDiff;

        // Tiebreaker 2: alphabetical by last name
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      });
      break;
    case "mvp":
      enriched.sort((a, b) => {
        const mvpDiff =
          metric(b, "mvp", "tournament_mvp") -
          metric(a, "mvp", "tournament_mvp");
        if (mvpDiff !== 0) return mvpDiff;

        // Tiebreaker 1: goals (higher is better)
        const goalDiff =
          metric(b, "goals", "tournament_goals") -
          metric(a, "goals", "tournament_goals");
        if (goalDiff !== 0) return goalDiff;

        // Tiebreaker 2: alphabetical by last name
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      });
      break;
    case "bestgk":
      enriched.sort((a, b) => {
        const gkDiff =
          metric(b, "best_gk", "tournament_best_gk") -
          metric(a, "best_gk", "tournament_best_gk");
        if (gkDiff !== 0) return gkDiff;

        // Tiebreaker 1: matches (more matches as GK)
        const matchDiff =
          metric(b, "matches", "tournament_matches") -
          metric(a, "matches", "tournament_matches");
        if (matchDiff !== 0) return matchDiff;

        // Tiebreaker 2: alphabetical by last name
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      });
      break;
  }

  // Apply pagination AFTER sorting when tournament filter is active
  // (for non-tournament filters, pagination was already applied in the query)
  let finalTotalCount = totalCount ?? 0;
  if (shouldDeferPagination) {
    // When we defer pagination, the totalCount should be the count AFTER all filters
    // (including stats filters) but BEFORE slicing for pagination
    finalTotalCount = enriched.length;
    enriched = enriched.slice(offset, offset + pageSize);
  }

  return (
    <div className="h-screen bg-black overflow-hidden">
      <PlayersClient
        initialPlayers={enriched}
        tournaments={tournaments}
        totalCount={finalTotalCount}
        currentPage={page}
        pageSize={pageSize}
        usePagination={true}
        initialSearchQuery={rawSearchTerm}
      />
    </div>
  );
}
