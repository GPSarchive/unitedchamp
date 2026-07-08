// READ-ONLY inventory of dummy (is_dummy = true) rows + a sanity count of real
// rows, so we can always see exactly what belongs to our test and confirm we
// never disturb production data. Makes ZERO writes.

const { supabase, projectUrl } = require("./_client.cjs");

async function countReal(table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("is_dummy", false);
  if (error) return `err: ${error.message}`;
  return count;
}

async function listDummies(table, cols) {
  const { data, error } = await supabase
    .from(table)
    .select(cols)
    .eq("is_dummy", true)
    .order("id", { ascending: true });
  if (error) return { error: error.message };
  return { rows: data ?? [] };
}

(async () => {
  const host = (() => { try { return new URL(projectUrl).host; } catch { return projectUrl; } })();
  console.log(`\n=== DB inventory @ ${host} ===\n`);

  // Real-data sanity counts (must stay constant across our test)
  console.log("Real (is_dummy=false) row counts — these must NOT change:");
  for (const t of ["teams", "tournaments", "tournament_stages", "tournament_teams"]) {
    console.log(`  ${t.padEnd(20)} ${await countReal(t)}`);
  }

  console.log("\nDummy (is_dummy=true) rows currently present:");

  const teams = await listDummies("teams", "id,name,am,is_dummy");
  console.log(`\n[teams] ${teams.rows ? teams.rows.length : "?"}`);
  (teams.rows ?? []).forEach((r) => console.log(`  #${r.id}  ${r.name}  (am=${r.am})`));
  if (teams.error) console.log("  error:", teams.error);

  const tours = await listDummies("tournaments", "id,name,slug,status,format,is_dummy");
  console.log(`\n[tournaments] ${tours.rows ? tours.rows.length : "?"}`);
  (tours.rows ?? []).forEach((r) => console.log(`  #${r.id}  ${r.name}  slug=${r.slug}  ${r.status}/${r.format}`));
  if (tours.error) console.log("  error:", tours.error);

  // Matches/stages/groups don't all have is_dummy on every row; show those tied to dummy tournaments
  const dummyTourIds = (tours.rows ?? []).map((r) => r.id);
  if (dummyTourIds.length) {
    const { data: stages } = await supabase
      .from("tournament_stages").select("id,name,kind,tournament_id").in("tournament_id", dummyTourIds);
    console.log(`\n[tournament_stages for dummy tournaments] ${stages?.length ?? 0}`);
    (stages ?? []).forEach((s) => console.log(`  #${s.id}  ${s.name} (${s.kind})  tour=${s.tournament_id}`));

    const { count: mCount } = await supabase
      .from("matches").select("*", { count: "exact", head: true }).in("tournament_id", dummyTourIds);
    console.log(`\n[matches for dummy tournaments] ${mCount ?? 0}`);
  }

  console.log("\n=== end inventory ===\n");
})().catch((e) => { console.error(e); process.exit(1); });
