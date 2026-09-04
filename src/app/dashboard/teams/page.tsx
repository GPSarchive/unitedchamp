// app/dashboard/teams/page.tsx
// SERVER: φέρνει τις ομάδες της ΕΝΕΡΓΗΣ σεζόν, υπογράφει τα λογότυπα, περνάει
// αρχικά rows στον client. Παλαιότερες σεζόν: /dashboard/seasons/[label].
// "Δημιουργία από παλιά ομάδα" φτιάχνει νέα γραμμή για την ενεργή σεζόν.

import type { TeamRow } from "@/app/lib/types";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import AdminTeamsGridClient from "./AdminTeamsGridClient";
import CopyFromOldTeam, { type OldTeamSource } from "./CopyFromOldTeam";

const BUCKET = "team-logos";

async function signLogoIfNeeded(logo: string | null) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(logo, 60 * 60 * 24); // 24 ώρες
  return data?.signedUrl ?? null;
}

export default async function Page() {
  const active = await getActiveSeasonCached();
  const label = active?.label ?? NO_SEASON;

  const [{ data, error }, { data: oldRows }] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name, am, logo, created_at, deleted_at")
      .eq("season_label", label)
      .order("name", { ascending: true }),
    // Sources for "create from old team": every team row of another season.
    supabaseAdmin
      .from("teams")
      .select("id, name, season_label, colour, logo, deleted_at")
      .neq("season_label", label)
      .order("season_label", { ascending: false })
      .order("name", { ascending: true }),
  ]);
  if (error) {
    console.error("[AdminTeamsGrid(Server)] teams load error:", error);
  }

  const rows = (data ?? []) as (TeamRow & { deleted_at?: string | null })[];
  const initialRows = await Promise.all(
    rows.map(async (r) => ({ ...r, logo: await signLogoIfNeeded(r.logo) }))
  );

  const sources: OldTeamSource[] = await Promise.all(
    ((oldRows ?? []) as {
      id: number;
      name: string | null;
      season_label: string | null;
      colour: string | null;
      logo: string | null;
      deleted_at: string | null;
    }[]).map(async (t) => ({
      id: t.id,
      name: t.name ?? `Ομάδα #${t.id}`,
      season_label: t.season_label,
      colour: t.colour,
      logo: await signLogoIfNeeded(t.logo),
      deleted: !!t.deleted_at,
    }))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-white/50">
          Ενεργή σεζόν: <span className="font-mono text-white/80">{active?.display_label ?? "—"}</span> ·
          νέες ομάδες μπαίνουν αυτόματα σε αυτήν.
        </p>
        <CopyFromOldTeam sources={sources} activeSeason={active?.display_label ?? null} />
      </div>
      <AdminTeamsGridClient initialRows={initialRows} />
    </div>
  );
}
