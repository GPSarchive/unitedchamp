// src/app/paiktes/page.tsx — reads from pre-computed player_career_stats / player_tournament_stats
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import PlayersClient from "./PlayersClient";
import type { PlayerLite } from "./types";
import {
  parseSearchQuery,
  normalizeForSearch,
} from "@/app/lib/searchUtils";

export const revalidate = 300;

const DEFAULT_PAGE_SIZE = 50;
const SUPABASE_BATCH_SIZE = 300;

async function fetchInBatches<T>(
  table: string,
  idColumn: string,
  ids: number[],
  selectColumns: string,
  batchSize = SUPABASE_BATCH_SIZE,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    chunks.push(ids.slice(i, i + batchSize));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabaseAdmin
        .from(table)
        .select(selectColumns)
        .in(idColumn, chunk)
        .limit(10000)
        .then(({ data }) => (data ?? []) as T[]),
    ),
  );
  return results.flat();
}

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
};

type TeamRow = { id: number; name: string | null; logo: string | null };

type CareerStatsRow = {
  player_id: number;
  total_matches: number;
  total_goals: number;
  total_assists: number;
  total_yellow_cards: number;
  total_red_cards: number;
  total_blue_cards: number;
  total_mvp: number;
  total_best_gk: number;
  total_wins: number;
  primary_team_id: number | null;
};

type TournamentStatsRow = {
  player_id: number;
  tournament_id: number;
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp_count: number;
  best_gk_count: number;
  wins: number;
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

  const parsedSearch = parseSearchQuery(rawSearchTerm);
  const pageSize = DEFAULT_PAGE_SIZE;

  // Fetch tournaments (for the filter dropdown)
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

  // ── TEAM FILTER → player ids ──────────────────────────────────────
  let teamFilteredPlayerIds: number[] | null = null;
  if (parsedSearch.team && parsedSearch.team.length > 0) {
    const teamSearchVariants = parsedSearch.team.flatMap((teamTerm) =>
      normalizeForSearch(teamTerm)
    );

    const teamConditions = teamSearchVariants
      .map((variant) => `name.ilike.%${variant}%`)
      .join(",");

    const { data: matchingTeams } = await supabaseAdmin
      .from("teams")
      .select("id")
      .or(teamConditions);

    if (matchingTeams && matchingTeams.length > 0) {
      const teamIds = matchingTeams.map((t) => t.id);
      const playerTeams = await fetchInBatches<{ player_id: number }>(
        "player_teams",
        "team_id",
        teamIds,
        "player_id",
      );
      teamFilteredPlayerIds = [...new Set(playerTeams.map((pt) => pt.player_id))];
    } else {
      teamFilteredPlayerIds = [];
    }
  }

  // ── TOURNAMENT FILTER → player ids (from pre-computed table) ──────
  let tournamentPlayerIds: number[] | null = null;
  if (Number.isFinite(tournamentId)) {
    const { data: tStatsRows } = await supabaseAdmin
      .from("player_tournament_stats")
      .select("player_id")
      .eq("tournament_id", tournamentId as number);

    tournamentPlayerIds = (tStatsRows ?? []).map((r) => r.player_id);
    if (tournamentPlayerIds.length === 0) tournamentPlayerIds = [];
  }

  // ── Combine filters ───────────────────────────────────────────────
  let combinedPlayerIds: number[] | null = null;

  if (teamFilteredPlayerIds !== null && tournamentPlayerIds !== null) {
    const teamSet = new Set(teamFilteredPlayerIds);
    combinedPlayerIds = tournamentPlayerIds.filter((id) => teamSet.has(id));
  } else if (teamFilteredPlayerIds !== null) {
    combinedPlayerIds = teamFilteredPlayerIds;
  } else if (tournamentPlayerIds !== null) {
    combinedPlayerIds = tournamentPlayerIds;
  }

  // ── Fetch players ─────────────────────────────────────────────────
  let playersQuery = supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, position, height_cm, birth_date", {
      count: "exact",
    });

  if (combinedPlayerIds !== null) {
    if (combinedPlayerIds.length === 0) {
      playersQuery = playersQuery.in("id", [-1]);
    } else {
      playersQuery = playersQuery.in("id", combinedPlayerIds);
    }
  }

  // Position filter
  if (parsedSearch.position && parsedSearch.position.length > 0) {
    const posFilters = parsedSearch.position
      .flatMap((pos) => normalizeForSearch(pos))
      .map((variant) => variant.toLowerCase());

    if (posFilters.length === 1) {
      playersQuery = playersQuery.ilike("position", `%${posFilters[0]}%`);
    } else {
      const positionConditions = posFilters
        .map((f) => `position.ilike.%${f}%`)
        .join(",");
      playersQuery = playersQuery.or(positionConditions);
    }
  }

  // Name search
  if (parsedSearch.text.length > 0) {
    const textSearchTerms = parsedSearch.text.join(" ");
    const searchVariants = normalizeForSearch(textSearchTerms);
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

  // Deferred pagination when sorting by stats (can't paginate before sorting)
  const shouldDeferPagination = !!tournamentId || sortMode !== "alpha";

  let playersQueryWithOrder = playersQuery
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (!shouldDeferPagination) {
    playersQueryWithOrder = playersQueryWithOrder.range(offset, offset + pageSize - 1);
  } else {
    playersQueryWithOrder = playersQueryWithOrder.limit(10000);
  }

  const {
    data: players,
    error: pErr,
    count: totalCount,
  } = await playersQueryWithOrder;

  if (pErr) console.error("[paiktes] players query error:", pErr.message);
  const p = (players ?? []) as PlayerRow[];
  const playerIds = p.map((x) => x.id);

  // ── Fetch pre-computed career stats (1 row per player) ────────────
  const careerRows = await fetchInBatches<CareerStatsRow>(
    "player_career_stats",
    "player_id",
    playerIds,
    "player_id, total_matches, total_goals, total_assists, total_yellow_cards, total_red_cards, total_blue_cards, total_mvp, total_best_gk, total_wins, primary_team_id",
  );
  const careerByPlayer = new Map(careerRows.map((r) => [r.player_id, r]));

  // ── Fetch pre-computed tournament stats (if tournament filter active) ──
  let tourneyByPlayer = new Map<number, TournamentStatsRow>();
  if (tournamentId && playerIds.length > 0) {
    const tRows = await fetchInBatches<TournamentStatsRow>(
      "player_tournament_stats",
      "player_id",
      playerIds,
      "player_id, tournament_id, matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins",
    );
    // Filter to the active tournament (in case a player has stats in multiple)
    for (const r of tRows) {
      if (r.tournament_id === tournamentId) {
        tourneyByPlayer.set(r.player_id, r);
      }
    }
  }

  // ── Fetch player_teams for team display ───────────────────────────
  const ptRows = await fetchInBatches<PlayerTeamRow>(
    "player_teams",
    "player_id",
    playerIds,
    "player_id, team_id",
  );

  const allTeamIdsSet = new Set(ptRows.map((r) => r.team_id).filter(Boolean));
  const allTeamIds = Array.from(allTeamIdsSet) as number[];

  const { data: teams } = allTeamIds.length
    ? await supabaseAdmin.from("teams").select("id, name, logo").in("id", allTeamIds)
    : { data: [] as TeamRow[] };

  const teamMap: Record<number, { id: number; name: string; logo: string | null }> = {};
  for (const t of teams ?? []) {
    teamMap[t.id] = { id: t.id, name: t.name ?? "", logo: t.logo };
  }

  // Group membership teams per player
  const teamsByPlayer = new Map<
    number,
    { id: number; name: string; logo: string | null }[]
  >();
  for (const r of ptRows) {
    if (r.team_id != null) {
      if (!teamsByPlayer.has(r.player_id)) teamsByPlayer.set(r.player_id, []);
      const teamData = teamMap[r.team_id];
      if (teamData) teamsByPlayer.get(r.player_id)!.push(teamData);
    }
  }

  // ── Build enriched player list ────────────────────────────────────
  const now = new Date();

  let enriched: PLWithTGoals[] = p.map((pl) => {
    const age = pl.birth_date
      ? Math.floor(
          (now.getTime() - new Date(pl.birth_date).getTime()) /
            (365.25 * 24 * 3600 * 1000)
        )
      : null;

    const career = careerByPlayer.get(pl.id);

    // Sort membership teams: primary_team_id first, then by name
    const membershipTeams = teamsByPlayer.get(pl.id) ?? [];
    const primaryId = career?.primary_team_id ?? null;
    const sortedTeams = [...membershipTeams].sort((a, b) => {
      if (a.id === primaryId && b.id !== primaryId) return -1;
      if (b.id === primaryId && a.id !== primaryId) return 1;
      return a.name.localeCompare(b.name);
    });
    const topTeams = sortedTeams.slice(0, 3);

    const result: PLWithTGoals = {
      id: pl.id,
      first_name: pl.first_name ?? "",
      last_name: pl.last_name ?? "",
      photo: pl.photo ?? "/player-placeholder.jpg",
      position: pl.position ?? "",
      height_cm: pl.height_cm ?? null,
      birth_date: pl.birth_date ?? null,
      age,
      teams: topTeams,
      team: topTeams[0] ?? null,
      matches: career?.total_matches ?? 0,
      goals: career?.total_goals ?? 0,
      assists: career?.total_assists ?? 0,
      yellow_cards: career?.total_yellow_cards ?? 0,
      red_cards: career?.total_red_cards ?? 0,
      blue_cards: career?.total_blue_cards ?? 0,
      mvp: career?.total_mvp ?? 0,
      best_gk: career?.total_best_gk ?? 0,
      wins: career?.total_wins ?? 0,
    };

    // Overlay tournament-scoped stats when tournament filter is active
    if (tournamentId) {
      const ts = tourneyByPlayer.get(pl.id);
      if (ts) {
        result.tournament_matches = ts.matches;
        result.tournament_goals = ts.goals;
        result.tournament_assists = ts.assists;
        result.tournament_yellow_cards = ts.yellow_cards;
        result.tournament_red_cards = ts.red_cards;
        result.tournament_blue_cards = ts.blue_cards;
        result.tournament_mvp = ts.mvp_count;
        result.tournament_best_gk = ts.best_gk_count;
        result.tournament_wins = ts.wins;
      }
    }

    return result;
  });

  // ── Stats filters ─────────────────────────────────────────────────
  if (parsedSearch.minGoals !== undefined) {
    enriched = enriched.filter((p) => p.goals >= parsedSearch.minGoals!);
  }
  if (parsedSearch.minMatches !== undefined) {
    enriched = enriched.filter((p) => p.matches >= parsedSearch.minMatches!);
  }
  if (parsedSearch.minAssists !== undefined) {
    enriched = enriched.filter((p) => p.assists >= parsedSearch.minAssists!);
  }

  // ── Sorting ───────────────────────────────────────────────────────
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

  // ── Pagination ────────────────────────────────────────────────────
  let finalTotalCount = totalCount ?? 0;
  if (shouldDeferPagination) {
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
