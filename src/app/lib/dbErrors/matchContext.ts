// src/app/lib/dbErrors/matchContext.ts
//
// Loads the row context describeDbError() needs to name a match: team names,
// whether a team is archived, the matchday / bracket slot, and — for stale
// rows — who changed it last (from audit_log). Server only.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInstant } from "@/app/lib/datetime";
import type { TeamRef, WriteContext } from "./describeDbError";

// Any Supabase client works (service role sees archived teams; a user client
// sees what RLS allows, which is enough to name the row).
type Db = SupabaseClient<any, any, any>;

export type MatchRowLike = {
  id?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  leg?: number | null;
};

/** "2η αγωνιστική, WALKERS – RED PULSE" or "γύρος 2, θέση 1, 2ο σκέλος, A – B". */
export function matchLabel(row: MatchRowLike, teams: { a?: TeamRef | null; b?: TeamRef | null }): string {
  const slot: string[] = [];
  if (row.round != null && row.bracket_pos != null) {
    slot.push(`γύρος ${row.round}`, `θέση ${row.bracket_pos}`);
    if (row.leg != null) slot.push(`${row.leg}ο σκέλος`);
  } else if (row.matchday != null) {
    slot.push(`${row.matchday}η αγωνιστική`);
  }
  const name = (t: TeamRef | null | undefined, id: number | null | undefined) =>
    t?.name ?? (id != null ? `#${id}` : "TBD");
  slot.push(`${name(teams.a, row.team_a_id)} – ${name(teams.b, row.team_b_id)}`);
  return slot.join(", ");
}

export async function loadTeamRefs(db: Db, ids: (number | null | undefined)[]): Promise<Map<number, TeamRef>> {
  const want = Array.from(new Set(ids.filter((x): x is number => typeof x === "number")));
  const out = new Map<number, TeamRef>();
  if (!want.length) return out;
  const { data } = await db.from("teams").select("id, name, deleted_at").in("id", want);
  for (const t of data ?? []) out.set(t.id, { id: t.id, name: t.name, deleted_at: t.deleted_at ?? null });
  return out;
}

export async function loadTeamNameMap(db: Db, ids: (number | null | undefined)[]): Promise<Record<number, string>> {
  const refs = await loadTeamRefs(db, ids);
  const out: Record<number, string> = {};
  refs.forEach((t, id) => {
    if (t.name) out[id] = t.name;
  });
  return out;
}

/**
 * Context for one match row that failed to write. Fills matchday / slot from
 * the DB when the caller only has the id (the PATCH route).
 */
export async function loadMatchWriteContext(
  db: Db,
  row: MatchRowLike,
  extra: Partial<WriteContext> = {},
): Promise<WriteContext> {
  let r = row;
  if (r.id != null && r.matchday == null && r.round == null) {
    const { data } = await db
      .from("matches")
      .select("id, team_a_id, team_b_id, matchday, round, bracket_pos, leg")
      .eq("id", r.id)
      .maybeSingle();
    if (data) r = { ...data, ...stripNullish(row) };
  }
  const refs = await loadTeamRefs(db, [r.team_a_id, r.team_b_id]);
  const teams = {
    a: r.team_a_id != null ? refs.get(r.team_a_id) ?? { id: r.team_a_id } : null,
    b: r.team_b_id != null ? refs.get(r.team_b_id) ?? { id: r.team_b_id } : null,
  };
  return {
    entity: "matches",
    id: r.id ?? null,
    label: matchLabel(r, teams),
    teams,
    ...extra,
  };
}

function stripNullish<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as Partial<T>;
}

/** Context for a batch insert (new matches): just the team names. */
export async function loadNewMatchesContext(db: Db, rows: MatchRowLike[]): Promise<WriteContext> {
  const teamNameById = await loadTeamNameMap(
    db,
    rows.flatMap((r) => [r.team_a_id, r.team_b_id]),
  );
  return { entity: "matches", id: null, teamNameById };
}

/** Context for tournament_teams writes: team names for the ids in the batch. */
export async function loadTournamentTeamsContext(
  db: Db,
  rows: { team_id?: number | null }[],
): Promise<WriteContext> {
  return { entity: "tournament_teams", teamNameById: await loadTeamNameMap(db, rows.map((r) => r.team_id)) };
}

/**
 * True when every field in `patch` already holds the same value in the stored
 * row — i.e. the admin did not change this row, the editor just re-sent it.
 * Used only to word the error; never to skip a write.
 */
export async function rowUnchanged(db: Db, table: string, id: number, patch: Record<string, unknown>): Promise<boolean> {
  const { data } = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (!data) return false;
  return Object.entries(patch).every(([k, v]) => sameValue(v, (data as Record<string, unknown>)[k]));
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "string" && typeof b === "string") {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && /\d{4}-\d{2}-\d{2}T/.test(a) && /\d{4}-\d{2}-\d{2}T/.test(b)) {
      return ta === tb;
    }
  }
  return a === b || String(a) === String(b);
}

/**
 * Message for an optimistic-lock miss: the row changed (or vanished) since
 * the editor loaded it. Names who did it when the audit log knows.
 */
export async function staleRowMessage(
  db: Db,
  row: MatchRowLike & { id: number },
  op: "UPDATE" | "DELETE",
): Promise<string> {
  const ctx = await loadMatchWriteContext(db, row);
  const { data: last } = await db
    .from("audit_log")
    .select("actor_email, at")
    .eq("table_name", "matches")
    .eq("record_id", String(row.id))
    .eq("op", op)
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const who = last
    ? ` από ${last.actor_email ?? "άγνωστο χρήστη"} στις ${formatInstant(last.at)}`
    : "";
  const head = `Αγώνας #${row.id}${ctx.label ? ` (${ctx.label})` : ""}: `;
  return op === "DELETE"
    ? `${head}διαγράφηκε στο μεταξύ${who}. Φορτώστε ξανά τη σελίδα.`
    : `${head}άλλαξε στο μεταξύ${who}. Φορτώστε ξανά τη σελίδα και επαναλάβετε την αλλαγή σας.`;
}
