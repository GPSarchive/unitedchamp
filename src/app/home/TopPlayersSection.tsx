// src/app/home/TopPlayersSection.tsx
// Async Server Component — fetches top player stats independently so the rest
// of the page can stream to the browser without waiting for these queries.

import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import { resolveImageUrl, ImageType } from '@/app/lib/image-config';
import TopScorers from './TopScorers';

async function fetchTopScorers() {
  const { data: statsData, error: statsError } = await supabaseAdmin
    .from('player_statistics')
    .select('player_id, total_goals, total_assists')
    .order('total_goals', { ascending: false })
    .limit(3);

  if (statsError || !statsData || statsData.length === 0) return [];

  const playerIds = statsData.map((s: any) => s.player_id);

  const [
    { data: playersData, error: playersError },
    { data: mpsData },
    { data: playerTeamsData },
  ] = await Promise.all([
    supabaseAdmin.from('player').select('id, first_name, last_name, photo').in('id', playerIds),
    supabaseAdmin.from('match_player_stats').select('player_id, match_id').in('player_id', playerIds),
    supabaseAdmin.from('player_teams').select('player_id, team_id').in('player_id', playerIds),
  ]);

  if (playersError) return [];

  const matchesByPlayer = new Map<number, Set<number>>();
  for (const row of (mpsData ?? [])) {
    if (!matchesByPlayer.has(row.player_id)) matchesByPlayer.set(row.player_id, new Set());
    matchesByPlayer.get(row.player_id)!.add(row.match_id);
  }

  const teamIds = Array.from(new Set((playerTeamsData ?? []).map((pt: any) => pt.team_id).filter(Boolean)));
  const { data: teamsData } = teamIds.length > 0
    ? await supabaseAdmin.from('teams').select('id, name, logo').in('id', teamIds)
    : { data: [] };

  const teamMap = new Map((teamsData ?? []).map((t: any) => [t.id, t]));
  const playerTeamMap = new Map((playerTeamsData ?? []).map((pt: any) => [pt.player_id, pt.team_id]));

  return statsData.map((stat: any) => {
    const player = playersData?.find((p: any) => p.id === stat.player_id);
    const teamId = playerTeamMap.get(stat.player_id);
    const team = teamId ? teamMap.get(teamId) : null;
    const matches = matchesByPlayer.get(stat.player_id)?.size ?? 0;
    const teamLogoUrl = team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null;
    const hasRealPhoto = player?.photo && player.photo !== '/player-placeholder.jpg';
    const playerPhotoUrl = hasRealPhoto ? resolveImageUrl(player.photo, ImageType.PLAYER) : null;
    return {
      id: stat.player_id,
      firstName: player?.first_name ?? '',
      lastName: player?.last_name ?? '',
      photo: playerPhotoUrl ?? teamLogoUrl ?? '/player-placeholder.jpg',
      goals: stat.total_goals ?? 0,
      assists: stat.total_assists ?? 0,
      matches,
      teamName: team?.name ?? undefined,
      teamLogo: teamLogoUrl ?? undefined,
    };
  });
}

async function fetchTopAssisters() {
  const { data: statsData, error: statsError } = await supabaseAdmin
    .from('player_statistics')
    .select('player_id, total_goals, total_assists')
    .order('total_assists', { ascending: false })
    .limit(3);

  if (statsError || !statsData || statsData.length === 0) return [];

  const playerIds = statsData.map((s: any) => s.player_id);

  const [
    { data: playersData, error: playersError },
    { data: mpsData },
    { data: playerTeamsData },
  ] = await Promise.all([
    supabaseAdmin.from('player').select('id, first_name, last_name, photo').in('id', playerIds),
    supabaseAdmin.from('match_player_stats').select('player_id, match_id').in('player_id', playerIds),
    supabaseAdmin.from('player_teams').select('player_id, team_id').in('player_id', playerIds),
  ]);

  if (playersError) return [];

  const matchesByPlayer = new Map<number, Set<number>>();
  for (const row of (mpsData ?? [])) {
    if (!matchesByPlayer.has(row.player_id)) matchesByPlayer.set(row.player_id, new Set());
    matchesByPlayer.get(row.player_id)!.add(row.match_id);
  }

  const teamIds = Array.from(new Set((playerTeamsData ?? []).map((pt: any) => pt.team_id).filter(Boolean)));
  const { data: teamsData } = teamIds.length > 0
    ? await supabaseAdmin.from('teams').select('id, name, logo').in('id', teamIds)
    : { data: [] };

  const teamMap = new Map((teamsData ?? []).map((t: any) => [t.id, t]));
  const playerTeamMap = new Map((playerTeamsData ?? []).map((pt: any) => [pt.player_id, pt.team_id]));

  return statsData.map((stat: any) => {
    const player = playersData?.find((p: any) => p.id === stat.player_id);
    const teamId = playerTeamMap.get(stat.player_id);
    const team = teamId ? teamMap.get(teamId) : null;
    const matches = matchesByPlayer.get(stat.player_id)?.size ?? 0;
    const teamLogoUrl = team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null;
    const hasRealPhoto = player?.photo && player.photo !== '/player-placeholder.jpg';
    const playerPhotoUrl = hasRealPhoto ? resolveImageUrl(player.photo, ImageType.PLAYER) : null;
    return {
      id: stat.player_id,
      firstName: player?.first_name ?? '',
      lastName: player?.last_name ?? '',
      photo: playerPhotoUrl ?? teamLogoUrl ?? '/player-placeholder.jpg',
      goals: stat.total_goals ?? 0,
      assists: stat.total_assists ?? 0,
      matches,
      teamName: team?.name ?? undefined,
      teamLogo: teamLogoUrl ?? undefined,
    };
  });
}

async function fetchTopMvps() {
  const { data: statsData, error: statsError } = await supabaseAdmin
    .from('player_career_stats')
    .select('player_id, total_goals, total_assists, total_mvp, total_matches, primary_team_id')
    .gt('total_mvp', 0)
    .order('total_mvp', { ascending: false })
    .limit(3);

  if (statsError || !statsData || statsData.length === 0) return [];

  const playerIds = statsData.map((s: any) => s.player_id);
  const teamIds = Array.from(new Set(statsData.map((s: any) => s.primary_team_id).filter(Boolean)));

  const [{ data: playersData, error: playersError }, { data: teamsData }] = await Promise.all([
    supabaseAdmin.from('player').select('id, first_name, last_name, photo').in('id', playerIds),
    teamIds.length > 0
      ? supabaseAdmin.from('teams').select('id, name, logo').in('id', teamIds)
      : Promise.resolve({ data: [] } as { data: any[] }),
  ]);

  if (playersError) return [];

  const teamMap = new Map((teamsData ?? []).map((t: any) => [t.id, t]));

  return statsData.map((stat: any) => {
    const player = playersData?.find((p: any) => p.id === stat.player_id);
    const team = stat.primary_team_id ? teamMap.get(stat.primary_team_id) : null;
    const teamLogoUrl = team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null;
    const hasRealPhoto = player?.photo && player.photo !== '/player-placeholder.jpg';
    const playerPhotoUrl = hasRealPhoto ? resolveImageUrl(player.photo, ImageType.PLAYER) : null;
    return {
      id: stat.player_id,
      firstName: player?.first_name ?? '',
      lastName: player?.last_name ?? '',
      photo: playerPhotoUrl ?? teamLogoUrl ?? '/player-placeholder.jpg',
      goals: stat.total_goals ?? 0,
      assists: stat.total_assists ?? 0,
      matches: stat.total_matches ?? 0,
      mvpAwards: stat.total_mvp ?? 0,
      teamName: team?.name ?? undefined,
      teamLogo: teamLogoUrl ?? undefined,
    };
  });
}

async function fetchTopBestGk() {
  const { data: statsData, error: statsError } = await supabaseAdmin
    .from('player_career_stats')
    .select('player_id, total_goals, total_assists, total_best_gk, total_matches, primary_team_id')
    .gt('total_best_gk', 0)
    .order('total_best_gk', { ascending: false })
    .limit(3);

  if (statsError || !statsData || statsData.length === 0) return [];

  const playerIds = statsData.map((s: any) => s.player_id);
  const teamIds = Array.from(new Set(statsData.map((s: any) => s.primary_team_id).filter(Boolean)));

  const [{ data: playersData, error: playersError }, { data: teamsData }] = await Promise.all([
    supabaseAdmin.from('player').select('id, first_name, last_name, photo').in('id', playerIds),
    teamIds.length > 0
      ? supabaseAdmin.from('teams').select('id, name, logo').in('id', teamIds)
      : Promise.resolve({ data: [] } as { data: any[] }),
  ]);

  if (playersError) return [];

  const teamMap = new Map((teamsData ?? []).map((t: any) => [t.id, t]));

  return statsData.map((stat: any) => {
    const player = playersData?.find((p: any) => p.id === stat.player_id);
    const team = stat.primary_team_id ? teamMap.get(stat.primary_team_id) : null;
    const teamLogoUrl = team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null;
    const hasRealPhoto = player?.photo && player.photo !== '/player-placeholder.jpg';
    const playerPhotoUrl = hasRealPhoto ? resolveImageUrl(player.photo, ImageType.PLAYER) : null;
    return {
      id: stat.player_id,
      firstName: player?.first_name ?? '',
      lastName: player?.last_name ?? '',
      photo: playerPhotoUrl ?? teamLogoUrl ?? '/player-placeholder.jpg',
      goals: stat.total_goals ?? 0,
      assists: stat.total_assists ?? 0,
      matches: stat.total_matches ?? 0,
      bestGkAwards: stat.total_best_gk ?? 0,
      teamName: team?.name ?? undefined,
      teamLogo: teamLogoUrl ?? undefined,
    };
  });
}

export default async function TopPlayersSection() {
  const [topScorers, topAssisters, topMvps, topBestGks] = await Promise.all([
    fetchTopScorers(),
    fetchTopAssisters(),
    fetchTopMvps(),
    fetchTopBestGk(),
  ]);

  return (
    <TopScorers
      scorers={topScorers}
      assisters={topAssisters}
      mvps={topMvps}
      bestGks={topBestGks}
    />
  );
}
