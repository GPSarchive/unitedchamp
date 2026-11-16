// One player's profile, exactly as the overlay shows it, shaped from the
// season's directory. Pure, so both places that open a profile build the same
// thing:
//   · the players page, which has the whole season in the browser already;
//   · the profile endpoint (/api/public/player-profile/[id]), which serves one
//     player to any other page with the new cards (the match page…).
import type { DirectoryPlayer, DirectoryTeam, DirectoryTournament, StatTuple } from "@/app/preview/paiktes-v2/model";
import type { DirectoryV3, PlayerExtra } from "./data";
import type { TableLine } from "./SeasonStats";
import { seasonStanding, type SeasonStanding } from "./standing";

export type PlayerProfile = {
  player: DirectoryPlayer;
  /** Active-season teams, main team first. */
  teams: DirectoryTeam[];
  extra: PlayerExtra | null;
  /** Where the player ranks this season among everyone in the directory. */
  standing: SeasonStanding | null;
  /** This season split by team, most matches first, each with its name and logo. */
  teamLines: TableLine[];
  /** The season's tournaments, in the directory's order. */
  tournaments: DirectoryTournament[];
  /** The season the profile is about, e.g. "2025/26": the current one, or the player's last. */
  seasonLabel: string | null;
  /** Archived player («πρώην»). Never set for players in the current squads. */
  former?: boolean;
};

/** One of a player's seasons: its storage label ("2025-2026") and totals. */
export type PlayerSeasonRow = { label: string; primaryTeamId: number | null; stats: StatTuple };

/**
 * Which season the profile of a player outside the current squads is about:
 * the current season if they have played in it (someone who left mid-season),
 * otherwise the last season they played in, otherwise the current one (empty).
 */
export function focusSeason(rows: readonly PlayerSeasonRow[], activeLabel: string): string {
  if (rows.some((r) => r.label === activeLabel && r.stats[0] > 0)) return activeLabel;
  const played = rows
    .filter((r) => r.stats[0] > 0)
    .map((r) => r.label)
    .sort((a, b) => b.localeCompare(a));
  return played[0] ?? activeLabel;
}

/**
 * The profile of player `id`, or null when they are not in the directory
 * (not in any active-season squad — see profileLoader.ts for everyone else).
 */
export function profileFor(data: DirectoryV3, id: number): PlayerProfile | null {
  const player = data.players.find((p) => p.id === id);
  if (!player) return null;

  const teamsById = new Map(data.teams.map((t) => [t.id, t] as const));
  const teams = player.teamIds
    .map((teamId) => teamsById.get(teamId))
    .filter((t): t is DirectoryTeam => t !== undefined);

  // A team archived during the season is not in the directory: it is named
  // from `extraTeams` and gets no link.
  const extraTeamsById = new Map(data.extraTeams.map((t) => [t.id, t] as const));
  const extra = data.extras[id] ?? null;
  const teamLines: TableLine[] = (extra?.teams ?? []).map((line) => {
    const listed = teamsById.get(line.teamId);
    const team = listed ?? extraTeamsById.get(line.teamId);
    return {
      key: `team-${line.teamId}`,
      label: team?.name || "Ομάδα",
      href: listed ? `/OMADA/${line.teamId}` : null,
      logo: team?.logo ?? null,
      stats: line.stats,
    };
  });

  return {
    player,
    teams,
    extra,
    standing: seasonStanding(data.players, id),
    teamLines,
    // Only the tournaments the player has numbers in: the rest would print nothing.
    tournaments: data.tournaments.filter((t) => player.byTournament[t.id] !== undefined),
    seasonLabel: data.seasonLabel,
  };
}
