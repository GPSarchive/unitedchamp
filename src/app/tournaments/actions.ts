"use server";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin"; // Server-only client
import type { Stage } from "./useTournamentData";

export async function addStageAction(newStage: Omit<Stage, "id" | "ordering">) {
  // Query max ordering for this tournament
  const { data: maxData, error: maxError } = await supabaseAdmin
    .from("tournament_stages")
    .select("ordering")
    .eq("tournament_id", newStage.tournament_id)
    .order("ordering", { ascending: false })
    .limit(1)
    .maybeSingle(); // Null if no stages yet

  if (maxError) {
    throw new Error(`Failed to fetch max ordering: ${maxError.message}`);
  }

  const nextOrdering = (maxData?.ordering ?? 0) + 1; // Calculate next

  // Insert without retry—duplicates possible if race
  const { data, error } = await supabaseAdmin
    .from("tournament_stages")
    .insert({ ...newStage, ordering: nextOrdering })
    .select()
    .single();

  if (error) {
    throw new Error(`Insert failed: ${error.message}`); // Bubble up any error (e.g., FK violations)
  }

  return data as Stage;
}