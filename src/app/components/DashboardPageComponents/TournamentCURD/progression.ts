// app/components/DashboardPageComponents/TournamentCURD/progression.ts
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
  group_id: number | null;      // <-- your schema (index-like)
  matchday: number | null;
  round: number | null;         // <-- KO round
  bracket_pos: number | null;   // <-- KO position
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
  group_idx: number;      // table still uses *_idx here
  slot_idx: number;
  from_stage_id: Id;
  round: number;
  bracket_pos: number;
  outcome: "W" | "L";
};

/* =========================================================
   Public APIs
   ========================================================= */

/** One-call finalize (optional) */
export async function finalizeMatch(input: { matchId: Id; teamAScore: number; teamBScore: number; }) {
  const { matchId, teamAScore, teamBScore } = input;

  const { data: m, error: mErr } = await supabase
    .from("matches").select("*").eq("id", matchId).single<MatchRow>();
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

  // 3) Apply KO → Groups intake (writes into stage_slots)
  await applyIntakeMappings(m);

  // 4) Recompute standings for groups/league stages
  if (m.stage_id) await recomputeStandingsIfNeeded(m.stage_id);

  // 5) If a groups stage is now fully finished, seed next KO (if configured)
  if (m.stage_id) await seedNextKnockoutFromGroupsIfConfigured(m.stage_id);

  // 6) Tournament completion (all matches finished)
  if (m.tournament_id) await maybeCompleteTournament(m.tournament_id);

  return { ok: true };
}

/* =========================================================
   Internals
   ========================================================= */

/** Propagate W/L to KO child matches within the same stage */
async function applyKnockoutPropagation(m: MatchRow) {
  if (!m.stage_id) return;

  const { data: children, error: chErr } = await supabase
    .from("matches")
    .select("*")
    .eq("stage_id", m.stage_id)
    .or(`home_source_match_id.eq.${m.id},away_source_match_id.eq.${m.id}`);
  if (chErr || !children) return;

  const W = m.winner_team_id ?? null;
  const L = m.winner_team_id
    ? (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id)
    : null;

  for (const child of children as MatchRow[]) {
    const patch: Partial<MatchRow> = {};

    if (child.home_source_match_id === m.id && child.team_a_id == null) {
      if (child.home_source_outcome === "W") patch.team_a_id = W;
      if (child.home_source_outcome === "L") patch.team_a_id = L;
    }
    if (child.away_source_match_id === m.id && child.team_b_id == null) {
      if (child.away_source_outcome === "W") patch.team_b_id = W;
      if (child.away_source_outcome === "L") patch.team_b_id = L;
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
  const { data: groups } = await supabase
    .from("tournament_groups")
    .select("*")
    .eq("stage_id", nextGroups.id)
    .order("ordering", { ascending: true });
  const groupCount = (groups ?? []).length;

  // Decide target group indexes by rule
  const winnerGroupIdx = 0;                     // Group A
  const loserGroupIdx  = groupCount >= 2 ? 1 : null; // Group B if exists

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
    });
  }

  if (inserts.length) {
    await supabase.from("intake_mappings").insert(inserts as any);
  }
}

/** Write KO outcomes into stage_slots according to intake_mappings */
async function applyIntakeMappings(m: MatchRow) {
  if (!m.stage_id || m.round == null || m.bracket_pos == null) return;

  const { data: maps } = await supabase
    .from("intake_mappings")
    .select("*")
    .eq("from_stage_id", m.stage_id)
    .eq("round", m.round)
    .eq("bracket_pos", m.bracket_pos);

  if (!maps || maps.length === 0) return;

  const winnerId = m.winner_team_id ?? null;
  const loserId  = m.winner_team_id
    ? (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id)
    : null;

  for (const it of maps as IntakeMapping[]) {
    const teamId = it.outcome === "W" ? winnerId : loserId;
    if (!teamId) continue; // draw → no write

    await supabase
      .from("stage_slots")
      .upsert(
        {
          stage_id: it.target_stage_id,
          group_id: it.group_idx,  // NOTE: your stage_slots uses group_id (index)
          slot_id:  it.slot_idx,   // and slot_id
          team_id: teamId,
          source: "intake",
        },
        { onConflict: "stage_id,group_id,slot_id" }
      );
  }
}

/** Recompute standings for a groups/league stage (3-1-0) */
async function recomputeStandingsIfNeeded(stageId: Id) {
  const { data: stage } = await supabase
    .from("tournament_stages").select("*").eq("id", stageId).single<StageRow>();
  if (!stage) return;
  if (stage.kind === "knockout") return;

  const { data: ms } = await supabase
    .from("matches")
    .select("*")
    .eq("stage_id", stageId)
    .eq("status", "finished");

  // bucket by group_id (treat null as 0 for a single-table league)
  const buckets = new Map<number, MatchRow[]>();
  for (const mm of (ms ?? []) as MatchRow[]) {
    const gid = mm.group_id ?? 0;
    if (!buckets.has(gid)) buckets.set(gid, []);
    buckets.get(gid)!.push(mm);
  }

  for (const [gid, list] of buckets.entries()) {
    const stats = new Map<
      Id,
      { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }
    >();

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

    const ranked = [...stats.entries()]
      .map(([team_id, s]) => ({ team_id, gd: s.gf - s.ga, ...s }))
      .sort((a, b) => b.points - a.points || (b.gd) - (a.gd) || b.gf - a.gf)
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

/** If a groups stage is fully finished and next stage config says so → create KO round */
async function seedNextKnockoutFromGroupsIfConfigured(sourceStageId: Id) {
  const { data: src } = await supabase
    .from("tournament_stages").select("*").eq("id", sourceStageId).single<StageRow>();
  if (!src) return;

  // consider "done" if all its matches are finished
  const { data: all } = await supabase
    .from("matches").select("status").eq("stage_id", sourceStageId);
  if (!all || all.length === 0 || !all.every((r: any) => r.status === "finished")) return;

  const { data: stagesSameTournament } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("tournament_id", src.tournament_id)
    .order("ordering", { ascending: true });
  if (!stagesSameTournament) return;

  const idx = stagesSameTournament.findIndex((s: any) => s.id === sourceStageId);
  const next = stagesSameTournament[idx + 1] as StageRow | undefined;
  if (!next || next.kind !== "knockout") return;

  const cfg = next.config || {};
  const fromStageId = cfg.from_stage_id ?? cfg.fromStageId;
  const advancersPerGroup: number = Number(cfg.advancers_per_group ?? 2);
  if (fromStageId !== sourceStageId) return;

  const { data: top } = await supabase
    .from("stage_standings")
    .select("*")
    .eq("stage_id", sourceStageId)
    .lte("rank", advancersPerGroup);
  if (!top || top.length === 0) return;

  const teamIds = top
    .sort((a: any, b: any) => a.group_id - b.group_id || a.rank - b.rank)
    .map((r: any) => r.team_id);

  // Example: simple 4-team KO
  if (teamIds.length === 4) {
    const [A1, A2, B1, B2] = teamIds; // assumes two groups A(0), B(1)
    await supabase.from("matches").insert([
      { tournament_id: src.tournament_id, stage_id: next.id, round: 1, bracket_pos: 1, team_a_id: A1, team_b_id: B2, status: "scheduled" },
      { tournament_id: src.tournament_id, stage_id: next.id, round: 1, bracket_pos: 2, team_a_id: B1, team_b_id: A2, status: "scheduled" },
      { tournament_id: src.tournament_id, stage_id: next.id, round: 2, bracket_pos: 1, status: "scheduled", home_source_match_id: null, home_source_outcome: "W", away_source_match_id: null, away_source_outcome: "W" },
    ]);
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
  const { data: src } = await supabase
    .from("tournament_stages").select("*").eq("id", sourceStageId).single<StageRow>();
  if (!src) return null;

  // Prefer an explicit config edge on any later groups stage: config.from_stage_id === sourceStageId
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

/** Compute next free slot_id for a given (stage_id, group_id) in stage_slots */
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
