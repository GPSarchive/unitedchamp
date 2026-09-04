// Server-only writer/reader for public.season_recaps: the recap-modal payload
// of one season, computed once at close / re-snapshot and stored as jsonb so
// the archive pages read it with a plain SELECT (contract §2.1, §6).
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { computeSeasonRecapFor, type SeasonRecapData } from "@/app/home/seasonRecap";

export async function refreshSeasonRecap(seasonLabel: string): Promise<{
  seasonLabel: string;
  stored: boolean;
}> {
  const payload = await computeSeasonRecapFor(seasonLabel);
  if (!payload) return { seasonLabel, stored: false }; // no tournaments → nothing to snapshot
  const { error } = await supabaseAdmin.from("season_recaps").upsert(
    { season_label: seasonLabel, payload, generated_at: new Date().toISOString() },
    { onConflict: "season_label" },
  );
  if (error) throw new Error(`Failed upserting season_recaps: ${error.message}`);
  return { seasonLabel, stored: true };
}

export async function getSeasonRecap(
  seasonLabel: string,
): Promise<{ payload: SeasonRecapData; generated_at: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("season_recaps")
    .select("payload, generated_at")
    .eq("season_label", seasonLabel)
    .maybeSingle();
  if (error) throw new Error(`Failed reading season_recaps: ${error.message}`);
  if (!data) return null;
  return { payload: data.payload as SeasonRecapData, generated_at: data.generated_at as string };
}
