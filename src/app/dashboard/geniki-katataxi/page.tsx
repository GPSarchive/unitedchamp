// app/dashboard/geniki-katataxi/page.tsx
// SERVER: loads teams, known seasons and existing manual adjustments, and hands
// them to the client CRUD. Auth is enforced by the dashboard layout; the server
// actions re-check the admin role on every write.

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { NO_SEASON_LABEL } from "@/app/geniki-katataxi/rules";
import AdjustmentsClient, { type AdjustmentRow } from "./AdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [teamsRes, tournamentsRes, adjustmentsRes] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabaseAdmin.from("tournaments").select("season"),
    supabaseAdmin
      .from("season_team_adjustments")
      .select("id, season, team_id, kind, points, reason, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const teams = (teamsRes.data ?? []) as { id: number; name: string | null }[];

  const seasons = [
    ...new Set(
      ((tournamentsRes.data ?? []) as { season: string | null }[])
        .map((t) => (t.season ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => b.localeCompare(a, "el", { numeric: true }));

  // If the table doesn't exist yet the query errors — surface that to the client
  // so it can point at the pending migration instead of showing an empty list.
  const tableMissing = Boolean(adjustmentsRes.error);
  if (adjustmentsRes.error) {
    console.error(
      "[dashboard/geniki-katataxi] adjustments load error:",
      adjustmentsRes.error.message
    );
  }
  const rows = (adjustmentsRes.data ?? []) as AdjustmentRow[];

  return (
    <AdjustmentsClient
      teams={teams.map((t) => ({ id: t.id, name: t.name ?? `Ομάδα #${t.id}` }))}
      seasons={seasons.length ? seasons : [NO_SEASON_LABEL]}
      rows={rows}
      tableMissing={tableMissing}
    />
  );
}
