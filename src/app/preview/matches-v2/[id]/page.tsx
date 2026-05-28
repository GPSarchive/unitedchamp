// Preview route — v2 match detail page in the editorial broadsheet aesthetic.
// Mirrors the styling system used in /OMADA/[id] and /preview/anakoinoseis-v2
// (Fraunces/Archivo/JetBrains/Figtree, #0a0a14 ground, #F3EFE6 ink, #fb923c
// orange, #E8B931 saffron, 2px borders + hard shadow). Public-facing only —
// admin sections from the live page are intentionally omitted here.
export const revalidate = 0;

import { notFound } from "next/navigation";
import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
  fetchParticipantsMap,
} from "@/app/matches/[id]/queries";
import { parseId, extractYouTubeId } from "@/app/matches/[id]/utils";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import MatchV2Client from "./MatchV2Client";

export const metadata = {
  title: "Αγώνας · v2 preview",
};

function errMsg(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as any;
  return anyE?.message || anyE?.error?.message || JSON.stringify(anyE);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ video?: string }>;
}) {
  const { id: idStr } = await params;
  const { video } = await searchParams;
  const id = parseId(idStr) as Id | null;
  if (!id) return notFound();

  const match = await fetchMatch(id);
  if (!match) return notFound();

  const [aRes, bRes, statsRes, partsRes] = await Promise.allSettled([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
    fetchMatchStatsMap(match.id),
    fetchParticipantsMap(match.id),
  ]);

  const teamAPlayers: PlayerAssociation[] =
    aRes.status === "fulfilled" ? (aRes.value as PlayerAssociation[]) : [];
  const teamBPlayers: PlayerAssociation[] =
    bRes.status === "fulfilled" ? (bRes.value as PlayerAssociation[]) : [];
  const existingStats =
    statsRes.status === "fulfilled" ? statsRes.value : new Map();
  const participants =
    partsRes.status === "fulfilled" ? partsRes.value : new Map();

  const dataLoadErrors: string[] = [];
  if (aRes.status === "rejected")
    dataLoadErrors.push(`Team A players: ${errMsg(aRes.reason)}`);
  if (bRes.status === "rejected")
    dataLoadErrors.push(`Team B players: ${errMsg(bRes.reason)}`);
  if (statsRes.status === "rejected")
    dataLoadErrors.push(`Match stats: ${errMsg(statsRes.reason)}`);
  if (partsRes.status === "rejected")
    dataLoadErrors.push(`Participants: ${errMsg(partsRes.reason)}`);

  const dbVideoRaw = match.video_url ?? null;
  const effectiveVideoInput = video ?? dbVideoRaw;
  const videoId = effectiveVideoInput ? extractYouTubeId(effectiveVideoInput) : null;

  const isScheduled = match.status === "scheduled";
  const hasParticipants = participants.size > 0;
  const hasScores = match.team_a_score !== null && match.team_b_score !== null;
  const showWelcomeMessage = isScheduled && !hasParticipants && !hasScores;

  const scorers = Array.from(existingStats.values())
    .filter((stat) => stat.goals > 0 || (stat.own_goals && stat.own_goals > 0))
    .map((stat) => {
      const player = [...teamAPlayers, ...teamBPlayers].find(
        (p) => p.player.id === stat.player_id,
      )?.player;
      return {
        player: player || {
          id: stat.player_id,
          first_name: "Unknown",
          last_name: "",
        },
        goals: stat.goals || 0,
        ownGoals: stat.own_goals || 0,
        teamId: stat.team_id,
      };
    });

  const participantsData = Array.from(participants.values())
    .map((part) => {
      const player = [...teamAPlayers, ...teamBPlayers].find(
        (p) => p.player.id === part.player_id,
      )?.player;
      if (!player) return null;
      const stats = existingStats.get(part.player_id) ?? null;
      return {
        player: {
          id: player.id,
          first_name: player.first_name ?? null,
          last_name: player.last_name ?? null,
          photo: player.photo ?? null,
        },
        teamId: part.team_id,
        played: part.played,
        stats,
        playerNumber: stats?.player_number ?? null,
      };
    })
    .filter((p) => p !== null);

  const rosterData = [
    ...teamAPlayers.map((pa) => ({
      player: {
        id: pa.player.id,
        first_name: pa.player.first_name ?? null,
        last_name: pa.player.last_name ?? null,
        photo: pa.player.photo ?? null,
        deleted_at: pa.player.deleted_at ?? null,
      },
      teamId: match.team_a.id,
    })),
    ...teamBPlayers.map((pa) => ({
      player: {
        id: pa.player.id,
        first_name: pa.player.first_name ?? null,
        last_name: pa.player.last_name ?? null,
        photo: pa.player.photo ?? null,
        deleted_at: pa.player.deleted_at ?? null,
      },
      teamId: match.team_b.id,
    })),
  ];

  return (
    <MatchV2Client
      match={{
        id: match.id,
        status: match.status,
        match_date: match.match_date,
        team_a_score: match.team_a_score,
        team_b_score: match.team_b_score,
        referee: match.referee ?? null,
        team_a: match.team_a,
        team_b: match.team_b,
        tournament: match.tournament
          ? {
              id: match.tournament.id,
              name: match.tournament.name,
              logo: match.tournament.logo ?? null,
            }
          : null,
      }}
      scorers={scorers}
      participants={participantsData}
      roster={rosterData}
      showWelcomeMessage={showWelcomeMessage}
      isScheduled={isScheduled}
      videoId={videoId}
      dataLoadErrors={dataLoadErrors}
    />
  );
}
