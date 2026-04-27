// PREVIEW v20 — restyled match page in the editorial sports-broadsheet language
// used by /OMADA, /tournaments, /paiktes and the live homepage.
// Server shell mirrors src/app/matches/[id]/page.tsx; visual rework lives in
// MatchClient.tsx.

export const revalidate = 0;

import { notFound } from "next/navigation";

import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
  fetchParticipantsMap,
  fetchStandingsByStage,
} from "@/app/matches/[id]/queries";
import { parseId, extractYouTubeId } from "@/app/matches/[id]/utils";
import StatsEditor from "@/app/matches/[id]/StatsEditor";
import MatchVideoAdminForm from "@/app/matches/[id]/MatchVideoAdminForm";
import { saveAllStatsAction } from "@/app/matches/[id]/actions";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import { createSupabaseRSCClient } from "@/app/lib/supabase/Server";

import MatchClient from "./MatchClient";

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

  const [aRes, bRes, statsRes, partsRes, standingsRes] = await Promise.allSettled([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
    fetchMatchStatsMap(match.id),
    fetchParticipantsMap(match.id),
    match.stage_id
      ? fetchStandingsByStage(match.stage_id)
      : Promise.resolve({
          standings: [],
          stageKind: null,
          stageName: null,
        } as import("@/app/matches/[id]/queries").StandingsResult),
  ]);

  const teamAPlayers: PlayerAssociation[] =
    aRes.status === "fulfilled" ? (aRes.value as PlayerAssociation[]) : [];
  const teamBPlayers: PlayerAssociation[] =
    bRes.status === "fulfilled" ? (bRes.value as PlayerAssociation[]) : [];
  const existingStats =
    statsRes.status === "fulfilled" ? statsRes.value : new Map();
  const participants =
    partsRes.status === "fulfilled" ? partsRes.value : new Map();
  const { standings, stageKind, stageName } =
    standingsRes.status === "fulfilled"
      ? standingsRes.value
      : {
          standings: [] as import("@/app/matches/[id]/queries").StandingRow[],
          stageKind: null,
          stageName: null,
        };

  const teamAPlayerIds = new Set(teamAPlayers.map((p) => p.player.id));
  const teamBPlayerIds = new Set(teamBPlayers.map((p) => p.player.id));
  const duplicatePlayerIds = new Set<number>();
  for (const playerId of teamAPlayerIds) {
    if (teamBPlayerIds.has(playerId)) duplicatePlayerIds.add(playerId);
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
  if (standingsRes.status === "rejected")
    dataLoadErrors.push(`Standings: ${errMsg(standingsRes.reason)}`);

  const dbVideoRaw = match.video_url ?? null;
  const effectiveVideoInput = video ?? dbVideoRaw;
  const videoId = effectiveVideoInput ? extractYouTubeId(effectiveVideoInput) : null;

  const isScheduled = match.status === "scheduled";
  const hasParticipants = participants.size > 0;
  const hasScores =
    match.team_a_score !== null && match.team_b_score !== null;
  const showWelcomeMessage = isScheduled && !hasParticipants && !hasScores;

  // Scorers (goal-only, own-goal counted on the benefiting team)
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

  // Unified timeline source (played participants with full per-match stats)
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

  // Full roster (scheduled matches)
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
    <>
      <MatchClient
        match={{
          id: match.id,
          status: match.status,
          match_date: match.match_date,
          team_a_score: match.team_a_score,
          team_b_score: match.team_b_score,
          referee: match.referee ?? null,
          team_a: match.team_a,
          team_b: match.team_b,
          tournament: match.tournament ?? null,
        }}
        scorers={scorers}
        participantsData={participantsData}
        rosterData={rosterData}
        standings={standings}
        stageKind={stageKind}
        stageName={stageName}
        videoId={videoId}
        showWelcomeMessage={showWelcomeMessage}
        dataLoadErrors={dataLoadErrors}
        isAdmin={isAdmin}
      />

      {/* Admin controls — unchanged behaviour, wrapped in editorial shell */}
      {isAdmin && (
        <section className="relative bg-[#08080f] text-[#F3EFE6]">
          <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6 md:py-14">
            <div className="mb-8 border-b-2 border-[#F3EFE6]/20 pb-3">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                <span className="h-[2px] w-8 bg-[#fb923c]" />
                Πίνακας Διαχειριστή
              </div>
              <h2
                className="mt-3 font-[var(--f-display)] font-black italic leading-none tracking-[-0.02em] text-[#F3EFE6]"
                style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
              >
                Επεξεργασία στατιστικών
              </h2>
            </div>

            <div className="border-2 border-[#F3EFE6]/15 bg-[#0a0a14] p-5 md:p-6 shadow-[6px_6px_0_0_#fb923c]">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
                Ενεργοποίησε Συμμετοχή, δήλωσε θέση/αρχηγό/GK και συμπλήρωσε στατιστικά
                · πάτα Save all για αποθήκευση.
              </p>

              <form id="stats-form" action={saveAllStatsAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />

                {duplicatePlayerIds.size > 0 && (
                  <div className="mb-4 border-2 border-[#E8B931]/40 bg-[#E8B931]/10 p-4">
                    <p className="font-[var(--f-display)] text-sm italic font-semibold text-[#E8B931]">
                      ⚠ {duplicatePlayerIds.size} παίκτης/παίκτες σε ΔΥΟ ρόστερ
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
                      Επισήμανε την συμμετοχή σε ΜΙΑ μόνο ομάδα.
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

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    className="group inline-flex items-center gap-3 border-2 border-[#fb923c] bg-[#fb923c] px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.3em] text-[#08080f] transition-all hover:bg-[#fb923c]/90"
                  >
                    Save all
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-8">
              <MatchVideoAdminForm
                matchId={match.id}
                initialVideoUrl={match.video_url ?? null}
              />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
