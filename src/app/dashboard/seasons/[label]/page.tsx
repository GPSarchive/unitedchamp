// app/dashboard/seasons/[label]/page.tsx
// SERVER: one season for admins — stored snapshot vs live compute, the
// season's tournaments and teams (linking to the by-id editors), and the
// manual-adjustments panel with the season FIXED.
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { computeSeasonStandingRows, getSeasonStandings } from "@/app/lib/refreshStandings";
import { lineFromStoredRow } from "@/app/geniki-katataxi/standingsShape";
import SeasonDetailClient, { type StandingSlim } from "./SeasonDetailClient";

export const dynamic = "force-dynamic";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ label: string }>;
}) {
  const { label: raw } = await params;
  const label = decodeURIComponent(raw);
  const season = await getSeasonByLabel(label);
  if (!season) notFound();

  const [stored, live, toursRes, teamsRes, recapRes, statsRes] = await Promise.all([
    getSeasonStandings(label),
    computeSeasonStandingRows(label).catch((err) => {
      console.error("[dashboard/seasons/[label]] live compute error:", err);
      return null;
    }),
    supabaseAdmin
      .from("tournaments")
      .select("id, name, status, winner_team_id")
      .eq("season", label)
      .order("id", { ascending: true }),
    supabaseAdmin
      .from("teams")
      .select("id, name, logo, deleted_at")
      .eq("season_label", label)
      .order("name", { ascending: true }),
    supabaseAdmin.from("season_recaps").select("generated_at").eq("season_label", label).maybeSingle(),
    supabaseAdmin
      .from("player_season_stats")
      .select("*", { count: "exact", head: true })
      .eq("season_label", label),
  ]);

  const slim = (r: {
    team_id: number;
    rank: number;
    points: number;
    wins: number;
    draws: number;
    losses: number;
    matches_played: number;
    goals_for: number;
    goals_against: number;
    clean_sheets: number;
    longest_win_streak: number;
    adjustment_points: number;
  }): StandingSlim => ({
    team_id: r.team_id,
    rank: r.rank,
    points: r.points,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    matches_played: r.matches_played,
    goals_for: r.goals_for,
    goals_against: r.goals_against,
    clean_sheets: r.clean_sheets,
    longest_win_streak: r.longest_win_streak,
    adjustment_points: r.adjustment_points,
  });

  const storedSlim = stored.map(slim);
  const liveSlim = live ? live.map(slim) : null;
  const liveEvents = live ? live.flatMap((r) => r.events).filter((e) => !e.cancelsSourceKey) : [];
  const liveLines = live ? live.map((r) => lineFromStoredRow({ ...r, refreshed_at: "" })) : [];

  const teams = ((teamsRes.data ?? []) as {
    id: number;
    name: string | null;
    logo: string | null;
    deleted_at: string | null;
  }[]).map((t) => ({ id: t.id, name: t.name ?? `Ομάδα #${t.id}`, logo: t.logo, deleted: !!t.deleted_at }));

  return (
    <SeasonDetailClient
      season={{
        label: season.label,
        display_label: season.display_label,
        status: season.status,
        started_on: season.started_on,
        ended_on: season.ended_on,
      }}
      stored={storedSlim}
      storedRefreshedAt={stored[0]?.refreshed_at ?? null}
      live={liveSlim}
      teams={teams}
      tournaments={((toursRes.data ?? []) as {
        id: number;
        name: string | null;
        status: string;
        winner_team_id: number | null;
      }[]).map((t) => ({
        id: t.id,
        name: (t.name ?? "").trim() || `Τουρνουά #${t.id}`,
        status: t.status,
        winner_team_id: t.winner_team_id,
      }))}
      recapGeneratedAt={(recapRes.data?.generated_at as string | undefined) ?? null}
      statsRows={statsRes.count ?? 0}
      adjustments={{ events: liveEvents, lines: liveLines }}
    />
  );
}
