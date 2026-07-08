// Live smoke test: feed REAL generator output (genRoundRobin, genKnockoutAnyN,
// expandToTwoLegs) into the real database and verify it satisfies the actual
// schema/constraints (FKs, unique_ko_match leg-aware index, tie links).
//
// Usage:
//   npx tsx scripts/dummy-tournament/generator-live-test.ts            # seed + verify
//   npx tsx scripts/dummy-tournament/generator-live-test.ts --cleanup  # delete everything it created
//
// SAFETY (same conventions as the other dummy-tournament scripts):
//  - Teams are created with is_dummy = true and ZZZ-prefixed names.
//  - The tournament is named "ZZZ GENERATOR TEST — DELETE ME".
//  - Every created id is recorded in .generator-test-pending-delete.json and
//    cleanup deletes ONLY those recorded ids. Real data is never touched.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { genRoundRobin } from "../../src/app/dashboard/tournaments/TournamentCURD/util/functions/roundRobin";
import { genKnockoutAnyN } from "../../src/app/dashboard/tournaments/TournamentCURD/util/functions/knockoutAnyN";
import { expandToTwoLegs } from "../../src/app/dashboard/tournaments/TournamentCURD/util/functions/common";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = path.join(__dirname, ".generator-test-pending-delete.json");

function loadEnvLocal(): Record<string, string> {
  const raw = fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnvLocal();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

type Marker = { tournamentId: number; createdTeamIds: number[]; createdAt: string };

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function bail(msg: string, err?: { message?: string } | null): never {
  console.error(`ABORT: ${msg}${err?.message ? ` — ${err.message}` : ""}`);
  process.exit(1);
}

/* ================= cleanup ================= */

async function cleanup() {
  if (!fs.existsSync(MARKER)) {
    console.log("No pending-delete marker found — nothing to clean up.");
    return;
  }
  const marker = JSON.parse(fs.readFileSync(MARKER, "utf8")) as Marker;
  const tid = marker.tournamentId;
  console.log(`Cleaning up dummy tournament #${tid} (created ${marker.createdAt})`);

  const del = async (label: string, q: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) => {
    const { data, error } = await q;
    if (error) bail(`delete ${label}`, error);
    console.log(`  deleted ${label}: ${data?.length ?? 0}`);
  };

  const { data: stages } = await sb.from("tournament_stages").select("id").eq("tournament_id", tid);
  const stageIds = (stages ?? []).map((s: { id: number }) => s.id);

  await del("matches", sb.from("matches").delete().eq("tournament_id", tid).select("id"));
  await del("tournament_teams", sb.from("tournament_teams").delete().eq("tournament_id", tid).select("id"));
  if (stageIds.length) {
    await del("tournament_groups", sb.from("tournament_groups").delete().in("stage_id", stageIds).select("id"));
    await del("stage_slots", sb.from("stage_slots").delete().in("stage_id", stageIds).select("stage_id"));
    await del("stage_standings", sb.from("stage_standings").delete().in("stage_id", stageIds).select("stage_id"));
  }
  await del("tournament_stages", sb.from("tournament_stages").delete().eq("tournament_id", tid).select("id"));
  await del("tournaments", sb.from("tournaments").delete().eq("id", tid).select("id"));
  if (marker.createdTeamIds.length) {
    await del(
      "teams (created by this test, is_dummy only)",
      sb.from("teams").delete().in("id", marker.createdTeamIds).eq("is_dummy", true).select("id")
    );
  }

  // verify nothing remains
  const { data: remain } = await sb.from("matches").select("id").eq("tournament_id", tid);
  const { data: tRemain } = await sb.from("tournaments").select("id").eq("id", tid);
  if ((remain?.length ?? 0) === 0 && (tRemain?.length ?? 0) === 0) {
    fs.unlinkSync(MARKER);
    console.log("Cleanup complete — no remnants, marker removed.");
  } else {
    console.error("Cleanup left remnants! Marker kept for retry.");
    process.exit(1);
  }
}

/* ================= seed + verify ================= */

async function seedAndVerify() {
  if (fs.existsSync(MARKER)) {
    bail(`Marker ${path.basename(MARKER)} already exists — run with --cleanup first.`);
  }

  /* ---- 1) four dummy teams (reuse ZZZ teams when present) ---- */
  const { data: existingTeams, error: teamReadErr } = await sb
    .from("teams").select("id,am").eq("is_dummy", true).like("am", "ZZZGEN%").order("am");
  if (teamReadErr) bail("reading dummy teams", teamReadErr);

  const wantAms = ["ZZZGEN1", "ZZZGEN2", "ZZZGEN3", "ZZZGEN4"];
  const haveByAm = new Map((existingTeams ?? []).map((t: { id: number; am: string }) => [t.am, t.id]));
  const toCreate = wantAms
    .filter((am) => !haveByAm.has(am))
    .map((am) => ({ name: `ZZZ Gen Test Team ${am.slice(-1)}`, am, is_dummy: true, logo: "/logo.jpg" }));

  const createdTeamIds: number[] = [];
  if (toCreate.length) {
    const { data: created, error } = await sb.from("teams").insert(toCreate).select("id,am");
    if (error) bail("creating dummy teams", error);
    for (const t of created ?? []) {
      haveByAm.set(t.am, t.id);
      createdTeamIds.push(t.id);
    }
  }
  const teamIds = wantAms.map((am) => haveByAm.get(am)!) as number[];
  console.log(`Teams: ${teamIds.join(", ")} (${createdTeamIds.length} created, rest reused)`);

  /* ---- 2) tournament + stages + group ---- */
  const slug = `zzz-generator-test-${Date.now()}`;
  const { data: t, error: tErr } = await sb
    .from("tournaments")
    .insert({ name: "ZZZ GENERATOR TEST — DELETE ME", slug, format: "mixed", status: "scheduled" })
    .select("id").single();
  if (tErr || !t) bail("creating tournament", tErr);
  const tid = t.id as number;

  // record the marker IMMEDIATELY so a mid-run crash is still cleanable
  const marker: Marker = { tournamentId: tid, createdTeamIds, createdAt: new Date().toISOString() };
  fs.writeFileSync(MARKER, JSON.stringify(marker, null, 2));
  console.log(`Tournament #${tid} created; marker written (pending delete).`);

  const { data: stages, error: sErr } = await sb
    .from("tournament_stages")
    .insert([
      { tournament_id: tid, name: "ZZZ Groups", kind: "groups", ordering: 0, config: { rounds_per_opponent: 2 } },
      { tournament_id: tid, name: "ZZZ KO", kind: "knockout", ordering: 1, config: { double_round_ko: true } },
    ])
    .select("id,kind,ordering");
  if (sErr || !stages || stages.length !== 2) bail("creating stages", sErr);
  const groupsStage = stages.find((s: any) => s.kind === "groups")!.id as number;
  const koStage = stages.find((s: any) => s.kind === "knockout")!.id as number;

  const { data: grp, error: gErr } = await sb
    .from("tournament_groups")
    .insert({ stage_id: groupsStage, name: "ZZZ Group A", ordering: 0 })
    .select("id").single();
  if (gErr || !grp) bail("creating group", gErr);
  const groupId = grp.id as number;

  const ttRows = teamIds.map((team_id) => ({ tournament_id: tid, team_id }));
  const { error: ttErr } = await sb.from("tournament_teams").insert(ttRows);
  if (ttErr) bail("creating tournament_teams", ttErr);

  /* ---- 3) round-robin fixtures straight from the generator ---- */
  const rr = genRoundRobin({ stageIdx: 0, groupIdx: 0, teamIds, repeats: 2 });
  const rrRows = rr.map((m) => ({
    tournament_id: tid,
    stage_id: groupsStage,
    group_id: groupId,
    matchday: m.matchday,
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    status: "scheduled",
    is_ko: false,
  }));
  const { data: rrInserted, error: rrErr } = await sb.from("matches").insert(rrRows).select("id,matchday");
  if (rrErr) bail("inserting RR fixtures", rrErr);

  console.log("\n[Round-robin verification]");
  check("generator produced 12 fixtures (4 teams × double round)", rr.length === 12, `got ${rr.length}`);
  check("all 12 inserted under groups stage", (rrInserted?.length ?? 0) === 12, `got ${rrInserted?.length}`);
  const mdCounts = new Map<number, number>();
  (rrInserted ?? []).forEach((r: any) => mdCounts.set(r.matchday, (mdCounts.get(r.matchday) ?? 0) + 1));
  check("6 matchdays × 2 matches each", mdCounts.size === 6 && [...mdCounts.values()].every((c) => c === 2));

  /* ---- 4) two-legged KO from the generators ---- */
  const seeded = teamIds.map((id, i) => ({ id, seed: i + 1 }));
  const ko = genKnockoutAnyN(teamIds, 1, seeded); // 4 teams → 3 ties
  const legs = expandToTwoLegs(ko); // → 6 rows
  const koRows = legs.map((m) => ({
    tournament_id: tid,
    stage_id: koStage,
    group_id: null,
    round: m.round,
    bracket_pos: m.bracket_pos,
    leg: m.leg,
    team_a_id: m.team_a_id ?? null,
    team_b_id: m.team_b_id ?? null,
    home_source_round: m.home_source_round ?? null,
    home_source_bracket_pos: m.home_source_bracket_pos ?? null,
    away_source_round: m.away_source_round ?? null,
    away_source_bracket_pos: m.away_source_bracket_pos ?? null,
    home_source_outcome: (m as any).home_source_outcome ?? "W",
    away_source_outcome: (m as any).away_source_outcome ?? "W",
    status: "scheduled",
    is_ko: true,
  }));
  const { data: koInserted, error: koErr } = await sb
    .from("matches").insert(koRows).select("id,round,bracket_pos,leg");
  if (koErr) bail("inserting KO legs", koErr);

  // resolve tie_leg1_match_id by slot, exactly like the save-all KO post-pass
  const leg1ByPos = new Map<string, number>();
  for (const r of koInserted ?? []) if (r.leg === 1) leg1ByPos.set(`${r.round}#${r.bracket_pos}`, r.id);
  for (const r of koInserted ?? []) {
    if (r.leg !== 2) continue;
    const leg1Id = leg1ByPos.get(`${r.round}#${r.bracket_pos}`);
    const { error } = await sb.from("matches").update({ tie_leg1_match_id: leg1Id ?? null }).eq("id", r.id);
    if (error) bail(`linking decider #${r.id}`, error);
  }

  console.log("\n[Two-legged KO verification]");
  check("generator: 3 ties for 4 teams", ko.length === 3, `got ${ko.length}`);
  check("expansion: 6 leg rows", legs.length === 6, `got ${legs.length}`);
  check("all 6 legs inserted (leg-aware unique index accepts shared coords)", (koInserted?.length ?? 0) === 6);

  const { data: koBack, error: koBackErr } = await sb
    .from("matches")
    .select("id,round,bracket_pos,leg,tie_leg1_match_id,team_a_id,team_b_id,home_source_round,away_source_round")
    .eq("stage_id", koStage).order("round").order("bracket_pos").order("leg");
  if (koBackErr || !koBack) bail("re-reading KO rows", koBackErr);

  const deciders = koBack.filter((r: any) => r.leg === 2);
  check("every leg-2 decider is linked to its leg-1 sibling",
    deciders.length === 3 && deciders.every((r: any) => {
      const sib = koBack.find((x: any) => x.leg === 1 && x.round === r.round && x.bracket_pos === r.bracket_pos);
      return sib && r.tie_leg1_match_id === sib.id;
    }));
  const r1leg1 = koBack.find((r: any) => r.round === 1 && r.bracket_pos === 1 && r.leg === 1);
  const r1leg2 = koBack.find((r: any) => r.round === 1 && r.bracket_pos === 1 && r.leg === 2);
  check("leg 2 orientation is swapped vs leg 1",
    !!r1leg1 && !!r1leg2 && r1leg1.team_a_id === r1leg2.team_b_id && r1leg1.team_b_id === r1leg2.team_a_id);
  const final = koBack.filter((r: any) => r.round === 2);
  check("final exists as two legs with source pointers into round 1",
    final.length === 2 && final.every((r: any) => r.home_source_round === 1 && r.away_source_round === 1));

  // Duplicate probe: the leg-aware unique index must reject a second (round,pos,leg) row.
  const probe = { ...koRows[0] };
  const { data: dupData, error: dupErr } = await sb.from("matches").insert(probe).select("id");
  if (dupErr) {
    check("unique_ko_match rejects a duplicate (stage,round,pos,leg) row", (dupErr as any).code === "23505",
      `unexpected error ${(dupErr as any).code}: ${dupErr.message}`);
  } else {
    check("unique_ko_match rejects a duplicate (stage,round,pos,leg) row", false,
      "duplicate insert SUCCEEDED — the unique_ko_match index is missing in this DB");
    const dupId = (dupData as any[])?.[0]?.id;
    if (dupId) await sb.from("matches").delete().eq("id", dupId);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}.`);
  console.log(`Dummy tournament #${tid} is marked for deletion in ${path.basename(MARKER)}.`);
  console.log("Run with --cleanup to remove it.");
  if (failures > 0) process.exit(1);
}

const mode = process.argv.includes("--cleanup") ? "cleanup" : "seed";
(mode === "cleanup" ? cleanup() : seedAndVerify()).catch((e) => {
  console.error("Unhandled error:", e?.message ?? e);
  process.exit(1);
});
