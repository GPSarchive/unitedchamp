// Server component
import AdminTeamsCRUD from "./AdminTeamsCRUD";
import type { TeamRow } from "@/app/lib/types";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

const BUCKET = "team-logos";

async function signLogoIfNeeded(logo: string | null) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo; // already a public/external URL
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(logo, 60 * 60 * 24); // 24h
  return data?.signedUrl ?? null;
}

export default async function AdminTeamsSection() {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("[AdminTeamsSection] teams load error:", error);
  }

  const rows = (data ?? []) as TeamRow[];
  const initialRows: TeamRow[] = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      logo: await signLogoIfNeeded(r.logo),
    }))
  );

  return <AdminTeamsCRUD initialRows={initialRows} />;
}
