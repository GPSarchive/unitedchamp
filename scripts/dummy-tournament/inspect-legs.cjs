const { supabase } = require("./_client.cjs");
(async () => {
  const { data, error } = await supabase
    .from("matches")
    .select("id, tournament_id, stage_id, round, bracket_pos, leg, team_a_id, team_b_id, team_a_score, team_b_score, penalty_a, penalty_b, status")
    .not("round", "is", null)
    .not("bracket_pos", "is", null)
    .order("tournament_id").order("stage_id").order("round").order("bracket_pos").order("leg", { nullsFirst: true });
  if (error) { console.error(error); process.exit(1); }
  console.log("Total KO rows:", data.length);
  const byTour = {};
  for (const m of data) { (byTour[m.tournament_id] ||= []).push(m); }
  for (const [tid, rows] of Object.entries(byTour)) {
    const legCounts = rows.reduce((a, r) => { const k = r.leg == null ? "null" : r.leg; a[k] = (a[k]||0)+1; return a; }, {});
    console.log(`\nTournament ${tid}: ${rows.length} KO rows, leg distribution:`, legCounts);
    const slots = {};
    for (const r of rows) { const k = `S${r.stage_id}-R${r.round}-B${r.bracket_pos}`; (slots[k] ||= []).push(r); }
    const tied = Object.entries(slots).filter(([k,v]) => v.length > 1 || v.some(r=>r.leg!=null));
    if (tied.length) {
      console.log(`  slots with legs/multi-row (${tied.length}):`);
      for (const [k,v] of tied.slice(0,10)) {
        console.log(`   ${k}: ` + v.map(r=>`id${r.id}/leg${r.leg}(${r.team_a_id}v${r.team_b_id} ${r.team_a_score}-${r.team_b_score})`).join("  "));
      }
    }
  }
})();
