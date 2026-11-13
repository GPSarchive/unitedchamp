/**
 * audit-anon-reads.mjs — what can a stranger read with the SHIPPED anon key?
 *
 * READ-ONLY. Lists every table and view PostgREST exposes (taken from the
 * OpenAPI document, fetched with the service key) and, for each one, asks the
 * REST API for a row count using only the public anon key — exactly what a
 * scraper holding the key from the browser bundle would do.
 *
 *   OPEN (n rows)  → anyone on the internet can download these rows
 *   closed         → RLS / grants return nothing to the anon key
 *
 * No RPC is ever called (a function could write); they are only listed.
 *
 * Usage: node scripts/audit-anon-reads.mjs      (requires .env.local)
 * Run before and after migrations/lock-anon-reads.sql — after it, every line
 * must read "closed".
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SVC) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  const specRes = await fetch(`${URL_}/rest/v1/`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  });
  if (!specRes.ok) throw new Error(`OpenAPI fetch failed: ${specRes.status} ${await specRes.text()}`);
  const spec = await specRes.json();

  const relations = Object.keys(spec.definitions ?? {}).sort();
  const rpcs = Object.keys(spec.paths ?? {})
    .filter((p) => p.startsWith("/rpc/"))
    .map((p) => p.slice(5))
    .sort();

  console.log(pad("table / view", 34) + "anon key can read");
  console.log("-".repeat(64));
  let open = 0;
  for (const rel of relations) {
    const r = await fetch(`${URL_}/rest/v1/${encodeURIComponent(rel)}?select=*`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    let out;
    if (r.ok) {
      const total = (r.headers.get("content-range") ?? "").split("/")[1] ?? "?";
      if (total === "0") out = "closed (0 rows visible)";
      else { out = `OPEN (${total} rows)`; open++; }
    } else if (r.status === 401 || r.status === 403 || r.status === 404) {
      out = `closed (${r.status})`;
    } else if (r.status === 416) {
      out = "closed (0 rows visible)";
    } else {
      out = `? HTTP ${r.status}: ${(await r.text()).slice(0, 60)}`;
    }
    console.log(pad(rel, 34) + out);
  }

  console.log(`\n${open} of ${relations.length} tables/views are readable with the anon key.`);
  console.log(`\nExposed functions (NOT called — review by hand): ${rpcs.length}`);
  console.log(rpcs.join(", "));
}
main().catch((e) => { console.error(e); process.exit(1); });
