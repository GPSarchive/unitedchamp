// src/app/paiktes/page.tsx — reads from pre-computed player_career_stats / player_tournament_stats
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import PlayersClient from "./PlayersClient";
import type { PlayerLite, ScopableStatKey } from "./types";
import { resolveStat } from "./types";
import {
  parseSearchQuery,
  normalizeForSearch,
  removeGreekDiacritics,
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
        .then(({ data }) => {
          const rows = (data ?? []) as T[];
          if (rows.length >= 10000) {
            console.error(
              `[paiktes] fetchInBatches truncated at 10000 for table "${table}" ` +
                `(${chunk.length} ids) — results incomplete`,
            );
          }
          return rows;
        }),
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
  // Canonical tournament id: finite AND positive, else null. Computed once so
  // every downstream check agrees (no mixed `Number.isFinite()` vs truthiness).
  // `?tournament_id=abc` (NaN), `?tournament_id=` (absent) and `?tournament_id=0`
  // all cleanly mean "no tournament".
  const rawTournamentId = sp?.tournament_id ? Number(sp.tournament_id) : NaN;
  const activeTournamentId: number | null =
    Number.isFinite(rawTournamentId) && rawTournamentId > 0
      ? rawTournamentId
      : null;
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
  if (activeTournamentId !== null) {
    const { data: tStatsRows } = await supabaseAdmin
      .from("player_tournament_stats")
      .select("player_id")
      .eq("tournament_id", activeTournamentId);

    tournamentPlayerIds = (tStatsRows ?? []).map((r) => r.player_id);
    if (tournamentPlayerIds.length === 0) tournamentPlayerIds = [];
  }

  // ── STAT FILTERS (goals:>N / matches:>N / assists:>N) ─────────────
  // Scoped-stat semantics (decision, 2026-06): when a tournament is selected,
  // these filter on the *tournament* value — matching the number displayed in
  // the list/card (PlayersClient sets isTournamentScoped = !!tournament_id, so
  // the UI shows tournament stats). The filter and the visible stat agree.
  //
  // - No tournament  → push the filter into SQL against player_career_stats
  //   (a real WHERE), so the DB returns only matching players AND an accurate
  //   count. No 10k-bounded JS recompute for this case.
  // - Tournament set → values live in player_tournament_stats and the tournament
  //   path already defers pagination, so the filter runs in JS over `enriched`
  //   (see the scoped stat-filter step below), using the tournament values.
  const hasStatFilter =
    parsedSearch.minGoals !== undefined ||
    parsedSearch.minMatches !== undefined ||
    parsedSearch.minAssists !== undefined;

  let statFilteredPlayerIds: number[] | null = null;
  if (hasStatFilter && activeTournamentId === null) {
    let careerStatQuery = supabaseAdmin
      .from("player_career_stats")
      .select("player_id")
      .limit(10000);
    if (parsedSearch.minGoals !== undefined) {
      careerStatQuery = careerStatQuery.gte("total_goals", parsedSearch.minGoals);
    }
    if (parsedSearch.minMatches !== undefined) {
      careerStatQuery = careerStatQuery.gte("total_matches", parsedSearch.minMatches);
    }
    if (parsedSearch.minAssists !== undefined) {
      careerStatQuery = careerStatQuery.gte("total_assists", parsedSearch.minAssists);
    }
    const { data: statRows } = await careerStatQuery;
    if (statRows && statRows.length >= 10000) {
      console.error(
        "[paiktes] career stat-filter result truncated at 10000 — counts may be wrong",
      );
    }
    statFilteredPlayerIds = (statRows ?? []).map((r) => r.player_id);
  }

  // ── Combine filters ───────────────────────────────────────────────
  // Intersection of every active id-set (team / tournament / career stats).
  const idSets = [
    teamFilteredPlayerIds,
    tournamentPlayerIds,
    statFilteredPlayerIds,
  ].filter((s): s is number[] => s !== null);

  let combinedPlayerIds: number[] | null = null;
  if (idSets.length > 0) {
    combinedPlayerIds = idSets.reduce((acc, set) => {
      const setIds = new Set(set);
      return acc.filter((id) => setIds.has(id));
    });
  }

  // ── Fetch players ─────────────────────────────────────────────────
  let playersQuery = supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, position, height_cm, birth_date", {
      count: "exact",
    })
    .is("deleted_at", null); // exclude soft-deleted players

  if (combinedPlayerIds !== null) {
    if (combinedPlayerIds.length === 0) {
      playersQuery = playersQuery.in("id", [-1]);
    } else {
      playersQuery = playersQuery.in("id", combinedPlayerIds);
    }
  }

  // Position filter.
  // Positions are vocabulary words ("Forward" / "Επιθετικός"), not names, so the
  // Greek↔Latin transliteration that normalizeForSearch adds is pure noise here:
  // transliterating "Forward" yields phonetic Greek letters that never match the
  // Greek *translation*. We only want the original + diacritic-stripped form, so
  // we normalize positions ourselves (case-folded, deduped) instead.
  if (parsedSearch.position && parsedSearch.position.length > 0) {
    const posFilters = Array.from(
      new Set(
        parsedSearch.position.flatMap((pos) => {
          const lower = pos.trim().toLowerCase();
          return [lower, removeGreekDiacritics(lower)];
        }),
      ),
    ).filter((f) => f.length > 0);

    if (posFilters.length === 1) {
      playersQuery = playersQuery.ilike("position", `%${posFilters[0]}%`);
    } else if (posFilters.length > 1) {
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

  // Defer pagination when we can't paginate at the DB level: a non-alpha sort
  // (the stat sort runs in JS after enrichment) or any tournament scope (stats
  // are overlaid and may be JS-filtered post-fetch). Non-scoped stat filters do
  // NOT defer — they're pushed into SQL above, so the DB count + .range() are
  // already correct for the filtered set.
  const shouldDeferPagination =
    activeTournamentId !== null || sortMode !== "alpha";

  const orderedQuery = () =>
    playersQuery
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

  // Helper: clamp `page` into [1, totalPages]. `top=N` is a HARD CAP on the
  // whole result set (decision 2026-06), so the effective total is
  // min(topN, rawTotal) and pagination only ranges within that cap.
  const effectiveTotal = (rawTotal: number) =>
    topN != null ? Math.min(topN, rawTotal) : rawTotal;
  const lastPage = (rawTotal: number) =>
    Math.max(1, Math.ceil(effectiveTotal(rawTotal) / pageSize));

  let p: PlayerRow[];
  // DB count for the non-deferred path only. The deferred path derives its total
  // from `enriched.length` after the JS sort/filter, so this stays 0 there.
  let rawTotalCount = 0;
  let clampedPage = page;

  if (shouldDeferPagination) {
    // Fetch the full (filtered) set. The top-cap and page-slice happen in JS
    // AFTER the sort step (see Pagination below), because `top=N` means "the N
    // best by the active sort", not the N alphabetically-first rows — so we must
    // sort the whole set before capping. Bounded only by the 10k ceiling here.
    const { data, error: pErr } = await orderedQuery().limit(10000);
    if (pErr) console.error("[paiktes] players query error:", pErr.message);
    p = (data ?? []) as PlayerRow[];
    if (p.length >= 10000) {
      console.error(
        "[paiktes] deferred players query truncated at 10000 — pagination/count will be wrong",
      );
    }
  } else {
    // DB-paginated path. `top` caps the window's upper bound; `page` is clamped
    // to the last page once the count is known (re-fetching only if the first
    // window landed past the cap, e.g. a deep-linked ?page=999).
    const capExclusive = topN != null ? topN : Infinity; // row index cap
    const windowEnd = Math.min(offset + pageSize, capExclusive) - 1;
    let data: PlayerRow[] | null = null;
    let count: number | null = null;
    if (windowEnd >= offset) {
      const res = await orderedQuery().range(offset, windowEnd);
      if (res.error) console.error("[paiktes] players query error:", res.error.message);
      data = res.data as PlayerRow[] | null;
      count = res.count ?? 0;
    } else {
      // Requested page is entirely past the top cap — fetch count only.
      const res = await orderedQuery().range(0, 0);
      if (res.error) console.error("[paiktes] players query error:", res.error.message);
      count = res.count ?? 0;
    }
    rawTotalCount = count ?? 0;
    clampedPage = Math.min(page, lastPage(rawTotalCount));

    if (clampedPage !== page || data === null) {
      // Re-fetch the correct (clamped) window. Rare: over-range page or a page
      // that fell past the top cap.
      const clampedOffset = (clampedPage - 1) * pageSize;
      const clampedEnd = Math.min(clampedOffset + pageSize, capExclusive) - 1;
      const res =
        clampedEnd >= clampedOffset
          ? await orderedQuery().range(clampedOffset, clampedEnd)
          : { data: [] as PlayerRow[] };
      p = (res.data ?? []) as PlayerRow[];
    } else {
      p = (data ?? []) as PlayerRow[];
    }
  }

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
  const tourneyByPlayer = new Map<number, TournamentStatsRow>();
  if (activeTournamentId !== null && playerIds.length > 0) {
    const tRows = await fetchInBatches<TournamentStatsRow>(
      "player_tournament_stats",
      "player_id",
      playerIds,
      "player_id, tournament_id, matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins",
    );
    // Filter to the active tournament (in case a player has stats in multiple)
    for (const r of tRows) {
      if (r.tournament_id === activeTournamentId) {
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
      photo: pl.photo ?? "/player-placeholder.svg",
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
    if (activeTournamentId !== null) {
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

  // ── Stat filters (tournament-scoped path only) ────────────────────
  // Non-scoped stat filters were pushed into SQL (see above) so `enriched`
  // already contains only matching players and the count is accurate.
  // When a tournament is scoped, pagination is deferred and we filter here on
  // the *tournament* values via resolveStat — agreeing with the displayed stat.
  if (hasStatFilter && activeTournamentId !== null) {
    if (parsedSearch.minGoals !== undefined) {
      enriched = enriched.filter(
        (p) => resolveStat(p, "goals", true) >= parsedSearch.minGoals!,
      );
    }
    if (parsedSearch.minMatches !== undefined) {
      enriched = enriched.filter(
        (p) => resolveStat(p, "matches", true) >= parsedSearch.minMatches!,
      );
    }
    if (parsedSearch.minAssists !== undefined) {
      enriched = enriched.filter(
        (p) => resolveStat(p, "assists", true) >= parsedSearch.minAssists!,
      );
    }
  }

  // ── Sorting ───────────────────────────────────────────────────────
  const hasTournament = activeTournamentId !== null;
  // resolveStat picks the tournament_* twin when scoped & defined, else career.
  const metric = (p: PLWithTGoals, key: ScopableStatKey): number =>
    resolveStat(p, key, hasTournament);

  switch (sortMode) {
    case "goals":
    case "tournament_goals":
      enriched.sort((a, b) => metric(b, "goals") - metric(a, "goals"));
      break;
    case "matches":
      enriched.sort((a, b) => metric(b, "matches") - metric(a, "matches"));
      break;
    case "wins":
      enriched.sort((a, b) => metric(b, "wins") - metric(a, "wins"));
      break;
    case "assists":
      enriched.sort((a, b) => metric(b, "assists") - metric(a, "assists"));
      break;
    case "mvp":
      enriched.sort((a, b) => metric(b, "mvp") - metric(a, "mvp"));
      break;
    case "bestgk":
      enriched.sort((a, b) => metric(b, "best_gk") - metric(a, "best_gk"));
      break;
  }

  // ── Pagination ────────────────────────────────────────────────────
  // Apply the top=N hard cap and page clamp so the header count, the page
  // window, and the visible rows all agree (no client-side re-slicing needed).
  let finalTotalCount: number;
  if (shouldDeferPagination) {
    // `enriched` is now fully sorted/filtered. Cap to the top N, then page.
    if (topN != null) enriched = enriched.slice(0, topN);
    finalTotalCount = enriched.length;
    clampedPage = Math.min(page, Math.max(1, Math.ceil(finalTotalCount / pageSize)));
    const start = (clampedPage - 1) * pageSize;
    enriched = enriched.slice(start, start + pageSize);
  } else {
    // Non-deferred: rawTotalCount is the DB count; the top cap shrinks the
    // effective total and the window was already fetched + clamped above.
    finalTotalCount = effectiveTotal(rawTotalCount);
  }

  return (
    <PlayersClient
      initialPlayers={enriched}
      tournaments={tournaments}
      totalCount={finalTotalCount}
      currentPage={clampedPage}
      pageSize={pageSize}
      usePagination={true}
      initialSearchQuery={rawSearchTerm}
    />
  );
}
