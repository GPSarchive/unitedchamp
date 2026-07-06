// Creates fake teams for a throwaway test tournament.
//
// SAFETY:
//  - Every inserted row has is_dummy = true.
//  - Names/AMs are namespaced "ZZZ Dummy Team N" / "ZZZTN" so they're obvious
//    test data and match the existing dummy rows.
//  - teams.name and teams.am are UNIQUE: we skip any that already exist
//    (idempotent — safe to re-run).
//  - Touches ONLY the teams table.

const { supabase } = require("./_client.cjs");

// Target an 8-team field (good for QF/SF/Final + mixed legs).
// E..H here; A..D already exist as #86-89 from a previous test.
const WANT = [
  { name: "ZZZ Dummy Team E", am: "ZZZTE", colour: "#e11d48" },
  { name: "ZZZ Dummy Team F", am: "ZZZTF", colour: "#2563eb" },
  { name: "ZZZ Dummy Team G", am: "ZZZTG", colour: "#16a34a" },
  { name: "ZZZ Dummy Team H", am: "ZZZTH", colour: "#d97706" },
];

(async () => {
  // What ZZZ dummy teams already exist?
  const { data: existing, error: exErr } = await supabase
    .from("teams")
    .select("id,name,am,is_dummy")
    .eq("is_dummy", true)
    .like("am", "ZZZT%")
    .order("am", { ascending: true });
  if (exErr) { console.error("read error:", exErr.message); process.exit(1); }

  const haveAms = new Set((existing ?? []).map((t) => t.am));
  const toInsert = WANT.filter((w) => !haveAms.has(w.am)).map((w) => ({
    name: w.name,
    am: w.am,
    colour: w.colour,
    logo: "/logo.jpg",
    is_dummy: true, // <-- the safety flag
  }));

  console.log("Existing ZZZ dummy teams:");
  (existing ?? []).forEach((t) => console.log(`  #${t.id}  ${t.name}  (am=${t.am})`));

  if (!toInsert.length) {
    console.log("\nNothing to insert — all target dummy teams already exist.");
  } else {
    console.log(`\nInserting ${toInsert.length} new dummy team(s): ${toInsert.map((t) => t.am).join(", ")}`);
    const { data: created, error } = await supabase.from("teams").insert(toInsert).select("id,name,am,is_dummy");
    if (error) { console.error("insert error:", error.message); process.exit(1); }
    created.forEach((t) => console.log(`  + #${t.id}  ${t.name}  (am=${t.am})  is_dummy=${t.is_dummy}`));
  }

  // Final full list of the 8-team dummy field
  const { data: all } = await supabase
    .from("teams")
    .select("id,name,am")
    .eq("is_dummy", true)
    .like("am", "ZZZT%")
    .order("am", { ascending: true });

  console.log("\n=== Full dummy team field (use these in the tournament) ===");
  (all ?? []).forEach((t) => console.log(`  #${t.id}  ${t.name}  (am=${t.am})`));
  console.log(`\nTotal: ${all?.length ?? 0} dummy teams.`);
})().catch((e) => { console.error(e); process.exit(1); });
