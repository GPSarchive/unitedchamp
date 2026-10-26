/**
 * fix-t65-late-team-swap-in.ts
 *
 * Tournament 65 (ULTRA LEAGUE ΧΑΪΔΑΡΙ 2026-2027), stage 94 (league). The late
 * teams ΜΑΝΤΡΑ FC (#211) and PALAIMAXOI FC (#212) have 29 fixtures. The first
 * fix (fix-t65-late-team-matchdays.ts, run 2026-10-26 14:27 UTC, see git
 * history) left them on 14 new matchdays with only two games each.
 *
 * Decision (owner, 2026-10-26): swap the newcomers into the unplayed, undated
 * matchdays instead. On each of matchdays 3–13 one original match moves to the
 * end and its two teams play the newcomers, so every round has all 16 teams;
 * the moved matches plus the newcomers' remaining games fill 3 new matchdays at
 * the end (14–16). Matchday 1 (played) and matchday 2 (dated) keep their games;
 * the newcomers' own meeting stays on matchday 2.
 *
 * The placement comes from the planner itself (planLateTeamFixtures), run on
 * the 91 original matches. Only `matchday` changes, on the 29 newcomer matches
 * and the original matches the plan moves — nothing is created or deleted.
 *
 * Dry run by default (prints the plan). `--apply` writes, after saving a JSON
 * backup of the whole stage, then verifies every other column of every match.
 *
 *   npx tsx scripts/fix-t65-late-team-swap-in.ts
 *   npx tsx scripts/fix-t65-late-team-swap-in.ts --apply
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { planLateTeamFixtures } from "../src/app/dashboard/tournaments/TournamentCURD/util/functions/lateTeamFixtures";

const TID = 65;
const STAGE_ID = 94;
const LATE_TEAMS = [211, 212]; // ΜΑΝΤΡΑ FC, PALAIMAXOI FC
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
  matchday: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  status: string | null;
  match_date: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  [col: string]: unknown;
};

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const isLate = (r: Row) => LATE_TEAMS.includes(r.team_a_id!) || LATE_TEAMS.includes(r.team_b_id!);

async function loadStage(): Promise<Row[]> {
  const { data, error } = await sb
    .from("matches")
    .select("*")
    .eq("tournament_id", TID)
    .eq("stage_id", STAGE_ID)
    .order("matchday")
    .order("id");
  if (error) throw new Error(`load stage ${STAGE_ID}: ${error.message}`);
  return data as Row[];
}

/** Every column except the ones this fix (matchday) or the DB (updated_at) changes. */
function fingerprint(r: Row, ignoreMatchday: boolean): string {
  const skip = new Set(["updated_at", ...(ignoreMatchday ? ["matchday"] : [])]);
  return JSON.stringify(
    Object.keys(r)
      .filter((k) => !skip.has(k))
      .sort()
      .map((k) => [k, r[k]]),
  );
}

function doubleBookings(rows: Array<Pick<Row, "id" | "matchday" | "team_a_id" | "team_b_id">>): string[] {
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
  const late = rows.filter(isLate);
  const originals = rows.filter((r) => !isLate(r));

  // ---- guards -------------------------------------------------------------
  const problems: string[] = [];
  if (rows.length !== 120) problems.push(`expected 120 matches in stage ${STAGE_ID}, found ${rows.length}`);
  if (late.length !== 29) problems.push(`expected 29 newcomer matches, found ${late.length}`);
  for (const r of late) {
    if (r.status !== "scheduled") problems.push(`newcomer match #${r.id} status is ${r.status}`);
    if (r.team_a_score != null || r.team_b_score != null) problems.push(`newcomer match #${r.id} has a score`);
    if (r.match_date != null) problems.push(`newcomer match #${r.id} has a date (${r.match_date})`);
  }

  // ---- plan with the planner's own rule, on the original schedule ---------
  const teams = Array.from(
    new Set(originals.flatMap((r) => [r.team_a_id, r.team_b_id]).filter((t): t is number => t != null)),
  );
  const plan = planLateTeamFixtures({
    rows: originals,
    newTeamIds: LATE_TEAMS,
    teamIds: [...teams, ...LATE_TEAMS],
    repeats: 1,
  });

  const lateTarget = new Map(plan.fixtures.map((f) => [pairKey(f.team_a_id, f.team_b_id), f.matchday]));
  if (plan.fixtures.length !== late.length) problems.push(`planner produced ${plan.fixtures.length} fixtures, DB has ${late.length}`);
  for (const r of late) {
    if (!lateTarget.has(pairKey(r.team_a_id!, r.team_b_id!))) problems.push(`#${r.id} pair not in the plan`);
  }
  const originalTarget = new Map(plan.moves.map((m) => [originals[m.rowIndex].id, m.to]));
  for (const m of plan.moves) {
    const r = originals[m.rowIndex];
    if (r.status !== "scheduled" || r.match_date != null || r.team_a_score != null) {
      problems.push(`plan moves #${r.id}, which is not an undated scheduled match`);
    }
  }

  const target = (r: Row) =>
    isLate(r) ? lateTarget.get(pairKey(r.team_a_id!, r.team_b_id!)) ?? r.matchday : originalTarget.get(r.id) ?? r.matchday;
  const projected = rows.map((r) => ({ ...r, matchday: target(r) }));
  problems.push(...doubleBookings(projected).map((d) => `after the change: ${d}`));
  const pairs = new Set(projected.map((r) => pairKey(r.team_a_id!, r.team_b_id!)));
  if (pairs.size !== 120) problems.push(`after the change: ${pairs.size} distinct pairs instead of 120`);

  const { data: teamRows } = await sb.from("teams").select("id,name").in("id", [...teams, ...LATE_TEAMS]);
  const name = new Map((teamRows ?? []).map((t) => [t.id as number, t.name as string]));
  const label = (r: Row) => `${name.get(r.team_a_id!) ?? r.team_a_id} – ${name.get(r.team_b_id!) ?? r.team_b_id}`;

  const changes = rows
    .filter((r) => target(r) !== r.matchday)
    .map((r) => ({ id: r.id, from: r.matchday, to: target(r)!, late: isLate(r), label: label(r) }))
    .sort((a, b) => a.to - b.to || Number(a.late) - Number(b.late) || a.id - b.id);

  console.log(`\nStage ${STAGE_ID}: ${originals.length} original + ${late.length} newcomer matches`);
  console.log(`Original matches moved to the end (${changes.filter((c) => !c.late).length}):`);
  for (const c of changes.filter((c) => !c.late)) console.log(`  #${c.id}  Αγ. ${c.from} → ${c.to}   ${c.label}`);
  console.log(`Newcomer matches re-placed (${changes.filter((c) => c.late).length}):`);
  for (const c of changes.filter((c) => c.late)) console.log(`  #${c.id}  Αγ. ${c.from} → ${c.to}   ${c.label}`);
  const perMd: Record<number, number> = {};
  projected.forEach((r) => (perMd[r.matchday!] = (perMd[r.matchday!] ?? 0) + 1));
  console.log(`\nGames per matchday after: ${JSON.stringify(perMd)}`);

  if (problems.length) {
    console.error("\n!! Refusing to continue:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  if (!APPLY) {
    console.log("\nChecks passed. Dry run only. Re-run with --apply to write.");
    return;
  }

  // ---- backup, then apply -------------------------------------------------
  const backupPath = `scripts/backup-t65-stage${STAGE_ID}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`\n0. backup of ${rows.length} matches written to ${backupPath}`);

  for (const c of changes) {
    const { data, error } = await sb
      .from("matches")
      .update({ matchday: c.to })
      .eq("id", c.id)
      .eq("stage_id", STAGE_ID)
      .eq("matchday", c.from!)
      .eq("status", "scheduled")
      .is("match_date", null)
      .select("id");
    if (error) throw new Error(`#${c.id}: ${error.message}`);
    if (!data?.length) throw new Error(`#${c.id}: row changed since the check — stopped (earlier changes stay applied; backup: ${backupPath})`);
  }
  console.log(`1. ${changes.length} matchdays updated`);

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
    route: "scripts/fix-t65-late-team-swap-in.ts",
    summary:
      `Διοργάνωση #${TID}: οι ΜΑΝΤΡΑ FC / PALAIMAXOI FC μπήκαν στις αγωνιστικές 3–13 ` +
      `(${changes.filter((c) => !c.late).length} αρχικοί αγώνες μεταφέρθηκαν στο τέλος), ` +
      `νέες αγωνιστικές ${plan.newMatchdays.join(", ")}`,
    meta: { stage_id: STAGE_ID, late_teams: LATE_TEAMS, changes, backup: backupPath },
  });
  if (auditErr) console.error(`!! audit row failed: ${auditErr.message}`);
  else console.log("2. audit_log row written");

  // ---- verify -------------------------------------------------------------
  const after = await loadStage();
  const beforeById = new Map(rows.map((r) => [r.id, r]));
  const changedIds = new Set(changes.map((c) => c.id));
  const sameIds =
    after.length === rows.length && after.every((r) => beforeById.has(r.id));
  const altered = after.filter((r) => {
    const b = beforeById.get(r.id);
    return !b || fingerprint(b, changedIds.has(r.id)) !== fingerprint(r, changedIds.has(r.id));
  });
  const wrong = after.filter((r) => r.matchday !== target(beforeById.get(r.id) ?? r));
  const doubles = doubleBookings(after);
  const ok = sameIds && altered.length === 0 && wrong.length === 0 && doubles.length === 0;
  console.log(
    `3. matches before ${rows.length}, after ${after.length}; ` +
      `unchanged apart from matchday: ${after.length - altered.length}/${after.length}`,
  );
  console.log(ok ? "\nVERIFIED OK" : `\n!! VERIFY FAILED — backup: ${backupPath}`);
  if (!sameIds) console.log("  the set of match ids changed!");
  if (altered.length) console.log("  other columns altered:", altered.map((r) => `#${r.id}`).join(", "));
  if (wrong.length) console.log("  not at target:", wrong.map((r) => `#${r.id}`).join(", "));
  if (doubles.length) console.log("  " + doubles.join("\n  "));
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
