/**
 * check-error-catalog.ts
 *
 * Diffs the live database's write rules (constraints, UNIQUE indexes, triggers
 * on the tables save-all and the matches dashboard write to) against the
 * Greek error mapping in src/app/lib/dbErrors/describeDbError.ts.
 *
 * Exit 1 and list every rule the mapping does not know — those fall back to
 * the generic "Η αποθήκευση απέτυχε: <raw>" message until someone maps them.
 * Also warns (exit 0) about mapped names that no longer exist in the DB.
 *
 * Needs migrations/add-list-write-rules-fn.sql applied, and .env.local with
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:  npx tsx scripts/check-error-catalog.ts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  IGNORED_RULE_PATTERNS,
  KNOWN_RULE_NAMES,
} from "../src/app/lib/dbErrors/describeDbError";

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

type Rule = { kind: string; table_name: string; name: string; definition: string };

async function main() {
const { data, error } = await sb.rpc("list_write_rules");
if (error) {
  console.error("list_write_rules() failed:", error.message);
  console.error("Is migrations/add-list-write-rules-fn.sql applied?");
  process.exit(2);
}
const rules = (data ?? []) as Rule[];

// A trigger is "known" if either its name or the function it runs is mapped.
const fnOfTrigger = (def: string) => /EXECUTE (?:FUNCTION|PROCEDURE) (?:\w+\.)?(\w+)\(/i.exec(def)?.[1] ?? null;

const known = new Set<string>(KNOWN_RULE_NAMES);
const ignored = (name: string) => IGNORED_RULE_PATTERNS.some((re) => re.test(name));

const unmapped: Rule[] = [];
const seen = new Set<string>();
for (const r of rules) {
  if (r.kind === "trigger_fn") continue; // definitions only, reported below
  const fn = r.kind === "trigger" ? fnOfTrigger(r.definition) : null;
  const names = [r.name, fn].filter((n): n is string => !!n);
  names.forEach((n) => seen.add(n));
  if (names.some((n) => known.has(n) || ignored(n))) continue;
  unmapped.push(r);
}

const fnDefs = new Map(rules.filter((r) => r.kind === "trigger_fn").map((r) => [r.name, r.definition]));

if (unmapped.length) {
  console.log(`\n${unmapped.length} rule(s) have NO Greek message (generic fallback applies):\n`);
  for (const r of unmapped) {
    console.log(`  [${r.kind}] ${r.table_name}.${r.name}`);
    console.log(`      ${r.definition.replace(/\s+/g, " ").slice(0, 160)}`);
    const fn = r.kind === "trigger" ? fnOfTrigger(r.definition) : null;
    const body = fn ? fnDefs.get(fn) : null;
    if (body) {
      const raises = body.split("\n").filter((l) => /RAISE/i.test(l)).map((l) => l.trim());
      raises.forEach((l) => console.log(`      ${l.slice(0, 160)}`));
    }
  }
} else {
  console.log("\nEvery live write rule has a Greek message.");
}

const stale = KNOWN_RULE_NAMES.filter((n) => !seen.has(n));
if (stale.length) {
  console.log(`\n${stale.length} mapped name(s) do not exist in this database (harmless, but check spelling):`);
  stale.forEach((n) => console.log(`  ${n}`));
}

console.log(`\nChecked ${rules.filter((r) => r.kind !== "trigger_fn").length} rules on ${new Set(rules.map((r) => r.table_name)).size} tables.`);
process.exit(unmapped.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
