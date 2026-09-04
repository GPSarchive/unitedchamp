// app/dashboard/geniki-katataxi/page.tsx
// SERVER: computes the full Γενική Κατάταξη (per-team totals + every points award,
// automatic and manual) and hands it to the client. Auth is enforced by the dashboard
// layout; the server actions re-check the admin role on every write. The admin panel
// uses the same season model as the live public page ("field").

import Link from "next/link";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import { NO_SEASON_LABEL } from "@/app/geniki-katataxi/rules";
import { computeGeneralStandings, type TeamSeasonLine } from "@/app/geniki-katataxi/points";
import AdjustmentsClient from "./AdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Active season only (contract Phase 5). Archived seasons' adjustments are
  // granted from /dashboard/seasons/[label] and published by re-snapshot.
  const active = await getActiveSeasonCached();
  const label = active?.label ?? NO_SEASON;
  const [teamsRes, standings] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name, logo")
      .eq("season_label", label)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    computeGeneralStandings({ seasonScope: { onlyLabel: label } }).catch((err) => {
      console.error("[dashboard/geniki-katataxi] compute error:", err);
      return null;
    }),
  ]);

  const teams = ((teamsRes.data ?? []) as { id: number; name: string | null; logo: string | null }[]).map(
    (t) => ({ id: t.id, name: t.name ?? `Ομάδα #${t.id}`, logo: t.logo })
  );

  const seasons = active ? [active.label] : (standings?.seasons ?? []);
  // The public log carries the counter-adjustment "cancel" rows as their own
  // adjustment events; the admin table pairs them to the source event instead of
  // listing them separately, so filter them out of the standalone log.
  const events = (standings?.events ?? []).filter((e) => !e.cancelsSourceKey);

  // Per-team season totals (the number the standings show), keyed by season so the
  // client can build one row per team with its total for the selected season.
  const linesBySeason: Record<string, TeamSeasonLine[]> = {};
  if (standings) {
    for (const [season, lines] of standings.bySeason) linesBySeason[season] = lines;
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-white/50">
        Ενεργή σεζόν: <span className="font-mono text-white/80">{active?.display_label ?? "—"}</span> ·
        παλαιότερες σεζόν στο{" "}
        <Link href="/dashboard/seasons" className="underline hover:text-white">
          /dashboard/seasons
        </Link>
        .
      </p>
      <AdjustmentsClient
        teams={teams}
        seasons={seasons.length ? seasons : [NO_SEASON_LABEL]}
        events={events}
        linesBySeason={linesBySeason}
        adjustmentsAvailable={standings?.adjustmentsAvailable ?? false}
      />
    </div>
  );
}
