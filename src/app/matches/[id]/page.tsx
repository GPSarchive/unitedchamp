// app/tournoua/match/[id]/page.tsx (your MatchPage)
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
import { createSupabaseRouteClient } from "@/app/lib/Server"; // ✅ same helper used in your routes

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ video?: string }>;
}) {
  // --- admin check (server-side) ---
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

  const [teamAPlayers, teamBPlayers] = await Promise.all([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
  ]);

  const existingStats = await fetchMatchStatsMap(match.id);
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

    <div className="container mx-auto max-w-6xl bg-zinc-950 [background-image:radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:18px_18px] space-y-8 px-4 py-6">
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
      <section className="grid gap-6 md:grid-cols-2">
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
              <div className="grid gap-6 md:grid-cols-2">
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

          {/* Admin – Match Result controls */}
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Admin: Match Result</h2>
            <p className="mb-3 text-xs text-gray-500">
              Scores and winner are derived from <code>match_player_stats</code>. Save player stats first, then recalculate or finalize.
              Ties are not allowed when finishing.
            </p>

            <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-gray-700">
              <div className="rounded border px-3 py-1.5 bg-gray-50">
                Computed (saved) totals — <strong>{match.team_a.name}</strong>: {aGoalsComputed} •{" "}
                <strong>{match.team_b.name}</strong>: {bGoalsComputed}
              </div>
              <div className="rounded border px-3 py-1.5 bg-gray-50">
                Current DB status: <span className="uppercase">{match.status}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <form action={recalcScoresFromStatsAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />
                <button
                  type="submit"
                  className="rounded border px-3 py-2 bg-zinc-900 text-white hover:bg-zinc-800"
                  title="Recompute team_a_score / team_b_score from saved player stats"
                >
                  Recalculate scores from stats
                </button>
              </form>

              <form action={finalizeFromStatsAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />
                <button
                  type="submit"
                  className="rounded border px-3 py-2 bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50"
                  disabled={!canFinalize}
                  title={canFinalize ? "Finish match using computed scores" : "Cannot finish a tie"}
                >
                  Finalize (set winner & finished)
                </button>
              </form>

              <form action={markScheduledAction}>
                <input type="hidden" name="match_id" value={String(match.id)} />
                <button
                  type="submit"
                  className="rounded border px-3 py-2 bg-white text-gray-900 hover:bg-gray-50"
                  title="Set status to 'scheduled' and clear winner"
                >
                  Mark as scheduled
                </button>
              </form>
            </div>
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
