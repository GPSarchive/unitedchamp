// Match detail page — editorial broadsheet aesthetic, shared with /OMADA/[id]
// (Fraunces/Archivo/JetBrains/Figtree, #0a0a14 ground, #F3EFE6 ink, #fb923c
// orange, #E8B931 saffron, 2px borders + hard shadow).
//
// Carries the full admin surface (stats editor, video CRUD, postpone action,
// duplicate-player warning), gated behind isAdmin and reusing the shared
// server actions and components.
export const revalidate = 0;

import { notFound } from "next/navigation";
import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
  fetchParticipantsMap,
} from "./queries";
import { parseId, extractYouTubeId } from "./utils";
import { saveAllStatsAction } from "./actions";
import StatsEditor from "./StatsEditor";
import MatchVideoAdminForm from "./MatchVideoAdminForm";
import MatchAdminActions from "./MatchAdminActions";
import { createSupabaseRSCClient } from "@/app/lib/supabase/Server";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import MatchV2Client from "./MatchV2Client";

export const metadata = {
  title: "Αγώνας",
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
  const supabase = await createSupabaseRSCClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = Array.isArray(user?.app_metadata?.roles)
    ? (user!.app_metadata!.roles as string[]).includes("admin")
    : false;

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

  // Detect players who appear on both rosters (admin warning).
  const teamAPlayerIds = new Set(teamAPlayers.map((p) => p.player.id));
  const teamBPlayerIds = new Set(teamBPlayers.map((p) => p.player.id));
  const duplicatePlayerIds = new Set<number>();
  for (const playerId of teamAPlayerIds) {
    if (teamBPlayerIds.has(playerId)) {
      duplicatePlayerIds.add(playerId);
    }
  }

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
      adminSlot={
        isAdmin ? (
          <>
            {/* Admin Actions (Postpone Match) */}
            <MatchAdminActions
              match={{
                id: match.id,
                status: match.status,
                match_date: match.match_date,
                teamA: match.team_a,
                teamB: match.team_b,
              }}
            />

            <section className="rounded-2xl border border-white/20 bg-black/50 p-5 shadow-lg backdrop-blur-sm">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Admin: Match Player Stats
              </h2>
              <p className="mb-4 text-xs text-white/70">
                Ενεργοποίησε <strong>Συμμετοχή</strong>, δήλωσε θέση/αρχηγό/GK και
                συμπλήρωσε στατιστικά. Πάτησε <strong>Save all</strong> για
                αποθήκευση.
              </p>

              <form id="stats-form" action={saveAllStatsAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />

                {duplicatePlayerIds.size > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
                    <p className="font-semibold text-amber-200 text-sm">
                      ⚠️ Προσοχή: {duplicatePlayerIds.size} παίκτης/παίκτες
                      βρίσκονται και στις δύο ομάδες
                    </p>
                    <p className="mt-1 text-xs text-amber-200/80">
                      Βεβαιωθείτε ότι επισημαίνετε κάθε παίκτη ως "συμμετοχή" μόνο
                      σε ΜΙΑ ομάδα. Η επισήμανση παίκτη στις δύο ομάδες θα
                      προκαλέσει σφάλμα.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                  <StatsEditor
                    teamId={match.team_a.id}
                    teamName={match.team_a.name}
                    associations={teamAPlayers}
                    existing={existingStats}
                    participants={participants}
                    duplicatePlayerIds={duplicatePlayerIds}
                  />
                  <StatsEditor
                    teamId={match.team_b.id}
                    teamName={match.team_b.name}
                    associations={teamBPlayers}
                    existing={existingStats}
                    participants={participants}
                    duplicatePlayerIds={duplicatePlayerIds}
                  />
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="submit"
                    className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                  >
                    Save all
                  </button>
                </div>
              </form>
            </section>

            {/* Admin: Match video CRUD, at the very bottom */}
            <MatchVideoAdminForm
              matchId={match.id}
              initialVideoUrl={match.video_url ?? null}
            />
          </>
        ) : null
      }
    />
  );
}
