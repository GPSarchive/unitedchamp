// src/app/matches/[id]/page.tsx
export const revalidate = 0;

import MatchHero from "./MatchHero";
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

function errMsg(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as any;
  return anyE?.message || anyE?.error?.message || JSON.stringify(anyE);
}

// Section Divider Component
function SectionDivider() {
  return (
    <div className="relative py-8">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-amber-700/50"></div>
      </div>
      <div className="relative flex justify-center">
        <div className="h-2 w-2 rotate-45 bg-amber-500/60"></div>
      </div>
    </div>
  );
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

  const videoId = extractYouTubeId(video ?? null);
  
  function formatNaiveISO(iso: string) {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return "TBD";
    const [_, y, mo, d, h, mi, s] = m;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)));
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(dt);
  }
  
  const dateLabel = match.match_date ? formatNaiveISO(match.match_date) : "TBD";

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-amber-600 via-orange-700 to-amber-900">
      {/* GRAND Hero Section */}
      <MatchHero
        teamA={match.team_a}
        teamB={match.team_b}
        tournament={match.tournament}
        score={{ a: match.team_a_score, b: match.team_b_score }}
        status={formatStatus(match.status)}
        date={dateLabel}
        referee={match.referee}
        winnerId={match.winner_team_id}
      />

      {/* Content Sections */}
      <div className="container mx-auto max-w-7xl space-y-0 px-4 py-8 sm:px-6 lg:px-8">
        {dataLoadErrors.length > 0 && (
          <>
            <div className="rounded-xl border border-red-500/50 bg-red-950/80 p-4 text-red-200 backdrop-blur-sm">
              <p className="font-semibold">⚠️ Some data failed to load:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {dataLoadErrors.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
            <SectionDivider />
          </>
        )}

        {/* Match Stats */}
        <ParticipantsStats
          renderAs="card"
          labels={{ left: "Home Squad", right: "Away Squad" }}
          teamA={{ id: match.team_a.id, name: match.team_a.name }}
          teamB={{ id: match.team_b.id, name: match.team_b.name }}
          associationsA={teamAPlayers}
          associationsB={teamBPlayers}
          statsByPlayer={existingStats}
          participants={participants}
        />

        <SectionDivider />

        {/* Match Video */}
        <section className="overflow-hidden rounded-2xl border border-amber-800/50 bg-black/90 p-4 shadow-2xl backdrop-blur-md sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white sm:text-2xl">Match Highlights</h2>
            <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-amber-500 to-transparent" />
          </div>
          {videoId ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-amber-700/40 shadow-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-amber-700/50 bg-neutral-900/70 p-8 text-center backdrop-blur-sm">
              <p className="text-sm text-amber-200/80 sm:text-base">
                No video available. Add <code className="rounded bg-amber-600/20 px-2 py-1 text-xs text-amber-300 sm:text-sm">?video=YOUTUBE_ID</code> to the URL.
              </p>
            </div>
          )}
        </section>

        {/* Admin Section - STACKED LAYOUT */}
        {isAdmin && (
          <>
            <SectionDivider />
            <section className="overflow-hidden rounded-2xl border border-amber-800/50 bg-black/90 p-4 shadow-2xl backdrop-blur-md sm:p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white sm:text-2xl">Admin Panel</h2>
                <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-amber-500 to-transparent" />
                <p className="mt-3 text-xs text-amber-200/80 sm:text-sm">
                  Ενεργοποίησε <strong className="text-amber-300">Συμμετοχή</strong>, δήλωσε θέση/αρχηγό/GK και συμπλήρωσε στατιστικά.
                </p>
              </div>

              <form id="stats-form" action={saveAllStatsAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />
                
                {/* STACKED: One column, vertical layout */}
                <div className="space-y-6">
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

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-sm font-semibold text-black shadow-lg transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_30px_rgba(251,191,36,0.6)] sm:w-auto sm:px-8"
                  >
                    💾 Save All Stats
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}