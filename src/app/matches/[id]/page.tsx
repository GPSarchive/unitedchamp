// src/app/matches/[id]/page.tsx (OPTIMIZED - No Signing)
export const revalidate = 0;

import StatsEditor from "./StatsEditor";
import MatchVideoAdminForm from "./MatchVideoAdminForm";
import { saveAllStatsAction } from "./actions";
import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
  fetchParticipantsMap,
  fetchStandingsByStage,
} from "./queries";
import { parseId, extractYouTubeId, formatStatus } from "./utils";
import { notFound } from "next/navigation";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import { createSupabaseRSCClient } from "@/app/lib/supabase/Server";

import VantaBg from "@/app/lib/VantaBg";
import ShinyText from "./ShinyText";
import { TournamentImage } from "@/app/lib/OptimizedImage";

// NEW COMPONENTS
import WelcomeMessage from "./WelcomeMessage";
import TournamentHeader from "./TournamentHeader";
import TeamVersusScore from "./TeamVersusScore";
import MatchParticipantsShowcase from "./MatchParticipantsShowcase";
import TeamRostersDisplay from "./TeamRostersDisplay";
import TournamentStandings from "./TournamentStandings";

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

  // NO SIGNING - Keep raw path
  const tournamentLogo = match.tournament?.logo ?? null;

  // Debug: log match stage_id
  console.log("[Match Page] Match ID:", match.id, "Stage ID:", match.stage_id, "Group ID:", match.group_id);

  const [aRes, bRes, statsRes, partsRes, standingsRes] = await Promise.allSettled([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
    fetchMatchStatsMap(match.id),
    fetchParticipantsMap(match.id),
    match.stage_id ? fetchStandingsByStage(match.stage_id) : Promise.resolve([]),
  ]);

  const teamAPlayers: PlayerAssociation[] =
    aRes.status === "fulfilled" ? (aRes.value as PlayerAssociation[]) : [];
  const teamBPlayers: PlayerAssociation[] =
    bRes.status === "fulfilled" ? (bRes.value as PlayerAssociation[]) : [];
  const existingStats =
    statsRes.status === "fulfilled" ? statsRes.value : new Map();
  const participants =
    partsRes.status === "fulfilled" ? partsRes.value : new Map();
  const standings =
    standingsRes.status === "fulfilled" ? standingsRes.value : [];

  // Debug: log standings data
  console.log("[Match Page] Standings result:", {
    status: standingsRes.status,
    count: standings.length,
    data: standings,
  });

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

  // Video: prefer query param override, else DB column, and hide section when none
  const dbVideoRaw = match.video_url ?? null;
  const effectiveVideoInput = video ?? dbVideoRaw;
  const videoId = effectiveVideoInput ? extractYouTubeId(effectiveVideoInput) : null;

  const dateLabel = match.match_date
    ? new Date(match.match_date).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBD";

  const aIsWinner =
    match.winner_team_id && match.winner_team_id === match.team_a.id;
  const bIsWinner =
    match.winner_team_id && match.winner_team_id === match.team_b.id;

  // Prepare data for new components
  const isScheduled = match.status === "scheduled";
  const hasParticipants = participants.size > 0;
  const hasScores = match.team_a_score !== null && match.team_b_score !== null;
  const showWelcomeMessage = isScheduled && !hasParticipants && !hasScores;

  // Prepare scorers data
  const scorers = Array.from(existingStats.values())
    .filter((stat) => stat.goals > 0 || (stat.own_goals && stat.own_goals > 0))
    .map((stat) => {
      const player = [...teamAPlayers, ...teamBPlayers].find(
        (p) => p.player.id === stat.player_id
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

  // Prepare participants data
  const participantsData = Array.from(participants.values())
    .map((part) => {
      const player = [...teamAPlayers, ...teamBPlayers].find(
        (p) => p.player.id === part.player_id
      )?.player;
      if (!player) return null;
      const stats = existingStats.get(part.player_id);
      return {
        player: {
          id: player.id,
          first_name: player.first_name ?? null,
          last_name: player.last_name ?? null,
          photo: player.photo ?? null,
        },
        teamId: part.team_id,
        played: part.played,
        playerNumber: stats?.player_number ?? null,
      };
    })
    .filter((p) => p !== null);

  // Prepare full roster data for scheduled matches
  const rosterData = [
    ...teamAPlayers.map((pa) => ({
      player: {
        id: pa.player.id,
        first_name: pa.player.first_name ?? null,
        last_name: pa.player.last_name ?? null,
        photo: pa.player.photo ?? null,
      },
      teamId: match.team_a.id,
    })),
    ...teamBPlayers.map((pa) => ({
      player: {
        id: pa.player.id,
        first_name: pa.player.first_name ?? null,
        last_name: pa.player.last_name ?? null,
        photo: pa.player.photo ?? null,
      },
      teamId: match.team_b.id,
    })),
  ];

  return (
    <div className="relative min-h-dvh overflow-x-visible">
      {/* Fixed Vanta background that stays in place while content scrolls */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      <div className="container mx-auto max-w-6xl px-4 pt-6">
        {match.tournament && (
          <TournamentHeader
            logo={match.tournament.logo}
            name={match.tournament.name}
          />
        )}
      </div>

      <div className="container mx-auto max-w-6xl space-y-8 px-4 py-6">
        {dataLoadErrors.length > 0 && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200 text-sm">
            <p className="font-medium">Some data failed to load:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {dataLoadErrors.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Welcome Message for Unplayed Matches */}
        {showWelcomeMessage && <WelcomeMessage matchDate={match.match_date} />}

        {/* Team vs Score Display with Scorers */}
        <TeamVersusScore
          teamA={match.team_a}
          teamB={match.team_b}
          scoreA={match.team_a_score}
          scoreB={match.team_b_score}
          status={match.status}
          matchDate={match.match_date}
          referee={match.referee ?? null}
          winnerTeamId={match.winner_team_id}
          scorers={scorers}
        />

        {/* Show full rosters for scheduled matches, participants for finished matches */}
        {isScheduled && rosterData.length > 0 ? (
          <TeamRostersDisplay
            teamAId={match.team_a.id}
            teamBId={match.team_b.id}
            teamAName={match.team_a.name}
            teamBName={match.team_b.name}
            teamALogo={match.team_a.logo ?? null}
            teamBLogo={match.team_b.logo ?? null}
            rosterPlayers={rosterData}
          />
        ) : participantsData.length > 0 ? (
          <MatchParticipantsShowcase
            teamAId={match.team_a.id}
            teamBId={match.team_b.id}
            teamAName={match.team_a.name}
            teamBName={match.team_b.name}
            teamALogo={match.team_a.logo ?? null}
            teamBLogo={match.team_b.logo ?? null}
            participants={participantsData}
          />
        ) : null}

        {/* Match Video - only show if there is a valid videoId (DB or ?video= override) */}
        {videoId && (
          <section className="rounded-2xl border border-white/20 bg-black/50 p-5 shadow-lg backdrop-blur-sm">
            <h2
              className="mb-3 text-lg font-semibold text-white"
              style={{
                textShadow:
                  "2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
              }}
            >
              Match Video
            </h2>
            <div className="aspect-video w-full overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {/* Tournament Standings - After Video - Always shows, displays empty state if no data */}
        <TournamentStandings standings={standings} />

        {isAdmin ? (
          <>
            <section className="rounded-2xl border border-white/20 bg-black/50 p-5 shadow-lg backdrop-blur-sm">
              <h2
                className="mb-3 text-lg font-semibold text-white"
                style={{
                  textShadow:
                    "2px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                }}
              >
                Admin: Match Player Stats
              </h2>
              <p className="mb-4 text-xs text-white/70">
                Ενεργοποίησε <strong>Συμμετοχή</strong>, δήλωσε θέση/αρχηγό/GK και συμπλήρωσε
                στατιστικά. Πάτησε <strong>Save all</strong> για αποθήκευση.
              </p>

              <form id="stats-form" action={saveAllStatsAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />
                <div className="grid grid-cols-1 gap-6">
                  <StatsEditor
                    teamId={match.team_a.id}
                    teamName={match.team_a.name}
                    associations={teamAPlayers}
                    existing={existingStats}
                    participants={participants}
                  />
                  <StatsEditor
                    teamId={match.team_b.id}
                    teamName={match.team_b.name}
                    associations={teamBPlayers}
                    existing={existingStats}
                    participants={participants}
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
        ) : null}
      </div>
    </div>
  );
}
