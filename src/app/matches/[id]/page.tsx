//matches/[id]/page.tsx
export const revalidate = 0;

import TeamBadge from "./TeamBadge";
import TeamPlayers from "./TeamPlayers";
import StatsEditor from "./StatsEditor";

import { saveAllStatsAction } from "./actions";
import { fetchMatch, fetchPlayersForTeam, fetchMatchStatsMap } from "./queries";
import { parseId, extractYouTubeId, formatStatus } from "./utils";
import { notFound } from "next/navigation";
import type { Id } from "@/app/lib/types";

export default async function MatchPage({
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

  const [teamAPlayers, teamBPlayers] = await Promise.all([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
  ]);

  const existingStats = await fetchMatchStatsMap(match.id);
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

  const aIsWinner = match.winner_team_id && match.winner_team_id === match.team_a.id;
  const bIsWinner = match.winner_team_id && match.winner_team_id === match.team_b.id;

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-6">
      {/* Header / Scoreboard */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <TeamBadge team={match.team_a} highlight={!!aIsWinner} />

          <div className="min-w-[180px] text-center">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {formatStatus(match.status)}
            </div>
            <div className="text-4xl font-bold leading-none">
              {match.team_a_score} <span className="text-gray-400">-</span> {match.team_b_score}
            </div>
            <div className="text-sm text-gray-500">{dateLabel}</div>
          </div>

          <TeamBadge team={match.team_b} className="text-right" highlight={!!bIsWinner} />
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
              No video provided. Append <code>?video=YOUTUBE_ID_OR_URL</code> to the page URL to
              embed the match video.
            </p>
          </div>
        )}
      </section>

      {/* Admin – Match Stats CRUD */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Admin: Match Player Stats</h2>
        <p className="mb-4 text-xs text-gray-500">
          Update per-player stats for this match. Click <strong>Save all</strong> to apply changes
          in one go.
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
    </div>
  );
}
