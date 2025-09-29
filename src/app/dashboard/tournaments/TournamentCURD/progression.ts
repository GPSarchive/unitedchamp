// app/dashboard/tournaments/TournamentCURD/util/functions/progression.ts
"use server";

import { createClient } from "@supabase/supabase-js";

/** Service role key (server only) */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Id = number;

type MatchRow = {
  id: Id;
  tournament_id: Id | null;
  stage_id: Id | null;
  /** FK to tournament_groups.id for groups stages; null for league/KO */
  group_id: number | null;
  matchday: number | null;
  round: number | null;         // KO round
  bracket_pos: number | null;   // KO position
  team_a_id: Id | null;
  team_b_id: Id | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: "scheduled" | "finished";
  home_source_match_id: Id | null;
  home_source_outcome: "W" | "L" | null;
  away_source_match_id: Id | null;
  away_source_outcome: "W" | "L" | null;
  winner_team_id: Id | null;
  home_source_round: number | null;
  home_source_bracket_pos: number | null;
  away_source_round: number | null;
  away_source_bracket_pos: number | null;
};

type StageRow = {
  id: Id;
  tournament_id: Id;
  name: string;
  kind: "league" | "groups" | "knockout";
  ordering: number;
  config: any;
};

type GroupRow = {
  id: Id;
  stage_id: Id;
  name: string;
  ordering: number | null;
};

type IntakeMapping = {
  id: Id;
  target_stage_id: Id;
  group_idx: number;      // NOTE: stage_slots stores group index (0-based) in your schema
  slot_idx: number;       // 1-based position inside the group
  from_stage_id: Id;
  round: number;
  bracket_pos: number;
  outcome: "W" | "L";
};

/* =========================================================
   Small helpers
   ========================================================= */

async function hasStandings(stageId: Id): Promise<boolean> {
  const { data } = await supabase
    .from("stage_standings")
    .select("stage_id")
    .eq("stage_id", stageId)
    .limit(1);
  return !!(data && data.length);
}

async function getStage(stageId: Id): Promise<StageRow | null> {
  const { data } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("id", stageId)
    .single<StageRow>();
  return data ?? null;
}

async function listGroups(stageId: Id): Promise<GroupRow[]> {
  const { data } = await supabase
    .from("tournament_groups")
    .select("*")
    .eq("stage_id", stageId)
    .order("ordering", { ascending: true });
  return (data ?? []) as GroupRow[];
}

/**
 * Teams participating in a stage:
 * - groups: rows in tournament_teams with stage_id = stage.id (group_id = FK to tournament_groups.id)
 * - league: fallback to tournament_teams of the same tournament where stage_id IS NULL
 *           (that’s how your editor inserts participation for non-group stages)
 */
async function listParticipantsForStage(stage: StageRow): Promise<
  { team_id: Id; group_id: number | null }[]
> {
  if (stage.kind === "groups") {
    const { data } = await supabase
      .from("tournament_teams")
      .select("team_id, group_id")
      .eq("stage_id", stage.id);
    return (data ?? []) as any;
  }

  // league
  const { data } = await supabase
    .from("tournament_teams")
    .select("team_id")
    .eq("tournament_id", stage.tournament_id)
    .is("stage_id", null);
  const rows = (data ?? []) as Array<{ team_id: Id }>;
  return rows.map((r) => ({ team_id: r.team_id, group_id: null }));
}

/**
 * Ensure baseline standings exist for a stage with 0 finished matches:
 * - groups: for each group FK id, rank teams by (seed asc, team_id asc)
 * - league: single table at group_id = 0, rank teams likewise
 * All stats zero; rank deterministic.
 */
async function ensureBaselineStandings(stageId: Id): Promise<boolean> {
  const stage = await getStage(stageId);
  if (!stage) return false;

  const already = await hasStandings(stageId);
  if (already) return true;

  const parts = await listParticipantsForStage(stage);
  if (!parts.length) return false;

  // fetch seeds (optional)
  const { data: seedsRows } = await supabase
    .from("tournament_teams")
    .select("team_id, seed, stage_id, tournament_id")
    .eq("tournament_id", stage.tournament_id);
  const seedByTeam = new Map<number, number | null>();
  (seedsRows ?? []).forEach((r: any) => {
    // last write wins; good enough
    seedByTeam.set(r.team_id, r.seed ?? null);
  });

  type Row = {
    stage_id: Id;
    group_id: number;
    team_id: Id;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    points: number;
    rank: number;
  };

  const toInsert: Row[] = [];

  if (stage.kind === "groups") {
    // group_id is FK id here
    const byGroup = new Map<number, Id[]>();
    parts.forEach((p) => {
      if (p.group_id == null) return;
      const list = byGroup.get(p.group_id) ?? [];
      if (!list.includes(p.team_id)) list.push(p.team_id);
      byGroup.set(p.group_id, list);
    });

    for (const [gid, teamIds] of byGroup.entries()) {
      const ordered = teamIds
        .slice()
        .sort((a, b) => {
          const sa = seedByTeam.get(a) ?? Infinity;
          const sb = seedByTeam.get(b) ?? Infinity;
          if (sa !== sb) return sa - sb;
          return a - b;
        });

      ordered.forEach((team_id, idx) => {
        toInsert.push({
          stage_id: stageId,
          group_id: gid,
          team_id,
          played: 0, won: 0, drawn: 0, lost: 0,
          gf: 0, ga: 0, gd: 0, points: 0,
          rank: idx + 1,
        });
      });
    }
  } else {
    // league => group_id = 0
    const teamIds = Array.from(new Set(parts.map((p) => p.team_id)));
    const ordered = teamIds
      .slice()
      .sort((a, b) => {
        const sa = seedByTeam.get(a) ?? Infinity;
        const sb = seedByTeam.get(b) ?? Infinity;
        if (sa !== sb) return sa - sb;
        return a - b;
      });

    ordered.forEach((team_id, idx) => {
      toInsert.push({
        stage_id: stageId,
        group_id: 0,
        team_id,
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
        rank: idx + 1,
      });
    });
  }

  if (toInsert.length) {
    const { error } = await supabase.from("stage_standings").insert(toInsert as any);
    if (error) return false;
    return true;
  }
  return false;
}

/* =========================================================
   Public APIs
   ========================================================= */

/** One-call finalize (optional) */
export async function finalizeMatch(input: { matchId: Id; teamAScore: number; teamBScore: number; }) {
  const { matchId, teamAScore, teamBScore } = input;

  const { data: m, error: mErr } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single<MatchRow>();
  if (mErr || !m) throw new Error(mErr?.message || "Match not found");

  if (m.status === "finished") {
    await progressAfterMatch(matchId);
    return { ok: true, alreadyFinished: true };
  }

  let winner_team_id: Id | null = null;
  if (teamAScore > teamBScore) winner_team_id = m.team_a_id!;
  else if (teamBScore > teamAScore) winner_team_id = m.team_b_id!;
  else winner_team_id = null; // draw

  const { error: upErr } = await supabase
    .from("matches")
    .update({
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      winner_team_id,
      status: "finished",
    })
    .eq("id", matchId);
  if (upErr) throw upErr;

  await progressAfterMatch(matchId);
  return { ok: true };
}

/** Entry point the PATCH route calls after a match becomes 'finished' */
export async function progressAfterMatch(matchId: Id) {
  const { data: m, error: mErr } = await supabase
    .from("matches").select("*").eq("id", matchId).single<MatchRow>();
  if (mErr || !m) throw new Error(mErr?.message || "Match not found");
  if (m.status !== "finished") return { ok: true, skipped: "not finished" };

  // 1) KO child propagation (same stage)
  await applyKnockoutPropagation(m);

  // 2) Ensure intake mappings exist (if you have a KO → next groups edge)
  await ensureIntakeMappingsForFinishedMatch(m);

  // 3) Apply KO → Groups intake (writes into stage_slots) and then hydrate those Groups stages
  const targetGroupsStages = await applyIntakeMappings(m);
  for (const gid of targetGroupsStages) {
    await applyGroupIntakeToMatches(gid);
  }

  // 4) Recompute standings for groups/league stages
  if (m.stage_id) await recomputeStandingsIfNeeded(m.stage_id);

  // 5) If a groups/league stage is now fully finished, seed next KO (if configured)
  if (m.stage_id) {
    await seedNextKnockoutFromGroupsIfConfigured(m.stage_id);
    await seedNextKnockoutFromLeagueIfConfigured(m.stage_id);
  }

  // 6) Tournament completion (all matches finished)
  if (m.tournament_id) await maybeCompleteTournament(m.tournament_id);

  return { ok: true };
}

/** Public helper so the reseed API can force a standings snapshot right now */
export async function recomputeStandingsNow(stageId: Id) {
  await recomputeStandingsIfNeeded(stageId);
}

/* =========================================================
   Internals
   ========================================================= */

/** Propagate W/L to KO child matches within the same stage */
async function applyKnockoutPropagation(m: MatchRow) {
  if (!m.stage_id) return;

  // Pull children in same stage; filter in code to support BOTH id + stable pointers
  const { data: allChildren, error } = await supabase
    .from("matches")
    .select("*")
    .eq("stage_id", m.stage_id);

  if (error || !allChildren) return;

  const children = (allChildren as MatchRow[]).filter((child) => {
    const byId =
      child.home_source_match_id === m.id ||
      child.away_source_match_id === m.id;

    const byStable =
      (child.home_source_round === m.round &&
       child.home_source_bracket_pos === m.bracket_pos) ||
      (child.away_source_round === m.round &&
       child.away_source_bracket_pos === m.bracket_pos);

    return byId || byStable;
  });

  const W = m.winner_team_id ?? null;
  const L = m.winner_team_id
    ? (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id)
    : null;

  for (const child of children) {
    const patch: Partial<MatchRow> = {};

    const feedsHome =
      child.home_source_match_id === m.id ||
      (child.home_source_round === m.round &&
       child.home_source_bracket_pos === m.bracket_pos);

    const feedsAway =
      child.away_source_match_id === m.id ||
      (child.away_source_round === m.round &&
       child.away_source_bracket_pos === m.bracket_pos);

    // If outcome is missing, assume single-elim winner carry-over
    const homeOutcome = (child.home_source_outcome ?? "W") as "W" | "L";
    const awayOutcome = (child.away_source_outcome ?? "W") as "W" | "L";

    if (feedsHome && child.team_a_id == null) {
      if (homeOutcome === "W") patch.team_a_id = W;
      if (homeOutcome === "L") patch.team_a_id = L;
    }
    if (feedsAway && child.team_b_id == null) {
      if (awayOutcome === "W") patch.team_b_id = W;
      if (awayOutcome === "L") patch.team_b_id = L;
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from("matches").update(patch).eq("id", child.id);
    }
  }
}

/**
 * Auto-create intake_mappings for this KO match’s (round, bracket_pos) → next groups stage.
 * Default rule:
 *  - If there are ≥2 groups in the next groups stage: Winner → Group A (idx 0), Loser → Group B (idx 1).
 *  - Else: Winner → Group A (idx 0) only.
 * Slot is assigned as the **next free slot** in each target group.
 */
async function ensureIntakeMappingsForFinishedMatch(m: MatchRow) {
  if (!m.stage_id || !m.tournament_id) return;
  if (m.round == null || m.bracket_pos == null) return;

  // Already mapped?
  const { data: existing } = await supabase
    .from("intake_mappings")
    .select("id")
    .eq("from_stage_id", m.stage_id)
    .eq("round", m.round)
    .eq("bracket_pos", m.bracket_pos)
    .limit(1);
  if (existing && existing.length > 0) return;

  // Figure out the *next* groups stage in this tournament (or one that config explicitly points to)
  const nextGroups = await findNextGroupsStageFor(m.stage_id);
  if (!nextGroups) return;

  // Read all groups for that stage to know how many groups exist
  const groups = await listGroups(nextGroups.id);
  const groupCount = groups.length;

  // Decide target group indexes by rule
  const winnerGroupIdx = 0;
  const loserGroupIdx  = groupCount >= 2 ? 1 : null;

  // Compute next free slot per group by reading stage_slots (group_id = index)
  const nextSlotWinner = await nextFreeSlot(nextGroups.id, winnerGroupIdx);
  const inserts: Partial<IntakeMapping>[] = [
    {
      target_stage_id: nextGroups.id,
      group_idx: winnerGroupIdx,
      slot_idx: nextSlotWinner,
      from_stage_id: m.stage_id,
      round: m.round!,
      bracket_pos: m.bracket_pos!,
      outcome: "W",
    },
  ];

  if (loserGroupIdx != null) {
    const nextSlotLoser = await nextFreeSlot(nextGroups.id, loserGroupIdx);
    inserts.push({
      target_stage_id: nextGroups.id,
      group_idx: loserGroupIdx,
      slot_idx: nextSlotLoser,
      from_stage_id: m.stage_id,
      round: m.round!,
      bracket_pos: m.bracket_pos!,
      outcome: "L",
    } as any);
  }

  if (inserts.length) {
    await supabase.from("intake_mappings").insert(inserts as any);
  }
}

/** Write KO outcomes into stage_slots according to intake_mappings; return touched Groups stage IDs */
async function applyIntakeMappings(m: MatchRow): Promise<Id[]> {
  if (!m.stage_id || m.round == null || m.bracket_pos == null) return [];

  const { data: maps, error: mapsErr } = await supabase
    .from("intake_mappings")
    .select("*")
    .eq("from_stage_id", m.stage_id)
    .eq("round", m.round)
    .eq("bracket_pos", m.bracket_pos);

  if (mapsErr) {
    console.error("applyIntakeMappings: failed to read intake_mappings", mapsErr);
    return [];
  }
  if (!maps || maps.length === 0) return [];

  const winnerId = m.winner_team_id ?? null;
  const loserId  =
    m.winner_team_id
      ? (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id)
      : null;

  const touchedStages = new Set<Id>();
  const upserts: Array<{
    stage_id: Id;
    group_id: number; // group index (0-based)
    slot_id: number;  // 1-based
    team_id: Id;
    source: "intake";
  }> = [];

  for (const it of maps as IntakeMapping[]) {
    const teamId = it.outcome === "W" ? winnerId : loserId;
    if (!teamId) continue; // tie or no result → skip

    touchedStages.add(it.target_stage_id);
    upserts.push({
      stage_id: it.target_stage_id,
      group_id: it.group_idx,
      slot_id: it.slot_idx,
      team_id: teamId,
      source: "intake",
    });
  }

  if (upserts.length) {
    const { error: upsertErr } = await supabase
      .from("stage_slots")
      .upsert(upserts, { onConflict: "stage_id,group_id,slot_id" });
    if (upsertErr) {
      console.error("applyIntakeMappings: stage_slots upsert failed", upsertErr);
      // still return touched stages so hydration could be retried manually if needed
    }
  }

  return Array.from(touchedStages);
}

/** Recompute standings for a groups/league stage (3-1-0) */
async function recomputeStandingsIfNeeded(stageId: Id) {
  const stage = await getStage(stageId);
  if (!stage) return;
  if (stage.kind === "knockout") return;

  // Pull all finished matches in this stage
  const { data: ms } = await supabase
    .from("matches")
    .select("*")
    .eq("stage_id", stageId)
    .eq("status", "finished");

  // Fetch declared participants for this stage
  const parts = await listParticipantsForStage(stage);

  // Bucket finished matches by group_id (DB FK id for groups; treat league null as 0)
  const buckets = new Map<number, MatchRow[]>();
  for (const mm of (ms ?? []) as MatchRow[]) {
    const gid = mm.group_id ?? 0;
    if (!buckets.has(gid)) buckets.set(gid, []);
    buckets.get(gid)!.push(mm);
  }

  // Build a map: group_id (or 0 for league) -> all team_ids that belong to that group
  const teamsByGroup = new Map<number, Id[]>();
  if (stage.kind === "groups") {
    (parts ?? []).forEach((p) => {
      if (p.group_id == null) return;
      const list = teamsByGroup.get(p.group_id) ?? [];
      if (!list.includes(p.team_id)) list.push(p.team_id);
      teamsByGroup.set(p.group_id, list);
    });
  } else {
    // league: every team declared for the tournament with stage_id null
    const allTeams = Array.from(new Set(parts.map((p) => p.team_id)));
    teamsByGroup.set(0, allTeams);
  }

  // If no matches are finished yet, we still want a zeroed baseline so KO can seed.
  const bucketKeys = new Set<number>([
    ...teamsByGroup.keys(),
    ...buckets.keys(),
  ]);

  for (const gid of bucketKeys) {
    const list = (buckets.get(gid) ?? []) as MatchRow[];
    const initialTeams = teamsByGroup.get(gid) ?? [];

    const stats = new Map<
      Id,
      { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }
    >();

    // Pre-seed zeros so everyone shows up in standings
    initialTeams.forEach((tid) => {
      stats.set(tid, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 });
    });

    const bump = (team: Id, d: Partial<{ played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }>) => {
      const s = stats.get(team) || { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      for (const k of Object.keys(d) as (keyof typeof s)[]) s[k] += d[k] as number;
      stats.set(team, s);
    };

    for (const mm of list) {
      const A = mm.team_a_id, B = mm.team_b_id;
      if (!A || !B) continue;
      const as = mm.team_a_score ?? 0, bs = mm.team_b_score ?? 0;

      bump(A, { played: 1, gf: as, ga: bs });
      bump(B, { played: 1, gf: bs, ga: as });

      if (as > bs) { bump(A, { won: 1, points: 3 }); bump(B, { lost: 1 }); }
      else if (bs > as) { bump(B, { won: 1, points: 3 }); bump(A, { lost: 1 }); }
      else { bump(A, { drawn: 1, points: 1 }); bump(B, { drawn: 1, points: 1 }); }
    }

    // Sort by points, GD, GF; then deterministic by team_id
    const ranked = [...stats.entries()]
      .map(([team_id, s]) => ({ team_id, gd: s.gf - s.ga, ...s }))
      .sort((a, b) =>
        b.points - a.points ||
        (b.gd) - (a.gd) ||
        b.gf - a.gf ||
        (a.team_id - b.team_id)
      )
      .map((r, i) => ({ ...r, rank: i + 1 }));

    // reset & insert
    await supabase.from("stage_standings").delete().eq("stage_id", stageId).eq("group_id", gid);
    if (ranked.length) {
      await supabase.from("stage_standings").insert(
        ranked.map(r => ({
          stage_id: stageId,
          group_id: gid,
          team_id: r.team_id,
          played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
          gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, rank: r.rank,
        }))
      );
    }
  }
}

/** If a GROUPS stage is fully finished and a later KO stage config points to it → seed KO */
export async function seedNextKnockoutFromGroupsIfConfigured(
  sourceStageId: Id,
  { reseed = false, allowEarly = true }: { reseed?: boolean; allowEarly?: boolean } = {}
) {
  const src = await getStage(sourceStageId);
  if (!src || src.kind !== "groups") return;

  // If we aren’t allowed to seed early, fall back to the old “all finished” check.
  if (!allowEarly) {
    const { data: all } = await supabase.from("matches").select("status").eq("stage_id", sourceStageId);
    const allFinished = (all ?? []).every((r: any) => r.status === "finished");
    if (!allFinished) return;
  }

  // Always ensure standings exist & are current:
  // 1) recompute from whatever finished matches we have
  await recomputeStandingsIfNeeded(sourceStageId);
  // 2) if still no rows (e.g. no fixtures at all), create a baseline ranked by seed
  if (!(await hasStandings(sourceStageId))) {
    const ok = await ensureBaselineStandings(sourceStageId);
    if (!ok) return; // cannot seed without knowing participants
  }

  // Find the first later KO stage that explicitly references this groups stage
  const { data: laterStages } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("tournament_id", src.tournament_id)
    .gt("ordering", src.ordering)
    .order("ordering", { ascending: true });
  if (!laterStages) return;

  const nextKO = (laterStages as StageRow[]).find(
    (s) =>
      s.kind === "knockout" &&
      (s.config?.from_stage_id === sourceStageId || s.config?.fromStageId === sourceStageId)
  );
  if (!nextKO) return;

  // KO “already has matches?” guard
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id,status")
    .eq("stage_id", nextKO.id);

  if (existingMatches && existingMatches.length > 0) {
    const hasFinished = existingMatches.some((m: any) => m.status === "finished");
    if (hasFinished) return; // never reseed once KO started
    if (!reseed) return;     // keep idempotent by default unless caller asks to reseed
    await supabase.from("matches").delete().eq("stage_id", nextKO.id);
  }

  // Config knobs
  const advancersPerGroup = Math.max(1, Number(nextKO.config?.advancers_per_group ?? 2));
  const semisCross: "A1-B2" | "A1-B1" = nextKO.config?.semis_cross === "A1-B1" ? "A1-B1" : "A1-B2";

  // Read CURRENT standings
  const { data: standings } = await supabase
    .from("stage_standings")
    .select("*")
    .eq("stage_id", sourceStageId);
  if (!standings || standings.length === 0) return;

  // Group them by (DB) group id and take top-N by rank
  const byGroup = new Map<number, any[]>();
  (standings as any[]).forEach((r) => {
    const g = Number(r.group_id ?? 0);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(r);
  });
  const groupIds = [...byGroup.keys()].sort((a, b) => a - b);

  const perGroupTop: Id[][] = groupIds.map((g) =>
    byGroup
      .get(g)!
      .slice()
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .slice(0, advancersPerGroup)
      .map((r) => r.team_id as Id)
      .filter(Boolean)
  );

  const G = perGroupTop.length;
  const totalEntrants = perGroupTop.reduce((acc, arr) => acc + arr.length, 0);
  if (totalEntrants < 2) return;

  // Special case: 2 groups, 2 advancers → Semis + Final with stable pointers
  if (G === 2 && advancersPerGroup === 2 && perGroupTop[0].length >= 2 && perGroupTop[1].length >= 2) {
    const [A1, A2] = perGroupTop[0];
    const [B1, B2] = perGroupTop[1];
    const semiPairs =
      semisCross === "A1-B2" ? [[A1 ?? null, B2 ?? null], [B1 ?? null, A2 ?? null]] : [[A1 ?? null, B1 ?? null], [A2 ?? null, B2 ?? null]];

    const inserts: Partial<MatchRow>[] = [
      {
        tournament_id: src.tournament_id,
        stage_id: nextKO.id,
        round: 1,
        bracket_pos: 1,
        team_a_id: semiPairs[0][0] ?? null,
        team_b_id: semiPairs[0][1] ?? null,
        status: "scheduled",
        matchday: null,
        group_id: null,
        home_source_match_id: null,
        home_source_outcome: "W",
        away_source_match_id: null,
        away_source_outcome: "W",
        home_source_round: null,
        home_source_bracket_pos: null,
        away_source_round: null,
        away_source_bracket_pos: null,
      } as any,
      {
        tournament_id: src.tournament_id,
        stage_id: nextKO.id,
        round: 1,
        bracket_pos: 2,
        team_a_id: semiPairs[1][0] ?? null,
        team_b_id: semiPairs[1][1] ?? null,
        status: "scheduled",
        matchday: null,
        group_id: null,
        home_source_match_id: null,
        home_source_outcome: "W",
        away_source_match_id: null,
        away_source_outcome: "W",
        home_source_round: null,
        home_source_bracket_pos: null,
        away_source_round: null,
        away_source_bracket_pos: null,
      } as any,
      {
        tournament_id: src.tournament_id,
        stage_id: nextKO.id,
        round: 2,
        bracket_pos: 1,
        status: "scheduled",
        matchday: null,
        group_id: null,
        home_source_match_id: null,
        home_source_outcome: "W",
        away_source_match_id: null,
        away_source_outcome: "W",
        home_source_round: 1,
        home_source_bracket_pos: 1,
        away_source_round: 1,
        away_source_bracket_pos: 2,
      } as any,
    ];

    await supabase.from("matches").insert(inserts as any);
    return;
  }

  // Generic Any-N case
  const tiers: Id[][] = [];
  for (let r = 1; r <= advancersPerGroup; r++) {
    const tier: Id[] = [];
    perGroupTop.forEach((arr) => {
      const team = arr[r - 1];
      if (team) tier.push(team);
    });
    if (tier.length) tiers.push(tier);
  }
  const entrantTeamIds: Id[] = tiers.flat();
  const inserts = buildAnyNKnockoutInsertRows({
    tournamentId: src.tournament_id,
    stageId: nextKO.id,
    entrantTeamIds,
  });
  if (inserts.length) {
    await supabase.from("matches").insert(inserts as any);
  }
}


/** If a LEAGUE stage is fully finished and a later KO stage config points to it → seed KO */
/** If a LEAGUE stage should seed a later KO stage → seed from CURRENT table.
 *  Works even if no/partial games have been played.
 */
export async function seedNextKnockoutFromLeagueIfConfigured(
  sourceStageId: Id,
  { reseed = false, allowEarly = true }: { reseed?: boolean; allowEarly?: boolean } = {}
) {
  const src = await getStage(sourceStageId);
  if (!src || src.kind !== "league") return;

  if (!allowEarly) {
    const { data: all } = await supabase.from("matches").select("status").eq("stage_id", sourceStageId);
    const allFinished = (all ?? []).every((r: any) => r.status === "finished");
    if (!allFinished) return;
  }

  // Ensure standings exist now
  await recomputeStandingsIfNeeded(sourceStageId);
  if (!(await hasStandings(sourceStageId))) {
    const ok = await ensureBaselineStandings(sourceStageId);
    if (!ok) return;
  }

  // Find the first later KO stage that references this league stage
  const { data: laterStages } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("tournament_id", src.tournament_id)
    .gt("ordering", src.ordering)
    .order("ordering", { ascending: true });
  if (!laterStages) return;

  const nextKO = (laterStages as StageRow[]).find(
    (s) =>
      s.kind === "knockout" &&
      (s.config?.from_stage_id === sourceStageId || s.config?.fromStageId === sourceStageId)
  );
  if (!nextKO) return;

  // KO “already has matches?” guard
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id,status")
    .eq("stage_id", nextKO.id);

  if (existingMatches && existingMatches.length > 0) {
    const hasFinished = existingMatches.some((m: any) => m.status === "finished");
    if (hasFinished) return;
    if (!reseed) return;
    await supabase.from("matches").delete().eq("stage_id", nextKO.id);
  }

  // How many advance? prefer explicit total; fallback to bracket size; else 8.
  const advancersTotal = Math.max(
    2,
    Number(nextKO.config?.advancers_total ?? nextKO.config?.standalone_bracket_size ?? 8)
  );

  // Read CURRENT standings (league is single table)
  const { data: standings } = await supabase
    .from("stage_standings")
    .select("*")
    .eq("stage_id", sourceStageId);
  if (!standings || standings.length === 0) return;

  const entrantTeamIds: Id[] = (standings as any[])
    .slice()
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .map((r) => r.team_id as Id)
    .filter(Boolean)
    .slice(0, advancersTotal);

  if (entrantTeamIds.length < 2) return;

  const inserts = buildAnyNKnockoutInsertRows({
    tournamentId: src.tournament_id,
    stageId: nextKO.id,
    entrantTeamIds,
  });
  if (inserts.length) {
    await supabase.from("matches").insert(inserts as any);
  }
}

/** Tournament completion: mark tournaments.status='completed' if all its matches are finished */
async function maybeCompleteTournament(tournamentId: Id) {
  const { data: ms } = await supabase
    .from("matches").select("status").eq("tournament_id", tournamentId);
  if (!ms || ms.length === 0) return;
  const done = ms.every((r: any) => r.status === "finished");
  if (done) {
    await supabase.from("tournaments").update({ status: "completed" }).eq("id", tournamentId);
  }
}

/* =========================================================
   Utilities
   ========================================================= */

/** Find the next 'groups' stage after a given source KO stage (or the one its config requests) */
async function findNextGroupsStageFor(sourceStageId: Id): Promise<StageRow | null> {
  const src = await getStage(sourceStageId);
  if (!src) return null;

  const { data: laterStages } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("tournament_id", src.tournament_id)
    .gt("ordering", src.ordering)
    .order("ordering", { ascending: true });
  if (!laterStages) return null;

  // (1) explicit config edge wins
  const explicit = (laterStages as StageRow[]).find(s =>
    s.kind === "groups" &&
    (s.config?.from_stage_id === sourceStageId || s.config?.fromStageId === sourceStageId)
  );
  if (explicit) return explicit;

  // (2) otherwise, first groups stage after it
  const firstGroups = (laterStages as StageRow[]).find(s => s.kind === "groups");
  return firstGroups ?? null;
}

/** Compute next free slot_id for a given (stage_id, group_idx) in stage_slots */
async function nextFreeSlot(stageId: Id, groupIdx: number): Promise<number> {
  const { data: rows } = await supabase
    .from("stage_slots")
    .select("slot_id")
    .eq("stage_id", stageId)
    .eq("group_id", groupIdx)
    .order("slot_id", { ascending: false })
    .limit(1);
  const max = rows && rows.length > 0 ? Number(rows[0].slot_id) : 0;
  return (Number.isFinite(max) ? max : 0) + 1;
}

/* =========================================================
   Hydrate Groups skeletons with KO intake (stage_slots → matches)
   ========================================================= */

/**
 * Read stage_slots for a Groups stage and materialize those team IDs
 * into that stage's existing SKELETON matches (created by KO→Groups intake).
 *
 * Rules:
 *  - Only touches matches in this stage.
 *  - Only fills team_a_id / team_b_id where they are NULL.
 *  - Never touches finished matches.
 *  - Respects the round-robin "circle method" used to build the skeleton.
 */
async function applyGroupIntakeToMatches(groupsStageId: Id) {
  // 1) Verify stage kind
  const stage = await getStage(groupsStageId);
  if (!stage || stage.kind !== "groups") return;

  // 2) Map groupIdx -> actual group FK id
  const groups = await listGroups(groupsStageId); // ordered by 'ordering'
  const groupIdxToId = groups.map((g) => g.id);

  // 3) Gather stage_slots (group index, slot order -> team_id)
  const { data: slotsRows } = await supabase
    .from("stage_slots")
    .select("group_id,slot_id,team_id")
    .eq("stage_id", groupsStageId)
    .order("group_id", { ascending: true })
    .order("slot_id", { ascending: true });

  const slotsByIdx: Map<number, number[]> = new Map();
  (slotsRows ?? []).forEach((r: any) => {
    if (r.team_id == null) return;
    const gidx = Number(r.group_id);
    const arr = slotsByIdx.get(gidx) ?? [];
    // slot_id is 1-based → store in 0-based list
    arr[r.slot_id - 1] = Number(r.team_id);
    slotsByIdx.set(gidx, arr);
  });

  // 4) Determine repeats from stage config
  const cfg = (stage.config ?? {}) as any;
  const repeatsRaw = Number(cfg.rounds_per_opponent ?? cfg["αγώνες_ανά_αντίπαλο"]);
  const doubleRound = !!(cfg.double_round ?? cfg["διπλός_γύρος"]);
  const repeats: number = Number.isFinite(repeatsRaw)
    ? Math.max(1, Number(repeatsRaw))
    : doubleRound
    ? 2
    : 1;

  // 5) For each group index with >=2 entrants, generate RR pairs and hydrate
  for (let gidx = 0; gidx < groupIdxToId.length; gidx++) {
    const teamIds = (slotsByIdx.get(gidx) ?? []).filter((x) => Number.isFinite(x));
    if (teamIds.length < 2) continue;

    const pairsByMd = generateRoundRobinPairsByMatchday(teamIds, repeats);

    // Fetch this group's matches that are SCHEDULED (not finished), sorted by matchday then id
    const groupFk = groupIdxToId[gidx];
    const { data: groupMatches } = await supabase
      .from("matches")
      .select("id,matchday,team_a_id,team_b_id,status")
      .eq("stage_id", groupsStageId)
      .eq("group_id", groupFk)
      .neq("status", "finished")
      .order("matchday", { ascending: true })
      .order("id", { ascending: true });

    const byMd = new Map<number, any[]>();
    (groupMatches ?? []).forEach((row: any) => {
      if (row.matchday == null) return;
      const list = byMd.get(row.matchday) ?? [];
      list.push(row);
      byMd.set(row.matchday, list);
    });

    const updates: any[] = [];
    for (const [md, pairs] of pairsByMd) {
      const rows = byMd.get(md) ?? [];
      const count = Math.min(rows.length, pairs.length);
      for (let i = 0; i < count; i++) {
        const row = rows[i];
        const [aId, bId] = pairs[i];
        const patch: any = { id: row.id };
        // only set if currently null (preserve manual edits)
        if (row.team_a_id == null) patch.team_a_id = aId;
        if (row.team_b_id == null) patch.team_b_id = bId;
        if (patch.team_a_id != null || patch.team_b_id != null) {
          updates.push(patch);
        }
      }
    }

    if (updates.length) {
      await supabase.from("matches").upsert(updates as any, { onConflict: "id" });
    }
  }
}

/**
 * Generate round-robin pairs per matchday using the circle method.
 * Returns a Map(matchday -> Array<[teamAId, teamBId]>).
 */
function generateRoundRobinPairsByMatchday(
  teamIds: number[],
  repeats: number
): Map<number, [number, number][]> {
  const n = teamIds.length;
  const hasBye = n % 2 === 1;
  const m = hasBye ? n + 1 : n;
  const rounds = m - 1;
  const half = m / 2;

  // 0..m-1, last acts as BYE if odd
  let arr = Array.from({ length: m }, (_v, i) => i);
  const out = new Map<number, [number, number][]>();

  const pushRound = (baseMd: number) => {
    const list: [number, number][] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (hasBye && (a === m - 1 || b === m - 1)) continue;
      list.push([teamIds[a], teamIds[b]]);
    }
    out.set(baseMd, list);
  };

  // Base single round
  for (let r = 0; r < rounds; r++) {
    pushRound(r + 1);
    // rotate (keep first fixed)
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }

  // Extra repeats → duplicate base with matchday offset
  for (let rep = 2; rep <= Math.max(1, repeats); rep++) {
    for (let r = 0; r < rounds; r++) {
      const baseMd = r + 1;
      const md = (rep - 1) * rounds + baseMd;
      const basePairs = out.get(baseMd) ?? [];
      out.set(md, basePairs.slice());
    }
  }

  return out;
}

/* =========================================================
   Any-N knockout builder (server) — stable pointers
   ========================================================= */

function nextPow2(n: number) {
  return n <= 1 ? 1 : 1 << Math.ceil(Math.log2(n));
}

/** Standard seeded bracket order for size n (n must be power of two). */
function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  const prev = seedOrder(n / 2);
  const out: number[] = [];
  for (const s of prev) {
    out.push(s);
    out.push(n + 1 - s);
  }
  return out;
}

/**
 * Build insert rows for a seeded knockout for any N (with byes).
 * - Computes next power-of-two P
 * - Seeds into standard bracket order for P
 * - R1: create only real-vs-real matches; byes advance the real seed into R2
 * - R>=2: create matches and wire stable pointers (round, bracket_pos) with outcome="W"
 */
function buildAnyNKnockoutInsertRows(opts: {
  tournamentId: Id;
  stageId: Id;
  entrantTeamIds: Id[]; // order = seed 1..N
}): Partial<MatchRow>[] {
  const { tournamentId, stageId, entrantTeamIds } = opts;
  const N = entrantTeamIds.length;
  if (N <= 0) return [];

  const P = nextPow2(N);
  const order = seedOrder(P); // e.g. 16 → [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]

  // seed → team id (undefined means bye)
  const bySeed = new Map<number, Id>();
  entrantTeamIds.forEach((id, i) => bySeed.set(i + 1, id));

  type Entry =
    | { teamId: Id; from?: undefined }
    | { from: { round: number; pos: number }; teamId?: undefined };

  const entries: Record<number, Entry[]> = {};
  entries[1] = [];

  // Fill Round 1 slots by seed order (ghosts as undefined)
  for (let i = 0; i < P; i++) {
    const seed = order[i];
    const teamId = seed <= N ? bySeed.get(seed) : undefined;
    if (teamId) entries[1].push({ teamId });
    else entries[1].push(undefined as any); // bye placeholder
  }

  const rows: Partial<MatchRow>[] = [];

  // Round 1: create only for real-vs-real; otherwise advance the real seed to R2
  const r1Count = P / 2;
  entries[2] = [];
  for (let pos = 1; pos <= r1Count; pos++) {
    const a = entries[1][2 * (pos - 1)];
    const b = entries[1][2 * (pos - 1) + 1];

    const aId = (a as any)?.teamId as Id | undefined;
    const bId = (b as any)?.teamId as Id | undefined;

    if (aId && bId) {
      rows.push({
        tournament_id: tournamentId,
        stage_id: stageId,
        group_id: null,
        matchday: null,
        status: "scheduled",
        round: 1,
        bracket_pos: pos,
        team_a_id: aId,
        team_b_id: bId,
        home_source_match_id: null,
        home_source_outcome: "W",
        away_source_match_id: null,
        away_source_outcome: "W",
        home_source_round: null,
        home_source_bracket_pos: null,
        away_source_round: null,
        away_source_bracket_pos: null,
      });
      entries[2][pos - 1] = { from: { round: 1, pos } };
    } else {
      const adv = aId ?? bId; // one real or none
      if (adv) entries[2][pos - 1] = { teamId: adv };
      else entries[2][pos - 1] = undefined as any; // (rare) bye vs bye – bubble up empty
    }
  }

  // Rounds 2..log2(P): create matches; wire stable pointers, set outcome="W"
  let round = 2;
  while ((1 << (round - 1)) <= P) {
    const prev = entries[round] ?? [];
    const count = Math.floor((prev.length || 0) / 2);
    if (count < 1) break;

    entries[round + 1] = [];

    for (let pos = 1; pos <= count; pos++) {
      const left = prev[2 * (pos - 1)];
      const right = prev[2 * (pos - 1) + 1];

      const base: Partial<MatchRow> = {
        tournament_id: tournamentId,
        stage_id: stageId,
        group_id: null,
        matchday: null,
        status: "scheduled",
        round,
        bracket_pos: pos,
        team_a_id: null,
        team_b_id: null,
        home_source_match_id: null,
        home_source_outcome: "W",
        away_source_match_id: null,
        away_source_outcome: "W",
        home_source_round: null,
        home_source_bracket_pos: null,
        away_source_round: null,
        away_source_bracket_pos: null,
      };

      // left side
      if ((left as any)?.from) {
        base.home_source_round = (left as any).from.round;
        base.home_source_bracket_pos = (left as any).from.pos;
      } else if ((left as any)?.teamId) {
        base.team_a_id = (left as any).teamId ?? null;
      }

      // right side
      if ((right as any)?.from) {
        base.away_source_round = (right as any).from.round;
        base.away_source_bracket_pos = (right as any).from.pos;
      } else if ((right as any)?.teamId) {
        base.team_b_id = (right as any).teamId ?? null;
      }

      rows.push(base);

      // next pointer
      entries[round + 1][pos - 1] = { from: { round, pos } };
    }

    round += 1;
  }

  return rows;
}
