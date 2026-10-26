/**
 * fix-t65-late-team-matchdays.ts
 *
 * Tournament 65 (ULTRA LEAGUE ΧΑΪΔΑΡΙ 2026-2027), stage 94 (league, 14 teams,
 * matchday 1 played). On 2026-10-26 13:39 UTC the first version of the planner's
 * «+ Αγώνες ομάδας» created 29 fixtures (#3150–#3178) for the late teams
 * ΜΑΝΤΡΑ FC (#211) and PALAIMAXOI FC (#212) as EXTRA games on the existing
 * matchdays 1–13 — including the already-played matchday 1.
 *
 * Decision (owner, 2026-10-26): late teams' matches go on NEW matchdays at the
 * end; an existing matchday is used only if it is unplayed and neither team
 * plays on it. This script moves each of the 29 rows to the matchday the
 * current planner (planLateTeamFixtures) assigns. Only `matchday` changes —
 * teams, home/away, dates and status stay as they are.
 *
 * Dry run by default (prints the plan). `--apply` writes.
 *
 *   npx tsx scripts/fix-t65-late-team-matchdays.ts
 *   npx tsx scripts/fix-t65-late-team-matchdays.ts --apply
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { planLateTeamFixtures } from "../src/app/dashboard/tournaments/TournamentCURD/util/functions/lateTeamFixtures";

const TID = 65;
const STAGE_ID = 94;
const LATE_TEAMS = [211, 212]; // ΜΑΝΤΡΑ FC, PALAIMAXOI FC
const ADDED_IDS = Array.from({ length: 29 }, (_, i) => 3150 + i); // #3150–#3178
const ACTOR_EMAIL = "sfnader@gmail.com"; // who authorised the fix

const APPLY = process.argv.includes("--apply");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Row = {
  id: number;
  stage_id: number;
  group_id: number | null;
  matchday: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  status: string | null;
  match_date: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
};

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

async function loadStage(columns = "id,stage_id,group_id,matchday,team_a_id,team_b_id,status,match_date,team_a_score,team_b_score"): Promise<Row[]> {
  const { data, error } = await sb
    .from("matches")
    .select(columns)
    .eq("tournament_id", TID)
    .eq("stage_id", STAGE_ID)
    .order("matchday")
    .order("id");
  if (error) throw new Error(`load stage ${STAGE_ID}: ${error.message}`);
  return data as unknown as Row[];
}

/** Every column except the ones this fix or the DB's own triggers may change. */
function fingerprint(r: Record<string, unknown>): string {
  const { updated_at: _u, ...rest } = r;
  return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
}

function doubleBookings(rows: Row[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const r of rows) {
    for (const t of [r.team_a_id, r.team_b_id]) {
      if (t == null || r.matchday == null) continue;
      const k = `${r.matchday}|${t}`;
      if (seen.has(k)) out.push(`team ${t} twice on matchday ${r.matchday} (#${seen.get(k)}, #${r.id})`);
      else seen.set(k, r.id);
    }
  }
  return out;
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (writing to prod)" : "MODE: DRY RUN (no writes)");

  const rows = await loadStage();
  const addedSet = new Set(ADDED_IDS);
  const added = rows.filter((r) => addedSet.has(r.id));
  const existing = rows.filter((r) => !addedSet.has(r.id));

  // ---- guards -------------------------------------------------------------
  const problems: string[] = [];
  if (added.length !== ADDED_IDS.length) problems.push(`expected ${ADDED_IDS.length} added rows, found ${added.length}`);
  for (const r of added) {
    const late = LATE_TEAMS.includes(r.team_a_id!) || LATE_TEAMS.includes(r.team_b_id!);
    if (!late) problems.push(`#${r.id} has no late team`);
    if (r.status !== "scheduled") problems.push(`#${r.id} status is ${r.status}`);
    if (r.team_a_score != null || r.team_b_score != null) problems.push(`#${r.id} has a score`);
    if (r.match_date != null) problems.push(`#${r.id} already has a date (${r.match_date})`);
  }
  const strayLate = existing.filter((r) => LATE_TEAMS.includes(r.team_a_id!) || LATE_TEAMS.includes(r.team_b_id!));
  if (strayLate.length) problems.push(`late teams also appear in other rows: ${strayLate.map((r) => `#${r.id}`).join(", ")}`);

  // ---- plan with the planner's own rule -----------------------------------
  const existingTeams = Array.from(
    new Set(existing.flatMap((r) => [r.team_a_id, r.team_b_id]).filter((t): t is number => t != null)),
  );
  const plan = planLateTeamFixtures({
    rows: existing,
    newTeamIds: LATE_TEAMS,
    teamIds: [...existingTeams, ...LATE_TEAMS],
    repeats: 1,
  });
  const targetByPair = new Map(plan.map((f) => [pairKey(f.team_a_id, f.team_b_id), f.matchday]));
  if (plan.length !== added.length) problems.push(`planner produced ${plan.length} fixtures, DB has ${added.length}`);
  for (const r of added) {
    if (!targetByPair.has(pairKey(r.team_a_id!, r.team_b_id!))) problems.push(`#${r.id} pair not in the plan`);
  }

  const { data: teams } = await sb.from("teams").select("id,name").in("id", [...existingTeams, ...LATE_TEAMS]);
  const name = new Map((teams ?? []).map((t) => [t.id as number, t.name as string]));

  const moves = added
    .map((r) => ({
      id: r.id,
      from: r.matchday,
      to: targetByPair.get(pairKey(r.team_a_id!, r.team_b_id!)) ?? null,
      label: `${name.get(r.team_a_id!) ?? r.team_a_id} – ${name.get(r.team_b_id!) ?? r.team_b_id}`,
    }))
    .sort((a, b) => (a.to ?? 0) - (b.to ?? 0) || a.id - b.id);

  const lastExisting = Math.max(...existing.map((r) => r.matchday ?? 0));
  console.log(`\nStage ${STAGE_ID}: ${existing.length} existing rows, matchdays 1–${lastExisting}, ${existingTeams.length} teams`);
  console.log(`Moves (${moves.length}):`);
  for (const m of moves) console.log(`  #${m.id}  Αγ. ${m.from} → ${m.to}   ${m.label}`);

  const projected = [...existing, ...added.map((r) => ({ ...r, matchday: targetByPair.get(pairKey(r.team_a_id!, r.team_b_id!)) ?? r.matchday }))];
  const projectedDoubles = doubleBookings(projected);
  if (projectedDoubles.length) problems.push(...projectedDoubles.map((d) => `after the move: ${d}`));

  if (problems.length) {
    console.error("\n!! Refusing to continue:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  if (!APPLY) {
    console.log("\nChecks passed. Dry run only. Re-run with --apply to write.");
    return;
  }

  // ---- backup: every column of every row in the stage, before any write ----
  const fullBefore = (await loadStage("*")) as unknown as Array<Record<string, unknown> & { id: number }>;
  const backupPath = `scripts/backup-t65-stage${STAGE_ID}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(fullBefore, null, 2));
  console.log(`\n0. backup of ${fullBefore.length} rows written to ${backupPath}`);
  const untouchedBefore = new Map(
    fullBefore.filter((r) => !addedSet.has(r.id)).map((r) => [r.id, fingerprint(r)]),
  );

  // ---- apply --------------------------------------------------------------
  for (const m of moves) {
    if (m.from === m.to) continue;
    const { data, error } = await sb
      .from("matches")
      .update({ matchday: m.to })
      .eq("id", m.id)
      .eq("stage_id", STAGE_ID)
      .eq("matchday", m.from!)
      .eq("status", "scheduled")
      .select("id");
    if (error) throw new Error(`#${m.id}: ${error.message}`);
    if (!data?.length) throw new Error(`#${m.id}: row changed since the check — stopped (earlier moves stay applied)`);
  }
  console.log(`\n1. ${moves.filter((m) => m.from !== m.to).length} matchdays updated`);

  const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
  const actor = users?.users.find((u) => u.email === ACTOR_EMAIL);
  const { error: auditErr } = await sb.from("audit_log").insert({
    source: "app",
    op: "data.fix",
    table_name: "tournaments",
    record_id: String(TID),
    actor_id: actor?.id ?? null,
    actor_email: ACTOR_EMAIL,
    db_role: "service_role",
    route: "scripts/fix-t65-late-team-matchdays.ts",
    summary:
      `Διοργάνωση #${TID}: οι ${moves.length} αγώνες των ΜΑΝΤΡΑ FC / PALAIMAXOI FC μεταφέρθηκαν ` +
      `από επιπλέον αγώνες στις αγωνιστικές 1–${lastExisting} σε νέες αγωνιστικές στο τέλος`,
    meta: { stage_id: STAGE_ID, late_teams: LATE_TEAMS, moves },
  });
  if (auditErr) console.error(`!! audit row failed: ${auditErr.message}`);
  else console.log("2. audit_log row written");

  // ---- verify -------------------------------------------------------------
  const after = await loadStage();
  const fullAfter = (await loadStage("*")) as unknown as Array<Record<string, unknown> & { id: number }>;
  const wrong = after.filter((r) => addedSet.has(r.id) && r.matchday !== targetByPair.get(pairKey(r.team_a_id!, r.team_b_id!)));
  const doubles = doubleBookings(after);
  // Nothing lost or altered: same ids, and the 91 other matches identical.
  const idsBefore = fullBefore.map((r) => r.id).sort((a, b) => a - b).join(",");
  const idsAfter = fullAfter.map((r) => r.id).sort((a, b) => a - b).join(",");
  const altered = fullAfter.filter(
    (r) => untouchedBefore.has(r.id) && untouchedBefore.get(r.id) !== fingerprint(r),
  );
  const ok = wrong.length === 0 && doubles.length === 0 && idsBefore === idsAfter && altered.length === 0;
  console.log(`3. rows in stage: before ${fullBefore.length}, after ${fullAfter.length}; other matches unchanged: ${untouchedBefore.size - altered.length}/${untouchedBefore.size}`);
  console.log(ok ? "\nVERIFIED OK" : "\n!! VERIFY FAILED — restore from " + backupPath + " if needed");
  if (idsBefore !== idsAfter) console.log("  the set of match ids changed!");
  if (altered.length) console.log("  other matches altered:", altered.map((r) => `#${r.id}`).join(", "));
  if (wrong.length) console.log("  not at target:", wrong.map((r) => `#${r.id}`).join(", "));
  if (doubles.length) console.log("  " + doubles.join("\n  "));
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
