// Creates fake players for the ZZZ dummy teams and links them via player_teams.
//
// SAFETY:
//  - Every inserted row (player, player_statistics, player_teams) has is_dummy = true.
//  - Player names are namespaced "ZZZDummy <Team> <N>" so they're obvious test data.
//  - Idempotent: we skip a player whose (first_name,last_name) already exists,
//    and skip a link that already exists.
//  - Touches ONLY player / player_statistics / player_teams, and only dummy rows.

const { supabase } = require("./_client.cjs");

const PER_TEAM = 8;
const POSITIONS = ["GK", "DF", "DF", "DF", "MF", "MF", "FW", "FW"];

(async () => {
  // Target the existing ZZZ dummy team field (A..H).
  const { data: teams, error: te } = await supabase
    .from("teams")
    .select("id,name,am")
    .eq("is_dummy", true)
    .like("am", "ZZZT%")
    .order("am", { ascending: true });
  if (te) { console.error("teams read error:", te.message); process.exit(1); }
  if (!teams?.length) { console.error("No ZZZ dummy teams found — run seed-teams.cjs first."); process.exit(1); }

  console.log(`Found ${teams.length} dummy teams: ${teams.map(t => t.am).join(", ")}\n`);

  let createdPlayers = 0, createdLinks = 0, skippedPlayers = 0, skippedLinks = 0;

  for (const team of teams) {
    const letter = team.am.replace("ZZZT", ""); // E, F, ...
    for (let n = 1; n <= PER_TEAM; n++) {
      const first = `ZZZDummy${letter}`;
      const last = `Player${String(n).padStart(2, "0")}`;
      const position = POSITIONS[(n - 1) % POSITIONS.length];
      const player_number = n;

      // idempotent: does this dummy player already exist?
      const { data: existing, error: exErr } = await supabase
        .from("player")
        .select("id")
        .eq("first_name", first)
        .eq("last_name", last)
        .eq("is_dummy", true)
        .maybeSingle();
      if (exErr) { console.error(`read error (${first} ${last}):`, exErr.message); process.exit(1); }

      let playerId = existing?.id;
      if (playerId) {
        skippedPlayers++;
      } else {
        const { data: player, error: pErr } = await supabase
          .from("player")
          .insert({ first_name: first, last_name: last, position, player_number, is_dummy: true })
          .select("id")
          .single();
        if (pErr) { console.error(`insert player error (${first} ${last}):`, pErr.message); process.exit(1); }
        playerId = player.id;
        createdPlayers++;

        // basic dummy stats row
        const { error: sErr } = await supabase
          .from("player_statistics")
          .upsert(
            {
              player_id: playerId,
              age: 20 + (n % 12),
              total_goals: position === "FW" ? n % 5 : 0,
              total_assists: position === "MF" ? n % 4 : 0,
              yellow_cards: 0, red_cards: 0, blue_cards: 0,
              is_dummy: true,
            },
            { onConflict: "player_id" }
          );
        if (sErr) { console.error(`stats error (${first} ${last}):`, sErr.message); process.exit(1); }
      }

      // idempotent link
      const { data: link, error: lExErr } = await supabase
        .from("player_teams")
        .select("id")
        .eq("player_id", playerId)
        .eq("team_id", team.id)
        .maybeSingle();
      if (lExErr) { console.error(`link read error:`, lExErr.message); process.exit(1); }

      if (link) {
        skippedLinks++;
      } else {
        const { error: linkErr } = await supabase
          .from("player_teams")
          .insert({ player_id: playerId, team_id: team.id, is_dummy: true });
        if (linkErr) { console.error(`link insert error:`, linkErr.message); process.exit(1); }
        createdLinks++;
      }
    }
    console.log(`  ${team.name}: roster of ${PER_TEAM} players ready`);
  }

  console.log(`\n=== Done ===`);
  console.log(`Players created: ${createdPlayers} (skipped existing: ${skippedPlayers})`);
  console.log(`Links created:   ${createdLinks} (skipped existing: ${skippedLinks})`);
})().catch((e) => { console.error(e); process.exit(1); });
