// app/dashboard/seasons/page.tsx
// SERVER: the season list with per-season counts. Auth is enforced by the
// dashboard layout; every server action re-checks the admin role.
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { listSeasons } from "@/app/lib/seasons";
import SeasonsView, { type SeasonCardData } from "./SeasonsView";

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const seasons = await listSeasons();

  const [toursRes, teamsRes, standingsRes, recapsRes, ...statsCounts] = await Promise.all([
    supabaseAdmin.from("tournaments").select("id, season"),
    supabaseAdmin.from("teams").select("id, season_label"),
    supabaseAdmin.from("season_team_standings").select("season_label").range(0, 4999),
    supabaseAdmin.from("season_recaps").select("season_label, generated_at"),
    ...seasons.map((s) =>
      supabaseAdmin
        .from("player_season_stats")
        .select("*", { count: "exact", head: true })
        .eq("season_label", s.label),
    ),
  ]);

  const count = (rows: { [k: string]: unknown }[] | null, key: string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const v = r[key] as string | null;
      if (!v) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  };
  const toursBy = count(toursRes.data, "season");
  const teamsBy = count(teamsRes.data, "season_label");
  const standingsBy = count(standingsRes.data, "season_label");
  const recapBy = new Map(
    (recapsRes.data ?? []).map((r) => [r.season_label as string, r.generated_at as string]),
  );

  const cards: SeasonCardData[] = seasons.map((s, i) => ({
    label: s.label,
    display_label: s.display_label,
    status: s.status,
    started_on: s.started_on,
    ended_on: s.ended_on,
    archived_at: s.archived_at,
    counts: {
      tournaments: toursBy.get(s.label) ?? 0,
      teams: teamsBy.get(s.label) ?? 0,
      standingsRows: standingsBy.get(s.label) ?? 0,
      statsRows: statsCounts[i]?.count ?? 0,
    },
    recapGeneratedAt: recapBy.get(s.label) ?? null,
  }));

  return <SeasonsView seasons={cards} />;
}
