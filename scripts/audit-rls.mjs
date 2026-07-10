/**
 * audit-rls.mjs — read-only-ish RLS posture audit (Session 4 follow-up)
 *
 * For every public-schema table the app uses, probes with the SHIPPED anon key:
 *   - SELECT: can an anonymous visitor read rows?
 *   - INSERT: does RLS block an anonymous write? (probes use impossible FK
 *     values so nothing can actually be created; for FK-less tables a marker
 *     row is inserted and immediately deleted via the service role)
 *
 * Interpretation:
 *   INSERT "RLS-BLOCKED"  → RLS enabled + no anon write policy (good)
 *   INSERT "FK-error"     → the write PASSED RLS and died on a constraint (BAD:
 *                           RLS disabled or a permissive write policy exists)
 *   INSERT "ALLOWED"      → row actually created (VERY BAD; cleaned up)
 *
 * Usage: node scripts/audit-rls.mjs   (requires .env.local)
 * Run before and after applying migrations/enable-public-read-rls.sql.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// table -> insert payload. FK-impossible payloads where possible; "cleanup"
// marks FK-less tables where a real row may be created and must be deleted.
const PROBES = {
  matches: { payload: { tournament_id: -1 }, cleanup: false },
  teams: { payload: { name: "__RLS_PROBE_DELETE_ME__" }, cleanup: true },
  tournaments: { payload: { name: "__RLS_PROBE_DELETE_ME__" }, cleanup: true },
  tournament_stages: { payload: { tournament_id: -1, name: "x", kind: "league", ordering: 999 }, cleanup: false },
  tournament_groups: { payload: { stage_id: -1, name: "x" }, cleanup: false },
  tournament_teams: { payload: { tournament_id: -1, team_id: -1 }, cleanup: false },
  stage_standings: { payload: { stage_id: -1, team_id: -1 }, cleanup: false },
  stage_slots: { payload: { stage_id: -1 }, cleanup: false },
  intake_mappings: { payload: { target_stage_id: -1 }, cleanup: false },
  match_player_stats: { payload: { match_id: -1, player_id: -1, team_id: -1 }, cleanup: false },
  match_participants: { payload: { match_id: -1, player_id: -1, team_id: -1 }, cleanup: false },
  player: { payload: { first_name: "__RLS_PROBE__", last_name: "__DELETE_ME__" }, cleanup: true },
  player_teams: { payload: { player_id: -1, team_id: -1 }, cleanup: false },
  player_statistics: { payload: { player_id: -1 }, cleanup: false },
  player_career_stats: { payload: { player_id: -1 }, cleanup: false },
  player_tournament_stats: { payload: { player_id: -1, tournament_id: -1 }, cleanup: false },
  articles: { payload: { title: "__RLS_PROBE_DELETE_ME__", status: "draft" }, cleanup: true },
  announcements: { payload: { title: "__RLS_PROBE_DELETE_ME__", body: "x", status: "draft" }, cleanup: true },
  disciplinary_actions: { payload: { team_id: -1 }, cleanup: false },
  season_team_adjustments: { payload: { team_id: -1, season: "x", kind: "probe", points: 0 }, cleanup: false },
  tournament_awards: { payload: { tournament_id: -1 }, cleanup: false },
};

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  console.log(pad("table", 26) + pad("anon SELECT", 22) + "anon INSERT");
  console.log("-".repeat(78));
  for (const [table, probe] of Object.entries(PROBES)) {
    // SELECT probe
    const r = await anon.from(table).select("*").limit(1);
    const sel = r.error
      ? (/(row-level security|permission denied)/i.test(r.error.message) ? "blocked" : `err: ${r.error.message.slice(0, 28)}`)
      : `ALLOWED (${r.data?.length ?? 0} row)`;

    // INSERT probe
    const w = await anon.from(table).insert(probe.payload).select();
    let ins;
    if (w.error) {
      if (/row-level security/i.test(w.error.message)) ins = "RLS-BLOCKED (good)";
      else if (/foreign key|violates|invalid input|null value|check constraint/i.test(w.error.message))
        ins = `PASSED RLS, died on constraint (BAD): ${w.error.message.slice(0, 40)}`;
      else ins = `err: ${w.error.message.slice(0, 50)}`;
    } else {
      ins = "*** ROW CREATED (VERY BAD) ***";
      if (probe.cleanup && w.data?.length) {
        for (const row of w.data) await svc.from(table).delete().eq("id", row.id);
        ins += " [cleaned up]";
      }
    }
    console.log(pad(table, 26) + pad(sel, 22) + ins);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
