// Season-recap data layer.
//
// Aggregates one season's story for the home-page "Ετήσια Ανασκόπηση" modal:
// totals, the Γενική Κατάταξη podium, tournament honours in chronological
// order, individual award leaders, and the season record book.
//
// The season is the ASSIGNED one (plans/seasonal-data-contract.md): the home
// modal shows the ACTIVE season's recap, falling back to the newest archived
// season's stored recap while the new season has no tournaments yet. Dates
// never pick the season. Everything is served through unstable_cache — the
// raw compute scans the season's matches and per-tournament player stats,
// which is too much work to repeat per request.

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import { formatSeason } from "@/app/geniki-katataxi/rules";
import { computeGeneralStandingsCached } from "@/app/geniki-katataxi/points";
import { getSeasonStandings } from "@/app/lib/refreshStandings";
import { getActiveSeason, listSeasons } from "@/app/lib/seasons";

export interface RecapPodiumTeam {
  teamId: number;
  name: string;
  logo: string | null;
  points: number;
  titles: number;
  wins: number;
}

export interface RecapHonour {
  tournamentId: number;
  name: string;
  logo: string | null;
  firstDate: string | null; // ISO of first match
  lastDate: string | null; // ISO of last match
  winnerName: string | null;
  winnerLogo: string | null;
  matches: number;
}

export interface RecapAward {
  playerId: number;
  name: string;
  photo: string | null;
  teamName: string | null;
  teamLogo: string | null;
  value: number;
  matches: number;
  goals: number;
  assists: number;
}

export interface RecapMatchRecord {
  teamAName: string;
  teamALogo: string | null;
  teamBName: string;
  teamBLogo: string | null;
  scoreA: number;
  scoreB: number;
  date: string | null;
  tournamentName: string | null;
}

/** Best single-match scoring performance by one player. */
export interface RecapHaulRecord {
  playerName: string;
  teamName: string | null;
  opponentName: string | null;
  goals: number;
  scoreA: number;
  scoreB: number;
  date: string | null;
}

export interface SeasonRecapData {
  /** DB-form season label, e.g. "2025-2026". */
  seasonLabel: string;
  /** Display form, e.g. "2025/26". */
  seasonDisplay: string;
  totals: {
    matches: number;
    goals: number;
    assists: number;
    mvpAwards: number;
    teams: number;
    players: number;
    tournaments: number;
  };
  podium: RecapPodiumTeam[]; // up to 3, rank order
  honours: RecapHonour[]; // chronological
  awards: {
    scorer: RecapAward | null;
    assister: RecapAward | null;
    mvp: RecapAward | null;
    gk: RecapAward | null;
  };
  records: {
    highestScoring: RecapMatchRecord | null;
    bestHaul: RecapHaulRecord | null;
    mostTeamWins: { teamName: string; teamLogo: string | null; wins: number } | null;
    mostAppearances: { playerName: string; matches: number } | null;
  };
  /** Finished matches per calendar month ("YYYY-MM"), chronological — archive sparkline. */
  months: { month: string; matches: number }[];
}

/**
 * Display-only winner overrides for the recap. The DB rows stay untouched —
 * these fill honours whose tournament has no winner_team_id recorded.
 * UL-GL PLAYOUTS 2025-2026 (#33) was won by ΦΟΝΙΚΑ ΡΑΚΟΥΝ Β (#57) — note the
 * B side, which is a separate team row from ΦΟΝΙΚΑ ΡΑΚΟΥΝ (#42) and carries
 * its own logo.
 */
const MANUAL_WINNER_OVERRIDES: Record<number, number> = { 33: 57 };

/**
 * Which player wins an award when the tally is tied. Editorial calls, not
 * data corrections: the stats stay as they are and the pick only applies
 * among players already level at the top.
 *
 * bgk — ΗΛΙΑΣ ΚΑΡΑΛΙΔΗΣ (#111), tied on 14 with ΜΠΑΚΟΓΙΑΝΝΗΣ and
 * ΘΕΟΔΟΥΛΙΔΗΣ; the league owner asked for him to be the one shown.
 */
const TIEBREAK_PREFERENCE: Record<string, number> = { bgk: 111 };

type PlayerAgg = {
  player_id: number;
  matches: number;
  goals: number;
  assists: number;
  mvp: number;
  bgk: number;
};

const PAGE = 1000;

async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

/** Start year of a "YYYY-YYYY" DB season label, or null. */
function startYearOfLabel(label: string): number | null {
  const m = /^(\d{4})-\d{4}$/.exec(label.trim());
  return m ? +m[1] : null;
}

/**
 * The recap of exactly one ASSIGNED season label; null when the label has no
 * tournaments yet. Used to snapshot a season into season_recaps (close /
 * re-snapshot) and, for the active season, by the home-page modal.
 */
async function computeSeasonRecap(forLabel: string): Promise<SeasonRecapData | null> {
  const { data: allTours, error: tErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, slug, season, logo, status, winner_team_id")
    .eq("season", forLabel)
    .order("id");
  if (tErr || !allTours?.length) return null;

  const seasonLabel = forLabel;

  const startYear = startYearOfLabel(seasonLabel);
  const seasonDisplay = startYear != null ? formatSeason(startYear) : seasonLabel;

  const tours = allTours.filter((t) => t.season === seasonLabel);
  const tids = tours.map((t) => t.id);
  if (!tids.length) return null;

  // ── Season matches (for totals, records, honour date ranges).
  const matches = await fetchAllPages<{
    id: number;
    tournament_id: number;
    match_date: string | null;
    status: string | null;
    team_a_id: number | null;
    team_b_id: number | null;
    team_a_score: number | null;
    team_b_score: number | null;
    winner_team_id: number | null;
  }>((from, to) =>
    supabaseAdmin
      .from("matches")
      .select(
        "id, tournament_id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id"
      )
      .in("tournament_id", tids)
      .order("id")
      .range(from, to)
  );

  const finished = matches.filter((m) => m.status === "finished");
  const totalGoals = finished.reduce(
    (s, m) => s + (m.team_a_score ?? 0) + (m.team_b_score ?? 0),
    0
  );

  // ── Per-player season aggregates from the per-tournament stats table.
  const pts = await fetchAllPages<{
    player_id: number;
    tournament_id: number;
    matches: number;
    goals: number;
    assists: number;
    mvp_count: number;
    best_gk_count: number;
  }>((from, to) =>
    supabaseAdmin
      .from("player_tournament_stats")
      .select("player_id, tournament_id, matches, goals, assists, mvp_count, best_gk_count")
      .in("tournament_id", tids)
      .range(from, to)
  );

  const agg = new Map<number, PlayerAgg>();
  for (const r of pts) {
    const a =
      agg.get(r.player_id) ??
      ({ player_id: r.player_id, matches: 0, goals: 0, assists: 0, mvp: 0, bgk: 0 } as PlayerAgg);
    a.matches += r.matches ?? 0;
    a.goals += r.goals ?? 0;
    a.assists += r.assists ?? 0;
    a.mvp += r.mvp_count ?? 0;
    a.bgk += r.best_gk_count ?? 0;
    agg.set(r.player_id, a);
  }
  const players = [...agg.values()];
  const totalAssists = players.reduce((s, p) => s + p.assists, 0);
  const totalMvps = players.reduce((s, p) => s + p.mvp, 0);

  // ── Γενική Κατάταξη podium (top 3 of this season): the STORED rows
  // (season_team_standings, written before the recap in every snapshot), with
  // the cached engine as fallback for a season that has no rows yet.
  let podiumLines: { teamId: number; points: number; titles: number; wins: number }[] = [];
  try {
    const stored = await getSeasonStandings(seasonLabel);
    if (stored.length > 0) {
      podiumLines = stored
        .slice(0, 3)
        .map((r) => ({ teamId: r.team_id, points: r.points, titles: r.titles, wins: r.wins }));
    } else {
      const standings = await computeGeneralStandingsCached();
      const lines = standings.bySeason.get(seasonLabel) ?? [];
      podiumLines = lines
        .slice(0, 3)
        .map((l) => ({ teamId: l.teamId, points: l.points, titles: l.titles, wins: l.wins }));
    }
  } catch (e) {
    console.error("[seasonRecap] podium lookup failed:", e);
    podiumLines = [];
  }

  // ── Award leaders (skip deleted/dummy players at lookup time).
  //
  // Ties are broken by TIEBREAK_PREFERENCE first, then by fewer matches (the
  // same tally in less football is the better season). Without an explicit
  // rule a tie resolves arbitrarily by row order, which is how the GK award —
  // a three-way tie on 14 this season — could otherwise change between runs.
  const rank = (p: PlayerAgg, key: keyof PlayerAgg) => {
    const preferred = TIEBREAK_PREFERENCE[key as string] === p.player_id ? 1 : 0;
    return { value: p[key] as number, preferred, matches: p.matches };
  };
  const topIdsByKey = (key: keyof PlayerAgg, n = 3) =>
    [...players]
      .sort((a, b) => {
        const ra = rank(a, key);
        const rb = rank(b, key);
        return rb.value - ra.value || rb.preferred - ra.preferred || ra.matches - rb.matches;
      })
      .slice(0, n);
  const candidateIds = [
    ...new Set(
      (["goals", "assists", "mvp", "bgk", "matches"] as (keyof PlayerAgg)[]).flatMap((k) =>
        topIdsByKey(k).map((p) => p.player_id)
      )
    ),
  ];
  const { data: playerRows } = await supabaseAdmin
    .from("player")
    .select(
      "id, first_name, last_name, photo, deleted_at, player_teams(team_id, team:team_id(id, name, logo))"
    )
    .in("id", candidateIds.length ? candidateIds : [-1]);

  const playerInfo = new Map(
    (playerRows ?? [])
      .filter((p: any) => !p.deleted_at)
      .map((p: any) => {
        const team = Array.isArray(p.player_teams) ? p.player_teams[0]?.team : null;
        // Placeholder markers exist in both .svg and .jpg forms in the data.
        const hasRealPhoto = p.photo && !String(p.photo).startsWith("/player-placeholder");
        return [
          p.id as number,
          {
            name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
            photo: hasRealPhoto ? resolveImageUrl(p.photo, ImageType.PLAYER) : null,
            teamName: (team?.name as string) ?? null,
            teamLogo: team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null,
          },
        ];
      })
  );

  const awardFor = (key: keyof PlayerAgg): RecapAward | null => {
    for (const p of topIdsByKey(key, 6)) {
      if ((p[key] as number) <= 0) return null;
      const info = playerInfo.get(p.player_id);
      if (!info) continue; // deleted/dummy — take the next leader
      return {
        playerId: p.player_id,
        name: info.name,
        photo: info.photo,
        teamName: info.teamName,
        teamLogo: info.teamLogo,
        value: p[key] as number,
        matches: p.matches,
        goals: p.goals,
        assists: p.assists,
      };
    }
    return null;
  };

  // ── Records.
  let highest: (typeof finished)[number] | null = null;
  for (const m of finished) {
    const tot = (m.team_a_score ?? 0) + (m.team_b_score ?? 0);
    const hTot = highest ? (highest.team_a_score ?? 0) + (highest.team_b_score ?? 0) : -1;
    if (tot > hTot) highest = m;
  }

  // Best single-match haul: the ≥5-goal rows are a handful across all seasons,
  // so pull them once and filter to this season's finished matches.
  const finishedById = new Map(finished.map((m) => [m.id, m]));
  const { data: haulRows } = await supabaseAdmin
    .from("match_player_stats")
    .select("match_id, player_id, team_id, goals")
    .gte("goals", 5)
    .order("goals", { ascending: false })
    .limit(200);
  const seasonHauls = (haulRows ?? []).filter((h) => finishedById.has(h.match_id));

  const winsByTeam = new Map<number, number>();
  for (const m of finished)
    if (m.winner_team_id)
      winsByTeam.set(m.winner_team_id, (winsByTeam.get(m.winner_team_id) ?? 0) + 1);
  const mostWinsEntry = [...winsByTeam.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  // ── Team lookups for podium, honours, records — one query.
  const neededTeamIds = [
    ...new Set(
      [
        ...podiumLines.map((l) => l.teamId),
        ...tours.map((t) => t.winner_team_id),
        ...tours.map((t) => MANUAL_WINNER_OVERRIDES[t.id]),
        ...seasonHauls.slice(0, 5).flatMap((h) => {
          const m = finishedById.get(h.match_id);
          return [h.team_id, m?.team_a_id, m?.team_b_id];
        }),
        highest?.team_a_id,
        highest?.team_b_id,
        mostWinsEntry?.[0],
      ].filter((x): x is number => typeof x === "number")
    ),
  ];
  const { data: teamRows } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo")
    .in("id", neededTeamIds.length ? neededTeamIds : [-1]);
  const teamInfo = new Map(
    (teamRows ?? []).map((t) => [
      t.id as number,
      { name: t.name as string, logo: t.logo ? resolveImageUrl(t.logo, ImageType.TEAM) : null },
    ])
  );

  // ── Honours, chronological by first match date.
  const rangeByTid = new Map<number, { first: string | null; last: string | null; count: number }>();
  for (const m of matches) {
    const r = rangeByTid.get(m.tournament_id) ?? { first: null, last: null, count: 0 };
    r.count += 1;
    if (m.match_date) {
      if (!r.first || m.match_date < r.first) r.first = m.match_date;
      if (!r.last || m.match_date > r.last) r.last = m.match_date;
    }
    rangeByTid.set(m.tournament_id, r);
  }
  const honours: RecapHonour[] = tours
    .map((t) => {
      const r = rangeByTid.get(t.id);
      const winnerId = t.winner_team_id ?? MANUAL_WINNER_OVERRIDES[t.id] ?? null;
      const winner = winnerId ? teamInfo.get(winnerId) : null;
      return {
        tournamentId: t.id,
        name: (t.name ?? "").trim(),
        logo: t.logo ? resolveImageUrl(t.logo, ImageType.TOURNAMENT) : null,
        firstDate: r?.first ?? null,
        lastDate: r?.last ?? null,
        winnerName: winner?.name ?? null,
        winnerLogo: winner?.logo ?? null,
        matches: r?.count ?? 0,
      };
    })
    .sort((a, b) => (a.firstDate ?? "9999").localeCompare(b.firstDate ?? "9999"));

  const matchRecord = (m: (typeof finished)[number] | null): RecapMatchRecord | null => {
    if (!m) return null;
    const a = m.team_a_id ? teamInfo.get(m.team_a_id) : null;
    const b = m.team_b_id ? teamInfo.get(m.team_b_id) : null;
    const tour = tours.find((t) => t.id === m.tournament_id);
    return {
      teamAName: a?.name ?? "—",
      teamALogo: a?.logo ?? null,
      teamBName: b?.name ?? "—",
      teamBLogo: b?.logo ?? null,
      scoreA: m.team_a_score ?? 0,
      scoreB: m.team_b_score ?? 0,
      date: m.match_date,
      tournamentName: tour?.name?.trim() ?? null,
    };
  };

  // Resolve the best haul to a non-deleted player, taking the next one down
  // if the leader's player row is gone.
  let bestHaul: RecapHaulRecord | null = null;
  if (seasonHauls.length) {
    const topHauls = seasonHauls.slice(0, 5);
    const { data: haulPlayers } = await supabaseAdmin
      .from("player")
      .select("id, first_name, last_name, deleted_at")
      .in("id", [...new Set(topHauls.map((h) => h.player_id))]);
    for (const h of topHauls) {
      const p = (haulPlayers ?? []).find((r: any) => r.id === h.player_id && !r.deleted_at);
      const m = finishedById.get(h.match_id);
      if (!p || !m) continue;
      const opponentId = m.team_a_id === h.team_id ? m.team_b_id : m.team_a_id;
      bestHaul = {
        playerName: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        teamName: teamInfo.get(h.team_id)?.name ?? null,
        opponentName: (opponentId && teamInfo.get(opponentId)?.name) || null,
        goals: h.goals,
        scoreA: m.team_a_score ?? 0,
        scoreB: m.team_b_score ?? 0,
        date: m.match_date,
      };
      break;
    }
  }

  const mostAppsPlayer = awardFor("matches");

  // ── Distinct entities.
  const { data: tt } = await supabaseAdmin
    .from("tournament_teams")
    .select("team_id")
    .in("tournament_id", tids);
  const distinctTeams = new Set((tt ?? []).map((r) => r.team_id)).size;

  return {
    seasonLabel,
    seasonDisplay,
    totals: {
      matches: finished.length,
      goals: totalGoals,
      assists: totalAssists,
      mvpAwards: totalMvps,
      teams: distinctTeams,
      players: players.filter((p) => p.matches > 0).length,
      tournaments: tours.length,
    },
    podium: podiumLines.map((l) => {
      const info = teamInfo.get(l.teamId);
      return {
        teamId: l.teamId,
        name: info?.name ?? `Ομάδα #${l.teamId}`,
        logo: info?.logo ?? null,
        points: l.points,
        titles: l.titles,
        wins: l.wins,
      };
    }),
    honours,
    awards: {
      scorer: awardFor("goals"),
      assister: awardFor("assists"),
      mvp: awardFor("mvp"),
      gk: awardFor("bgk"),
    },
    records: {
      highestScoring: matchRecord(highest),
      bestHaul,
      mostTeamWins: mostWinsEntry
        ? {
            teamName: teamInfo.get(mostWinsEntry[0])?.name ?? "—",
            teamLogo: teamInfo.get(mostWinsEntry[0])?.logo ?? null,
            wins: mostWinsEntry[1],
          }
        : null,
      mostAppearances: mostAppsPlayer
        ? { playerName: mostAppsPlayer.name, matches: mostAppsPlayer.matches }
        : null,
    },
    months: (() => {
      const byMonth = new Map<string, number>();
      for (const m of finished) {
        if (!m.match_date) continue;
        const key = m.match_date.slice(0, 7);
        byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
      }
      return [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, matches]) => ({ month, matches }));
    })(),
  };
}

/** Recap of exactly one season label (no cache) — for season_recaps snapshots. */
export async function computeSeasonRecapFor(seasonLabel: string): Promise<SeasonRecapData | null> {
  return computeSeasonRecap(seasonLabel);
}

export const SEASON_RECAP_CACHE_TAG = "season-recap";

const loadSeasonRecapCached = unstable_cache(
  async (): Promise<SeasonRecapData | null> => {
    try {
      // The ACTIVE season, while it has tournaments…
      const active = await getActiveSeason();
      if (active) {
        const live = await computeSeasonRecap(active.label);
        if (live) return live;
      }
      // …else the newest archived season's STORED recap (written at close /
      // re-snapshot) — right after a close the modal keeps telling last
      // season's story until the new one has something to show.
      const archived = (await listSeasons()).filter((s) => s.status === "archived");
      for (const s of archived) {
        const { data, error } = await supabaseAdmin
          .from("season_recaps")
          .select("payload")
          .eq("season_label", s.label)
          .maybeSingle();
        if (error) throw new Error(`season_recaps: ${error.message}`);
        if (data?.payload) return data.payload as SeasonRecapData;
      }
      return null;
    } catch (e) {
      console.error("[seasonRecap] compute failed:", e);
      return null;
    }
  },
  // Version the key when the payload shape or the season choice changes so a
  // deploy never serves a stale entry from the incremental cache.
  ["season-recap-v5"],
  { revalidate: 3600, tags: [SEASON_RECAP_CACHE_TAG] }
);

export async function loadSeasonRecap(): Promise<SeasonRecapData | null> {
  return loadSeasonRecapCached();
}
