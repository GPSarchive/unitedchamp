// src/app/matches/[id]/page.tsx (OPTIMIZED - No Signing)
export const revalidate = 0;

import TeamBadge from "./TeamBadge";
import ParticipantsStats from "./MatchStats";
import StatsEditor from "./StatsEditor";
import { saveAllStatsAction } from "./actions";
import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
  fetchParticipantsMap,
} from "./queries";
import { parseId, extractYouTubeId, formatStatus } from "./utils";
import { notFound } from "next/navigation";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import { createSupabaseRouteClient } from "@/app/lib/supabase/Server";
import VantaBg from "@/app/lib/VantaBg";
import ShinyText from "./ShinyText";
import { TournamentImage } from "@/app/lib/OptimizedImage"; // ✅ UPDATED

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
  const supabase = await createSupabaseRouteClient();
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

  // ✅ NO SIGNING - Keep raw path
  const tournamentLogo = match.tournament?.logo ?? null;

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

  // ✅ NO PHOTO SIGNING - Players already have raw paths

  const videoId = extractYouTubeId(video ?? null);

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

  return (
    <div className="relative min-h-dvh overflow-x-visible">
      <section className="absolute inset-0 -z-10"  />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />

      <div className="container mx-auto max-w-6xl px-4 pt-6">
        <div className="flex justify-center">
          <div className="pointer-events-none select-none">
            {/* ✅ UPDATED: Use TournamentImage */}
            {tournamentLogo ? (
              <div className="mb-3 flex justify-center">
                <TournamentImage
                  src={tournamentLogo}
                  alt={match.tournament?.name ?? "Tournament logo"}
                  width={160}
                  height={160}
                  className="h-14 w-auto rounded-md bg-white/5 p-2 ring-1 ring-white/10"
                  priority
                />
              </div>
            ) : null}

            <div className="mt-4 flex justify-center">
              <ShinyText
                text={
                  match.tournament?.name ??
                  `${match.team_a.name} vs ${match.team_b.name}`
                }
                speed={3}
                className="
                  text-center
                  text-3xl md:text-5xl
                  font-extrabold leading-tight tracking-tight
                  drop-shadow-[0_1px_0_rgba(0,0,0,.25)]
                "
              />
            </div>
          </div>
        </div>
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

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 shadow-sm backdrop-blur text-white">
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-8">
            <TeamBadge team={match.team_a} highlight={!!aIsWinner} />

            <div className="relative mx-auto min-w-[220px] text-center">
              <div className="text-xs uppercase tracking-wide text-white/70">
                {formatStatus(match.status)}
              </div>
              <div className="text-4xl font-bold leading-none text-white">
                {match.team_a_score}
                <span className="text-white/60">-</span>
                {match.team_b_score}
              </div>
              <div className="text-sm text-white/70">{dateLabel}</div>
              {match.referee && (
                <div className="mt-1 text-xs text-white/75">
                  Διαιτητής: <span className="font-medium">{match.referee}</span>
                </div>
              )}
            </div>

            <TeamBadge team={match.team_b} className="text-right" highlight={!!bIsWinner} />
          </div>

          <div className="my-6 h-px w-full bg-white/10" />

          <ParticipantsStats
            renderAs="embedded"
            labels={{ left: "Home", right: "Away" }}
            teamA={{ id: match.team_a.id, name: match.team_a.name }}
            teamB={{ id: match.team_b.id, name: match.team_b.name }}
            associationsA={teamAPlayers}
            associationsB={teamBPlayers}
            statsByPlayer={existingStats}
            participants={participants}
          />
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Match Video</h2>
          {videoId ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <p>
                No video provided. Append <code>?video=YOUTUBE_ID_OR_URL</code> to the page URL.
              </p>
            </div>
          )}
        </section>

        {isAdmin ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Admin: Match Player Stats</h2>
            <p className="mb-4 text-xs text-gray-500">
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
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Save all
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}
