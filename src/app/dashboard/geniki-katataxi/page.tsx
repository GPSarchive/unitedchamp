// app/dashboard/geniki-katataxi/page.tsx
// SERVER: computes the full Γενική Κατάταξη points log (automatic + manual) and
// hands it to the client CRUD. Auth is enforced by the dashboard layout; the
// server actions re-check the admin role on every write.

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { NO_SEASON_LABEL } from "@/app/geniki-katataxi/rules";
import { computeGeneralStandings } from "@/app/geniki-katataxi/points";
import AdjustmentsClient from "./AdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [teamsRes, standings] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    computeGeneralStandings().catch((err) => {
      console.error("[dashboard/geniki-katataxi] compute error:", err);
      return null;
    }),
  ]);

  const teams = ((teamsRes.data ?? []) as { id: number; name: string | null }[]).map((t) => ({
    id: t.id,
    name: t.name ?? `Ομάδα #${t.id}`,
  }));

  const seasons = standings?.seasons ?? [];
  // The public log carries the counter-adjustment "cancel" rows as their own
  // adjustment events; the admin table pairs them to the source event instead of
  // listing them separately, so filter them out of the standalone log.
  const events = (standings?.events ?? []).filter((e) => !e.cancelsSourceKey);

  return (
    <AdjustmentsClient
      teams={teams}
      seasons={seasons.length ? seasons : [NO_SEASON_LABEL]}
      events={events}
      adjustmentsAvailable={standings?.adjustmentsAvailable ?? false}
    />
  );
}
