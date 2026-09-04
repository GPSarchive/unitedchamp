// app/seasons/[season]/katataxi/page.tsx — a season's full Γενική Κατάταξη
// from the stored rows, rendered by the same hall-of-champions view as the
// live page. Teams that left mid-season are shown (this is the archive).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { getSeasonStandings } from "@/app/lib/refreshStandings";
import StandingsViewGrand, { type TeamInfo } from "@/app/geniki-katataxi/StandingsViewGrand";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const { season } = await params;
  const row = await getSeasonByLabel(decodeURIComponent(season));
  return { title: row ? `Γενική Κατάταξη ${row.display_label}` : "Γενική Κατάταξη" };
}

export default async function SeasonStandingsPage({ params }: { params: Promise<{ season: string }> }) {
  const { season: raw } = await params;
  const label = decodeURIComponent(raw);
  const season = await getSeasonByLabel(label);
  if (!season) notFound();
  const hub = `/seasons/${encodeURIComponent(label)}`;

  const [rows, teamsRes] = await Promise.all([
    getSeasonStandings(label),
    supabaseAdmin.from("teams").select("id, name, logo").eq("season_label", label),
  ]);
  if (teamsRes.error) throw new Error(`[seasons/katataxi] teams: ${teamsRes.error.message}`);

  return (
    <StandingsViewGrand
      seasonDisplay={season.display_label}
      rows={rows}
      teams={(teamsRes.data ?? []) as TeamInfo[]}
      archiveHref={hub}
      banner={
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[#fb923c]/40 bg-[#13131d]/80 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em]">
          <span className="text-[#fb923c]">
            Αρχείο · Σεζόν {season.display_label}
            {season.status === "active" ? " (σε εξέλιξη)" : ""}
          </span>
          <Link href={hub} className="text-[#F3EFE6]/70 transition-colors hover:text-[#fb923c]">
            ← Επιστροφή στη σεζόν
          </Link>
        </div>
      }
    />
  );
}
