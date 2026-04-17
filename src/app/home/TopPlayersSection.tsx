// src/app/home/TopPlayersSection.tsx
// Async Server Component — fetches top player stats independently so the rest
// of the page can stream to the browser without waiting for these queries.

import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import { resolveImageUrl, ImageType } from '@/app/lib/image-config';
import TopScorers from './TopScorers';

/** Round 1 — all 4 stat queries in parallel, each embedding player+team data */
async function fetchStatRows() {
  const [
    { data: scorerRows, error: scorersError },
    { data: assisterRows, error: assistersError },
    { data: mvpRows, error: mvpsError },
    { data: gkRows, error: gksError },
  ] = await Promise.all([
    supabaseAdmin
      .from('player_statistics')
      .select(`player_id, total_goals, total_assists,
        player:player_id(id, first_name, last_name, photo, deleted_at,
          player_teams(team_id, team:team_id(id, name, logo)))`)
      .order('total_goals', { ascending: false })
      .limit(6),

    supabaseAdmin
      .from('player_statistics')
      .select(`player_id, total_goals, total_assists,
        player:player_id(id, first_name, last_name, photo, deleted_at,
          player_teams(team_id, team:team_id(id, name, logo)))`)
      .order('total_assists', { ascending: false })
      .limit(6),

    supabaseAdmin
      .from('player_career_stats')
      .select(`player_id, total_goals, total_assists, total_mvp, total_matches, primary_team_id,
        player:player_id(id, first_name, last_name, photo, deleted_at),
        team:primary_team_id(id, name, logo)`)
      .gt('total_mvp', 0)
      .order('total_mvp', { ascending: false })
      .limit(6),

    supabaseAdmin
      .from('player_career_stats')
      .select(`player_id, total_goals, total_assists, total_best_gk, total_matches, primary_team_id,
        player:player_id(id, first_name, last_name, photo, deleted_at),
        team:primary_team_id(id, name, logo)`)
      .gt('total_best_gk', 0)
      .order('total_best_gk', { ascending: false })
      .limit(6),
  ]);

  // Filter out soft-deleted players, then trim back to 3
  const isActive = (row: any) => !(row?.player as any)?.deleted_at;

  return {
    scorerRows:   (scorerRows  ?? []).filter(isActive).slice(0, 3),
    assisterRows: (assisterRows ?? []).filter(isActive).slice(0, 3),
    mvpRows:      (mvpRows     ?? []).filter(isActive).slice(0, 3),
    gkRows:       (gkRows      ?? []).filter(isActive).slice(0, 3),
    scorersError, assistersError, mvpsError, gksError,
  };
}

/** Build entry for player_statistics rows (scorers/assisters) — team via player_teams embed */
function buildEmbeddedPlayerEntry(stat: any, matchCount: number) {
  const p = stat.player as any;
  const firstPt = Array.isArray(p?.player_teams) ? p.player_teams[0] : null;
  const team = firstPt?.team ?? null;
  const teamLogoUrl = team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null;
  const hasRealPhoto = p?.photo && p.photo !== '/player-placeholder.svg';
  const playerPhotoUrl = hasRealPhoto ? resolveImageUrl(p.photo, ImageType.PLAYER) : null;
  return {
    id: stat.player_id,
    firstName: p?.first_name ?? '',
    lastName: p?.last_name ?? '',
    photo: playerPhotoUrl ?? teamLogoUrl ?? '/player-placeholder.svg',
    goals: stat.total_goals ?? 0,
    assists: stat.total_assists ?? 0,
    matches: matchCount,
    teamName: team?.name ?? undefined,
    teamLogo: teamLogoUrl ?? undefined,
  };
}

/** Build entry for player_career_stats rows (MVPs/GKs) — team is a direct embed via primary_team_id */
function buildCareerEntry(stat: any, extraKey: string, extraField: string) {
  const p = stat.player as any;
  const team = stat.team as any;
  const teamLogoUrl = team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null;
  const hasRealPhoto = p?.photo && p.photo !== '/player-placeholder.svg';
  const playerPhotoUrl = hasRealPhoto ? resolveImageUrl(p.photo, ImageType.PLAYER) : null;
  return {
    id: stat.player_id,
    firstName: p?.first_name ?? '',
    lastName: p?.last_name ?? '',
    photo: playerPhotoUrl ?? teamLogoUrl ?? '/player-placeholder.svg',
    goals: stat.total_goals ?? 0,
    assists: stat.total_assists ?? 0,
    matches: stat.total_matches ?? 0,
    [extraKey]: stat[extraField] ?? 0,
    teamName: team?.name ?? undefined,
    teamLogo: teamLogoUrl ?? undefined,
  };
}

export default async function TopPlayersSection() {
  const { scorerRows, assisterRows, mvpRows, gkRows,
          scorersError, assistersError } = await fetchStatRows();

  // Round 2 — single match_player_stats query for all stats-based player IDs
  const statsPlayerIds = Array.from(new Set([
    ...(scorerRows ?? []).map((r: any) => r.player_id),
    ...(assisterRows ?? []).map((r: any) => r.player_id),
  ]));

  const { data: mpsData } = statsPlayerIds.length > 0
    ? await supabaseAdmin
        .from('match_player_stats')
        .select('player_id, match_id')
        .in('player_id', statsPlayerIds)
    : { data: [] as any[] };

  const matchesByPlayer = new Map<number, Set<number>>();
  for (const row of (mpsData ?? [])) {
    if (!matchesByPlayer.has(row.player_id)) matchesByPlayer.set(row.player_id, new Set());
    matchesByPlayer.get(row.player_id)!.add(row.match_id);
  }

  const topScorers = scorersError || !scorerRows?.length ? [] :
    scorerRows.map((stat: any) => buildEmbeddedPlayerEntry(stat, matchesByPlayer.get(stat.player_id)?.size ?? 0));

  const topAssisters = assistersError || !assisterRows?.length ? [] :
    assisterRows.map((stat: any) => buildEmbeddedPlayerEntry(stat, matchesByPlayer.get(stat.player_id)?.size ?? 0));

  const topMvps = !mvpRows?.length ? [] :
    mvpRows.map((stat: any) => buildCareerEntry(stat, 'mvpAwards', 'total_mvp'));

  const topBestGks = !gkRows?.length ? [] :
    gkRows.map((stat: any) => buildCareerEntry(stat, 'bestGkAwards', 'total_best_gk'));

  return (
    <TopScorers
      scorers={topScorers}
      assisters={topAssisters}
      mvps={topMvps}
      bestGks={topBestGks}
    />
  );
}
