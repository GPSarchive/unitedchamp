// Server component — the home page's top-players cards, read from the
// ACTIVE season's pre-computed player_season_stats rows (contract §2.1):
// top scorers / assisters / MVPs / goalkeepers of the season, each with the
// player's primary team for that season.

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import type { TopPlayerData } from "@/components/cards/types";
import EditorialTopPlayers from "./EditorialTopPlayers";

type StatKey = "goals" | "assists" | "mvp_count" | "best_gk_count";

const SELECT = `player_id, matches, goals, assists, mvp_count, best_gk_count, primary_team_id,
  player:player_id(id, first_name, last_name, photo, deleted_at),
  team:primary_team_id(id, name, logo)`;

async function topBy(seasonLabel: string, key: StatKey) {
  const { data, error } = await supabaseAdmin
    .from("player_season_stats")
    .select(SELECT)
    .eq("season_label", seasonLabel)
    .gt(key, 0)
    .order(key, { ascending: false })
    .order("matches", { ascending: true }) // same tally in less football ranks higher
    .limit(6);
  if (error) console.error(`[home/top-players] ${key}:`, error.message);
  // Skip soft-deleted players, then trim back to the three cards.
  return (data ?? []).filter((r: any) => !r.player?.deleted_at).slice(0, 3);
}

function toEntry(stat: any): TopPlayerData {
  const p = stat.player as any;
  const team = stat.team as any;
  const teamLogoUrl = team?.logo ? resolveImageUrl(team.logo, ImageType.TEAM) : null;
  // Placeholder markers exist in both .svg and .jpg forms in the data.
  const hasRealPhoto = p?.photo && !String(p.photo).startsWith("/player-placeholder");
  const playerPhotoUrl = hasRealPhoto ? resolveImageUrl(p.photo, ImageType.PLAYER) : null;
  return {
    id: stat.player_id,
    firstName: p?.first_name ?? "",
    lastName: p?.last_name ?? "",
    photo: playerPhotoUrl ?? teamLogoUrl ?? "/player-placeholder.svg",
    goals: stat.goals ?? 0,
    assists: stat.assists ?? 0,
    matches: stat.matches ?? 0,
    mvpAwards: stat.mvp_count ?? 0,
    bestGkAwards: stat.best_gk_count ?? 0,
    teamName: team?.name ?? undefined,
    teamLogo: teamLogoUrl ?? undefined,
  };
}

export default async function EditorialTopPlayersSection() {
  const season = await getActiveSeasonCached();
  const label = season?.label ?? NO_SEASON;

  const [scorers, assisters, mvps, gks] = await Promise.all([
    topBy(label, "goals"),
    topBy(label, "assists"),
    topBy(label, "mvp_count"),
    topBy(label, "best_gk_count"),
  ]);

  return (
    <EditorialTopPlayers
      scorers={scorers.map(toEntry)}
      assisters={assisters.map(toEntry)}
      mvps={mvps.map(toEntry)}
      bestGks={gks.map(toEntry)}
    />
  );
}
