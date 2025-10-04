// app/dashboard/teams/page.tsx
// SERVER: φέρνει ομάδες, υπογράφει τα λογότυπα, περνάει αρχικά rows στον client.

import type { TeamRow } from "@/app/lib/types";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import AdminTeamsGridClient from "./AdminTeamsGridClient";

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
  const { data, error } = await supabaseAdmin
  .from("teams")
  .select("id, name, am, logo, created_at, deleted_at")

  .order("name", { ascending: true });
  if (error) {
    console.error("[AdminTeamsGrid(Server)] teams load error:", error);
  }

  const rows = (data ?? []) as (TeamRow & { deleted_at?: string | null })[];
  const initialRows = await Promise.all(
    rows.map(async (r) => ({ ...r, logo: await signLogoIfNeeded(r.logo) }))
  );

  return <AdminTeamsGridClient initialRows={initialRows} />;
}