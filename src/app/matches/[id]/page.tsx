// app/tournoua/match/[id]/page.tsx
export const revalidate = 0;

import TeamBadge from "./TeamBadge";
import TeamPlayers from "./TeamPlayers";
import StatsEditor from "./StatsEditor";
import {
  saveAllStatsAction,
  recalcScoresFromStatsAction,
  finalizeFromStatsAction,
  markScheduledAction,
} from "./actions";
import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
} from "./queries";
import { parseId, extractYouTubeId, formatStatus } from "./utils";
import { notFound } from "next/navigation";
import type { Id } from "@/app/lib/types";
import { createSupabaseRouteClient } from "@/app/lib/supabase/Server";

function errMsg(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as any;
  // Surface Supabase-style fields if present
  return anyE?.message || anyE?.error?.message || JSON.stringify(anyE);
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ video?: string }>;
}) {
  // --- admin check (server-side) ---
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = Array.isArray(user?.app_metadata?.roles)
    ? (user!.app_metadata!.roles as string[]).includes("admin")
    : false;

  const { id: idStr } = await params;
  const { video } = await searchParams;
  const id = parseId(idStr) as Id | null;
  if (!id) return notFound();

  // Fetch match first (fail hard only here)
  const match = await fetchMatch(id);
  if (!match) return notFound();

  // Fetch the rest *resiliently* so a single failing query doesn't crash the page.
  const [aRes, bRes, statsRes] = await Promise.allSettled([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
    fetchMatchStatsMap(match.id),
  ]);

  const teamAPlayers = aRes.status === "fulfilled" ? aRes.value : [];
  const teamBPlayers = bRes.status === "fulfilled" ? bRes.value : [];
  const existingStats = statsRes.status === "fulfilled" ? statsRes.value : new Map();

  const dataLoadErrors: string[] = [];
  if (aRes.status === "rejected") dataLoadErrors.push(`Team A players: ${errMsg(aRes.reason)}`);
  if (bRes.status === "rejected") dataLoadErrors.push(`Team B players: ${errMsg(bRes.reason)}`);
  if (statsRes.status === "rejected") dataLoadErrors.push(`Match stats: ${errMsg(statsRes.reason)}`);

  const videoId = extractYouTubeId(video ?? null);

  const sumGoals = (teamId: number) => {
    let total = 0;
    for (const row of existingStats.values()) {
      if (row.team_id === teamId) total += row.goals;
    }
    return total;
  };
  const aGoalsComputed = sumGoals(match.team_a.id);
  const bGoalsComputed = sumGoals(match.team_b.id);
  const canFinalize = aGoalsComputed !== bGoalsComputed;

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
    <div className="min-h-dvh bg-zinc-950
      [background-image:radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)]
      [background-size:18px_18px]">

      <div className="container mx-auto max-w-6xl space-y-8 px-4 py-6">

        {/* Optional error banner (so you see the REAL DB/RLS message) */}
        {dataLoadErrors.length > 0 && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200 text-sm">
            <p className="font-medium">Some data failed to load:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {dataLoadErrors.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        {/* Header / Scoreboard */}
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <TeamBadge team={match.team_a} highlight={!!aIsWinner} />
            <div className="min-w-[180px] text-center">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                {formatStatus(match.status)}
              </div>
              <div className="text-4xl font-bold leading-none">
                {match.team_a_score}
                <span className="text-gray-400">-</span>
                {match.team_b_score}
              </div>
              <div className="text-sm text-gray-500">{dateLabel}</div>
            </div>
            <TeamBadge
              team={match.team_b}
              className="text-right"
              highlight={!!bIsWinner}
            />
          </div>
        </section>

        {/* Players */}
        <section className="grid grid-cols-1 gap-6">
          <TeamPlayers title={`${match.team_a.name} Players`} players={teamAPlayers} />
          <TeamPlayers title={`${match.team_b.name} Players`} players={teamBPlayers} alignRight />
        </section>

        {/* Video */}
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
                No video provided. Append{" "}
                <code>?video=YOUTUBE_ID_OR_URL</code> to the page URL to embed
                the match video.
              </p>
            </div>
          )}
        </section>

        {/* Admin-only sections */}
        {isAdmin ? (
          <>
            {/* Admin – Match Stats CRUD */}
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Admin: Match Player Stats</h2>
              <p className="mb-4 text-xs text-gray-500">
                Update per-player stats for this match. Click <strong>Save all</strong> to apply changes in one go.
              </p>
              <form action={saveAllStatsAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />
                <div className="grid grid-cols-1 gap-6">
                  <StatsEditor
                    teamId={match.team_a.id}
                    teamName={match.team_a.name}
                    associations={teamAPlayers}
                    existing={existingStats}
                  />
                  <StatsEditor
                    teamId={match.team_b.id}
                    teamName={match.team_b.name}
                    associations={teamBPlayers}
                    existing={existingStats}
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
          </>
        ) : (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Match Administration</h2>
            <p className="text-sm text-gray-600">You don’t have access to edit match stats.</p>
          </section>
        )}
      </div>
    </div>
  );
}
