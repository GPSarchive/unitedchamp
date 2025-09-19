// lib/repos/tournaments.ts
// Data-access helpers for tournaments (read + create).
// - Use the RSC client for reads inside server components.
// - Use the Route client for writes/mutations inside server actions/API routes.

import {
  createSupabaseRSCClient,
  createSupabaseRouteClient,
} from "@/app/lib/supabase/supabaseServer";
import type { NewTournamentPayload } from "@/app/lib/types";

// ---------- READS ----------

export async function listRunningTournaments() {
  const s = await createSupabaseRSCClient();
  const { data } = await s
    .from("tournaments")
    .select("id,name,slug,logo,season")
    .eq("status", "running")
    .order("name");
  return data ?? [];
}

export async function listCompletedTournaments() {
  const s = await createSupabaseRSCClient();
  const { data } = await s
    .from("tournaments")
    .select("id,name,slug,logo,season,winner_team_id")
    .eq("status", "completed")
    .order("id", { ascending: false });
  return data ?? [];
}

export async function getTournamentBySlug(slug: string) {
  const s = await createSupabaseRSCClient();
  const { data } = await s
    .from("tournaments")
    .select(
      "id,name,slug,logo,season,status,format,start_date,end_date,winner_team_id"
      //                                                            ^ add this
    )
    .eq("slug", slug)
    .single();
  return data ?? null;
}
/**
 * Returns stages and a groupsByStage map in ONE round-trip via PostgREST embedding.
 * stages: [{ id, name, kind, ordering }]
 * groupsByStage: { [stage_id]: [{ id, name }] }
 */
export async function getStagesAndGroups(slug: string) {
  const s = await createSupabaseRSCClient();

  const { data: t } = await s
    .from("tournaments")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!t) return { stages: [], groupsByStage: {} as Record<number, any[]> };

  const { data: stagesRaw } = await s
    .from("tournament_stages")
    .select("id,name,kind,ordering,tournament_groups(id,name)")
    .eq("tournament_id", t.id)
    .order("ordering");

  const groupsByStage: Record<number, any[]> = {};
  (stagesRaw ?? []).forEach((st: any) => {
    groupsByStage[st.id] = st.tournament_groups ?? [];
  });

  const stages = (stagesRaw ?? []).map((st: any) => ({
    id: st.id,
    name: st.name,
    kind: st.kind as "league" | "groups" | "knockout",
    ordering: st.ordering as number,
  }));

  return { stages, groupsByStage };
}

export async function getStandingsForSlug(
  slug: string,
  { stageId, groupId }: { stageId?: number; groupId?: number }
) {
  const s = await createSupabaseRSCClient();
  const { data: t } = await s
    .from("tournaments")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!t) return [];
  let q = s
    .from("v_tournament_standings")
    .select("*")
    .eq("tournament_id", t.id);
  if (stageId) q = q.eq("stage_id", stageId);
  if (groupId) q = q.eq("group_id", groupId);
  const { data } = await q
    .order("points", { ascending: false })
    .order("goal_diff", { ascending: false });
  return data ?? [];
}

// ---------- WRITE (RPC) ----------

/**
 * Admin creation (atomic): calls the Postgres RPC `create_tournament`.
 * Use this in your server action (Tool): it returns the new tournament id & slug.
 */
export async function createTournament(payload: NewTournamentPayload): Promise<{
  tournament_id: number;
  tournament_slug: string;
}> {
  const s = await createSupabaseRouteClient();
  const { data, error } = await s.rpc("create_tournament", {
    v_json: payload as any,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0] as
    | { tournament_id: number; tournament_slug: string }
    | undefined;
  if (!row) throw new Error("create_tournament returned no data");
  return row;
}
