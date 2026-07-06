// app/dashboard/tournaments/TournamentCURD/progression.ts
//
// Server-only progression engine. Deliberately NOT a "use server" module:
// these functions run with the service-role key (RLS bypassed) and perform no
// auth checks of their own, so they must never be compiled into publicly
// invokable Server Action endpoints. Auth lives in the API routes / server
// actions that call into this module.
import "server-only";

import { supabaseAdmin as supabase } from "@/app/lib/supabase/supabaseAdmin";
import { refreshStatsForMatch } from "@/app/lib/refreshPlayerStats";
import { nextPow2, seedOrder, roundRobinRounds } from "./util/functions/common";
import { decideTwoLeggedTie, type TieResolution } from "./util/functions/twoLeggedTie";

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
  // two-legged KO
  leg: number | null;
  tie_leg1_match_id: Id | null;
  penalty_a: number | null;
  penalty_b: number | null;
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

/**
 * Throw with context when a query the cascade depends on fails. Without this,
 * a transient DB/network error reads as a business state ("no standings",
 * "no children") and the cascade silently does the wrong thing.
 */
function must(error: { message?: string } | null, ctx: string): void {
  if (error) throw new Error(`[progression] ${ctx}: ${error.message ?? "unknown error"}`);
}

/** Postgres unique_violation — benign for idempotent "ensure exists" inserts. */
const UNIQUE_VIOLATION = "23505";

async function hasStandings(stageId: Id): Promise<boolean> {
  const { data, error } = await supabase
    .from("stage_standings")
    .select("stage_id")
    .eq("stage_id", stageId)
    .limit(1);
  must(error, `checking standings for stage ${stageId}`);
  return !!(data && data.length);
}

async function getStage(stageId: Id): Promise<StageRow | null> {
  const { data, error } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("id", stageId)
    .maybeSingle<StageRow>();
  must(error, `loading stage ${stageId}`);
  return data ?? null;
}

async function listGroups(stageId: Id): Promise<GroupRow[]> {
  const { data, error } = await supabase
    .from("tournament_groups")
    .select("*")
    .eq("stage_id", stageId)
    .order("ordering", { ascending: true });
  must(error, `listing groups for stage ${stageId}`);
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
    const { data, error } = await supabase
      .from("tournament_teams")
      .select("team_id, group_id")
      .eq("stage_id", stage.id);
    must(error, `listing participants for groups stage ${stage.id}`);
    return (data ?? []) as any;
  }

  // league (dedupe to be safe)
  const { data, error } = await supabase
    .from("tournament_teams")
    .select("team_id")
    .eq("tournament_id", stage.tournament_id)
    .is("stage_id", null);
  must(error, `listing participants for league stage ${stage.id}`);
  const rows = (data ?? []) as Array<{ team_id: Id }>;
  const uniq = Array.from(new Set(rows.map((r) => r.team_id)));
  return uniq.map((team_id) => ({ team_id, group_id: null }));
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
    if (error) {
      console.error("[progression] baseline standings insert failed:", error.message);
      return false;
    }
    return true;
  }
  return false;
}

/* =========================================================
   Two-legged KO resolution
   (pure helpers live in ./util/functions/twoLeggedTie — a "use server" module
    may only export async Server Actions, so they cannot be defined here)
   ========================================================= */

/** Server-side resolution that loads leg 1 from the DB for a finished leg-2 row. */
async function resolveTwoLeggedTie(leg2: MatchRow): Promise<TieResolution> {
  // leg null, or leg 1 deleted (tie link cleared by ON DELETE SET NULL) → single-match logic
  if (leg2.leg !== 2 || leg2.tie_leg1_match_id == null) return { kind: "single" };

  const { data: leg1, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", leg2.tie_leg1_match_id)
    .maybeSingle<MatchRow>();

  if (error || !leg1) return { kind: "single" }; // leg 1 vanished → fall back
  if (leg1.status !== "finished") return { kind: "pending" };

  return decideTwoLeggedTie(leg2, leg1);
}

/**
 * Insert KO match rows for a stage, optionally expanding each into two legs.
 *
 * Single-leg (doubleRound=false): inserts rows unchanged.
 * Two-legged (doubleRound=true): for each row emit leg 1 (as-is) + leg 2
 * (teams + source pointers swapped), insert all, then link each leg-2 row's
 * tie_leg1_match_id back to its leg-1 sibling. Children reference parents by
 * (round, bracket_pos); only the leg-2 decider propagates (see applyKnockoutPropagation),
 * so source pointers are simply carried on both legs.
 */
async function insertKnockoutRowsWithLegs(
  doubleRound: boolean,
  rows: Partial<MatchRow>[]
) {
  if (!rows.length) return;

  if (!doubleRound) {
    const { error } = await supabase.from("matches").insert(rows as any);
    must(error, "inserting KO matches");
    return;
  }

  // Build paired legs; remember which output indices are (leg1, leg2) per tie.
  const expanded: Partial<MatchRow>[] = [];
  const pairs: { leg1: number; leg2: number }[] = [];

  for (const row of rows) {
    const leg1: Partial<MatchRow> = { ...row, leg: 1 };
    const leg2: Partial<MatchRow> = {
      ...row,
      leg: 2,
      team_a_id: row.team_b_id ?? null,
      team_b_id: row.team_a_id ?? null,
      home_source_round: row.away_source_round ?? null,
      home_source_bracket_pos: row.away_source_bracket_pos ?? null,
      away_source_round: row.home_source_round ?? null,
      away_source_bracket_pos: row.home_source_bracket_pos ?? null,
    };
    const i1 = expanded.push(leg1) - 1;
    const i2 = expanded.push(leg2) - 1;
    pairs.push({ leg1: i1, leg2: i2 });
  }

  const { data: inserted, error } = await supabase
    .from("matches")
    .insert(expanded as any)
    .select("id");
  if (error || !inserted) throw new Error(error?.message || "Failed to insert KO legs");

  // Link each leg-2 row back to its leg-1 sibling. If a link write fails we
  // throw: an unlinked leg-2 row silently degrades to single-match logic, which
  // would decide the tie from one leg only.
  const idByIdx = (inserted as { id: Id }[]).map((r) => r.id);
  for (const { leg1, leg2 } of pairs) {
    const leg2Id = idByIdx[leg2];
    const leg1Id = idByIdx[leg1];
    if (leg2Id == null || leg1Id == null) {
      throw new Error("[progression] KO leg insert returned fewer ids than rows");
    }
    const { error: linkErr } = await supabase
      .from("matches")
      .update({ tie_leg1_match_id: leg1Id })
      .eq("id", leg2Id);
    must(linkErr, `linking KO leg 2 (match ${leg2Id}) to its leg 1 (match ${leg1Id})`);
  }
}

/* =========================================================
   Public APIs
   ========================================================= */

/** Entry point the PATCH route calls after a match becomes 'finished' */
export async function progressAfterMatch(matchId: Id) {
  const { data: m, error: mErr } = await supabase
    .from("matches").select("*").eq("id", matchId).single<MatchRow>();
  if (mErr || !m) throw new Error(mErr?.message || "Match not found");
  if (m.status !== "finished") return { ok: true, skipped: "not finished" };

  // Groups stages touched by KO→Groups intake; hydrated once at the end.
  const touchedGroupsStages = new Set<Id>();

  // 1) KO-only work: propagation, then intake mapping creation + application.
  //    (Non-KO matches have no (round, bracket_pos), so intake no-ops for them.)
  if (m.stage_id) {
    const st = await getStage(m.stage_id);
    if (st?.kind === "knockout") {
      await runKnockoutPostFinish(m, touchedGroupsStages);

      // 1b) Two-legged KO: if THIS was leg 1, its leg-2 decider may already be
      // finished (legs entered out of order). Re-run the decider's full
      // post-finish steps — propagation AND intake — so the tie resolves and
      // its winner/loser reach any next groups stage now that both legs exist.
      if (m.leg === 1) {
        const { data: leg2, error: leg2Err } = await supabase
          .from("matches")
          .select("*")
          .eq("tie_leg1_match_id", m.id)
          .eq("status", "finished")
          .maybeSingle<MatchRow>();
        must(leg2Err, `loading leg-2 decider for leg-1 match ${m.id}`);
        if (leg2) await runKnockoutPostFinish(leg2, touchedGroupsStages);
      }
    } else {
      // Non-KO stages never auto-create intake mappings, but a manually
      // configured mapping from this stage's coords still applies (legacy
      // behaviour: intake ran for every finished match).
      for (const gid of await applyIntakeMappings(m)) touchedGroupsStages.add(gid);
    }
  }

  // 2) Hydrate every groups stage that received intake
  for (const gid of touchedGroupsStages) {
    await applyGroupIntakeToMatches(gid);
  }

  // 3) Recompute standings for groups/league stages
  if (m.stage_id) await recomputeStandingsIfNeeded(m.stage_id);

  // 4) If a groups/league stage is now fully finished, seed next KO (if configured)
  if (m.stage_id) {
    await seedNextKnockoutFromGroupsIfConfigured(m.stage_id);
    await seedNextKnockoutFromLeagueIfConfigured(m.stage_id);
  }

  // 5) Tournament completion (all matches finished)
  if (m.tournament_id) await maybeCompleteTournament(m.tournament_id);

  // 6) Refresh pre-computed player stats cache
  await refreshStatsForMatch(matchId).catch((err) =>
    console.error("[progressAfterMatch] refreshStatsForMatch error:", err)
  );

  return { ok: true };
}

/** Public helper so the reseed API can force a standings snapshot right now */
export async function recomputeStandingsNow(stageId: Id) {
  await recomputeStandingsIfNeeded(stageId);
}

/* =========================================================
   Internals
   ========================================================= */

/**
 * Everything that must happen for a FINISHED KO match:
 *  1) resolve two-legged tie + stamp winner, propagate W/L to child matches
 *  2) ensure + apply KO→Groups intake mappings using the UP-TO-DATE row.
 *
 * Step 2 must see the row returned by propagation: for a two-legged decider the
 * winner is stamped *inside* applyKnockoutPropagation, so using the row that
 * was read at the start of progressAfterMatch would apply intake with a stale
 * null winner and silently skip the slot write.
 */
async function runKnockoutPostFinish(m: MatchRow, touchedGroupsStages: Set<Id>): Promise<void> {
  const fresh = await applyKnockoutPropagation(m);
  await ensureIntakeMappingsForFinishedMatch(fresh);
  for (const gid of await applyIntakeMappings(fresh)) touchedGroupsStages.add(gid);
}

/** Propagate W/L to KO child matches within the same stage.
 *  Returns the match row including any winner/penalty fields stamped here. */
async function applyKnockoutPropagation(m: MatchRow): Promise<MatchRow> {
  if (!m.stage_id) return m;

  // Only propagate inside KO stages
  const stage = await getStage(m.stage_id);
  if (!stage || stage.kind !== "knockout") return m;

  // KO propagation only makes sense when the source match has stable coords
  if (m.round == null || m.bracket_pos == null) return m;

  // ----- Two-legged KO handling -----
  // Leg 1 never propagates on its own — the tie is decided when leg 2 finishes.
  if (m.leg === 1) return m;

  // Leg 2 (decider): resolve leg wins (+penalties when level) and stamp the tie
  // winner onto this row before propagating. Single-leg rows (leg null, or leg 1
  // deleted) skip this.
  if (m.leg === 2 && m.tie_leg1_match_id != null) {
    const res = await resolveTwoLeggedTie(m);
    if (res.kind === "pending" || res.kind === "undecided") return m; // not decided yet
    if (res.kind === "decided") {
      // When the tie was decided on leg wins, any stored penalties are stray and
      // must be cleared (mirrors the score-write paths). Penalties only persist
      // when they were the decider. Re-stamp the winner if it changed.
      const clearStrayPens = res.via === "wins" && (m.penalty_a != null || m.penalty_b != null);
      const winnerChanged = m.winner_team_id !== res.winnerTeamId;
      if (winnerChanged || clearStrayPens) {
        const patch: Partial<MatchRow> = { winner_team_id: res.winnerTeamId };
        if (clearStrayPens) {
          patch.penalty_a = null;
          patch.penalty_b = null;
        }
        const { error: stampErr } = await supabase.from("matches").update(patch).eq("id", m.id);
        must(stampErr, `stamping tie winner on decider match ${m.id}`);
        m = { ...m, ...patch };
      }
    }
  }

  // Pull children in same stage; filter in code to support BOTH id + stable pointers.
  const { data: allChildren, error } = await supabase
    .from("matches")
    .select("*")
    .eq("stage_id", m.stage_id);
  must(error, `reading KO children in stage ${m.stage_id}`);
  if (!allChildren) return m;

  // A non-null source_match_id is authoritative; stable (round, bracket_pos)
  // pointers are only a fallback for rows whose id link was never set (or was
  // cleared when the source match got deleted/recreated). Without this
  // precedence, a stale id and a stable pointer can name DIFFERENT parents and
  // whichever finishes first would fill the slot.
  const feedsFrom = (
    srcId: Id | null,
    srcRound: number | null,
    srcPos: number | null
  ) =>
    srcId != null
      ? srcId === m.id
      : srcRound === m.round && srcPos === m.bracket_pos;

  const feedsHomeOf = (child: MatchRow) =>
    feedsFrom(child.home_source_match_id, child.home_source_round, child.home_source_bracket_pos);
  const feedsAwayOf = (child: MatchRow) =>
    feedsFrom(child.away_source_match_id, child.away_source_round, child.away_source_bracket_pos);

  const children = (allChildren as MatchRow[]).filter(
    (child) => feedsHomeOf(child) || feedsAwayOf(child)
  );

  // Winner / loser from source match (null if not decided)
  const W = m.winner_team_id ?? null;
  const L =
    m.winner_team_id != null
      ? (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id) ?? null
      : null;

  for (const child of children) {
    const patch: Partial<MatchRow> = {};
    const childFinished = child.status === "finished";

    const feedsHome = feedsHomeOf(child);
    const feedsAway = feedsAwayOf(child);

    // Default to single-elim "winner advances" if not specified
    const homeOutcome = (child.home_source_outcome ?? "W") as "W" | "L";
    const awayOutcome = (child.away_source_outcome ?? "W") as "W" | "L";

    // Conservative: only fill when the slot is currently NULL (respect manual edits),
    // and only if the child match isn't finished yet.
    if (!childFinished && feedsHome && child.team_a_id == null) {
      patch.team_a_id = homeOutcome === "L" ? L : W; // could be null if source undecided
    }
    if (!childFinished && feedsAway && child.team_b_id == null) {
      patch.team_b_id = awayOutcome === "L" ? L : W; // could be null if source undecided
    }

    if (Object.keys(patch).length > 0) {
      const { error: childErr } = await supabase.from("matches").update(patch).eq("id", child.id);
      must(childErr, `advancing team into KO child match ${child.id}`);
    }
  }

  return m;
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
  const { data: existing, error: existErr } = await supabase
    .from("intake_mappings")
    .select("id")
    .eq("from_stage_id", m.stage_id)
    .eq("round", m.round)
    .eq("bracket_pos", m.bracket_pos)
    .limit(1);
  must(existErr, `checking intake mappings for match ${m.id}`);
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
    // Concurrent finishes can race the check-then-insert above; with the unique
    // index from migrations/add-progression-integrity.sql the loser gets a
    // unique violation, which is the correct outcome — ignore it.
    const { error } = await supabase.from("intake_mappings").insert(inserts as any);
    if (error && (error as any).code !== UNIQUE_VIOLATION) {
      must(error, `creating intake mappings for match ${m.id}`);
    }
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

  must(mapsErr, `reading intake mappings for match ${m.id}`);
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
    must(upsertErr, `writing stage_slots intake for match ${m.id}`);
  }

  return Array.from(touchedStages);
}

/** Recompute standings for a groups/league stage (3-1-0) */
async function recomputeStandingsIfNeeded(stageId: Id) {
  const stage = await getStage(stageId);
  if (!stage) return;
  if (stage.kind === "knockout") return;

  // Pull all finished matches in this stage. A failed read MUST abort: treating
  // it as "no matches" would silently recompute every team's standings to zero.
  const { data: ms, error: msErr } = await supabase
    .from("matches")
    .select("*")
    .eq("stage_id", stageId)
    .eq("status", "finished");
  must(msErr, `reading finished matches for stage ${stageId}`);

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

  // If no matches are finished yet and we couldn't resolve participants, ensure a baseline
  const bucketKeys = new Set<number>([
    ...teamsByGroup.keys(),
    ...buckets.keys(),
  ]);
  if (bucketKeys.size === 0) {
    await ensureBaselineStandings(stageId);
    return;
  }

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

    // Apply disciplinary actions (point deductions/additions)
    // For league stages (gid=0), match NULL group_id in disciplinary_actions
    let disciplinaryQuery = supabase
      .from("disciplinary_actions")
      .select("team_id, points_adjustment")
      .eq("stage_id", stageId);

    if (gid === 0) {
      disciplinaryQuery = disciplinaryQuery.is("group_id", null);
    } else {
      disciplinaryQuery = disciplinaryQuery.eq("group_id", gid);
    }

    const { data: disciplinaryActions, error: daErr } = await disciplinaryQuery;
    must(daErr, `reading disciplinary actions for stage ${stageId} group ${gid}`);

    if (disciplinaryActions && disciplinaryActions.length > 0) {
      // Sum all adjustments per team
      const adjustmentsByTeam = new Map<number, number>();
      for (const action of disciplinaryActions) {
        const current = adjustmentsByTeam.get(action.team_id) || 0;
        adjustmentsByTeam.set(action.team_id, current + action.points_adjustment);
      }

      // Apply total adjustments
      for (const [team_id, totalAdjustment] of adjustmentsByTeam.entries()) {
        const teamStats = stats.get(team_id);
        if (teamStats) {
          teamStats.points = Math.max(0, teamStats.points + totalAdjustment);
        }
      }
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

    await replaceStandings(
      stageId,
      gid,
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

type StandingInsertRow = {
  stage_id: Id; group_id: number; team_id: Id;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number; rank: number;
};

/**
 * Replace one group's standings rows. Prefers the atomic
 * `replace_stage_standings` RPC (migrations/add-progression-integrity.sql);
 * falls back to delete-then-insert when the function isn't installed yet. The
 * fallback is NOT atomic — a crash between the two writes leaves the group's
 * standings empty until the next recompute — which is exactly why the RPC
 * exists. Both paths throw on failure so a broken write is never silent.
 */
async function replaceStandings(stageId: Id, groupId: number, rows: StandingInsertRow[]) {
  const { error: rpcErr } = await supabase.rpc("replace_stage_standings", {
    p_stage_id: stageId,
    p_group_id: groupId,
    p_rows: rows,
  });
  if (!rpcErr) return;

  // 42883 = Postgres undefined_function, PGRST202 = PostgREST unknown function
  const rpcMissing = (rpcErr as any).code === "42883" || (rpcErr as any).code === "PGRST202";
  if (!rpcMissing) {
    must(rpcErr, `replacing standings for stage ${stageId} group ${groupId}`);
  }

  const { error: delErr } = await supabase
    .from("stage_standings").delete().eq("stage_id", stageId).eq("group_id", groupId);
  must(delErr, `clearing standings for stage ${stageId} group ${groupId}`);
  if (rows.length) {
    const { error: insErr } = await supabase.from("stage_standings").insert(rows);
    must(insErr, `inserting standings for stage ${stageId} group ${groupId}`);
  }
}

/**
 * Shared preamble for seeding a later KO from a groups/league stage:
 * optionally require every source match finished, then make sure standings
 * rows exist (recompute from finished matches, else baseline ranked by seed).
 * Returns false when seeding cannot proceed.
 */
async function standingsReadyForSeeding(sourceStageId: Id, allowEarly: boolean): Promise<boolean> {
  if (!allowEarly) {
    const { data: all, error } = await supabase
      .from("matches").select("status").eq("stage_id", sourceStageId);
    must(error, `reading matches for source stage ${sourceStageId}`);
    const allFinished = (all ?? []).every((r: any) => r.status === "finished");
    if (!allFinished) return false;
  }

  await recomputeStandingsIfNeeded(sourceStageId);
  if (!(await hasStandings(sourceStageId))) {
    // no fixtures at all → baseline ranked by seed; without participants we can't seed
    return await ensureBaselineStandings(sourceStageId);
  }
  return true;
}

/**
 * Find the first later KO stage whose config points at `src` and verify it can
 * be (re)seeded. Never touches a KO that has started (finished match or winner
 * present); clears existing unstarted matches only when `reseed` is set.
 * Returns the target stage, or null when there is nothing to (re)seed.
 */
async function findSeedableNextKO(src: StageRow, reseed: boolean): Promise<StageRow | null> {
  const { data: laterStages, error } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("tournament_id", src.tournament_id)
    .gt("ordering", src.ordering)
    .order("ordering", { ascending: true });
  must(error, `reading stages after stage ${src.id}`);

  const nextKO = ((laterStages ?? []) as StageRow[]).find(
    (s) =>
      s.kind === "knockout" &&
      (s.config?.from_stage_id === src.id || s.config?.fromStageId === src.id)
  );
  if (!nextKO) return null;

  const { data: existingMatches, error: exErr } = await supabase
    .from("matches")
    .select("id,status,winner_team_id")
    .eq("stage_id", nextKO.id);
  must(exErr, `reading existing matches in KO stage ${nextKO.id}`);

  if (existingMatches && existingMatches.length > 0) {
    const hasFinished = existingMatches.some((m: any) => m.status === "finished" || m.winner_team_id != null);
    if (hasFinished) return null; // never reseed once KO started / winner exists
    if (!reseed) return null;     // keep idempotent by default unless caller asks to reseed
    const { error: delErr } = await supabase.from("matches").delete().eq("stage_id", nextKO.id);
    must(delErr, `clearing KO stage ${nextKO.id} for reseed`);
  }
  return nextKO;
}

/** If a GROUPS stage is fully finished and a later KO stage config points to it → seed KO */
export async function seedNextKnockoutFromGroupsIfConfigured(
  sourceStageId: Id,
  { reseed = false, allowEarly = true }: { reseed?: boolean; allowEarly?: boolean } = {}
) {
  const src = await getStage(sourceStageId);
  if (!src || src.kind !== "groups") return;

  if (!(await standingsReadyForSeeding(sourceStageId, allowEarly))) return;

  const nextKO = await findSeedableNextKO(src, reseed);
  if (!nextKO) return;

  // Config knobs
  const advancersPerGroup = Math.max(1, Number(nextKO.config?.advancers_per_group ?? 2));
  const semisCross: "A1-B2" | "A1-B1" = nextKO.config?.semis_cross === "A1-B1" ? "A1-B1" : "A1-B2";

  // Read CURRENT standings
  const { data: standings, error: stErr } = await supabase
    .from("stage_standings")
    .select("*")
    .eq("stage_id", sourceStageId);
  must(stErr, `reading standings for stage ${sourceStageId}`);
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

    await insertKnockoutRowsWithLegs(!!nextKO.config?.double_round_ko, inserts);
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
  await insertKnockoutRowsWithLegs(!!nextKO.config?.double_round_ko, inserts);
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

  if (!(await standingsReadyForSeeding(sourceStageId, allowEarly))) return;

  const nextKO = await findSeedableNextKO(src, reseed);
  if (!nextKO) return;

  // How many advance? prefer explicit total; fallback to bracket size; else 8.
  const advancersTotal = Math.max(
    2,
    Number(nextKO.config?.advancers_total ?? nextKO.config?.standalone_bracket_size ?? 8)
  );

  // Read CURRENT standings (league is single table)
  const { data: standings, error: stErr } = await supabase
    .from("stage_standings")
    .select("*")
    .eq("stage_id", sourceStageId);
  must(stErr, `reading standings for stage ${sourceStageId}`);
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
  await insertKnockoutRowsWithLegs(!!nextKO.config?.double_round_ko, inserts);
}

/** Tournament completion: mark tournaments.status='completed' if all its matches are finished */
async function maybeCompleteTournament(tournamentId: Id) {
  const { data: ms, error } = await supabase
    .from("matches").select("status").eq("tournament_id", tournamentId);
  must(error, `reading matches for tournament ${tournamentId}`);
  if (!ms || ms.length === 0) return;
  const done = ms.every((r: any) => r.status === "finished");
  if (done) {
    const { error: upErr } = await supabase
      .from("tournaments").update({ status: "completed" }).eq("id", tournamentId);
    must(upErr, `marking tournament ${tournamentId} completed`);
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
  // Prefer atomic RPC if available; fallback to simple scan if not
  try {
    const { data, error } = await supabase.rpc("alloc_stage_slot", {
      p_stage_id: stageId,
      p_group_idx: groupIdx,
    });
    if (!error && typeof data === "number") {
      return data as number;
    }
  } catch {
    // ignore and fallback
  }

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

  // 4) Determine repeats from stage config (support legacy/alt keys)
  const cfg = (stage.config ?? {}) as any;
  const repeatsRaw = Number(
    cfg.rounds_per_opponent ??
    cfg["αγώνες_ανά_αντίπαλο"] ??
    cfg["roundsPerOpponent"]
  );
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

    for (const { id, ...patch } of updates) {
      const { error: hydrateErr } = await supabase.from("matches").update(patch).eq("id", id);
      must(hydrateErr, `hydrating group match ${id} from intake slots`);
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
  const base = roundRobinRounds(teamIds);
  const rounds = base.length;
  const out = new Map<number, [number, number][]>();

  for (let rep = 1; rep <= Math.max(1, repeats); rep++) {
    // Even repeats flip home/away, matching the wizard's genRoundRobin
    const flip = rep % 2 === 0;
    for (let r = 0; r < rounds; r++) {
      const md = (rep - 1) * rounds + r + 1;
      out.set(
        md,
        base[r].map(([a, b]) => (flip ? [b, a] : [a, b]) as [number, number])
      );
    }
  }

  return out;
}

/* =========================================================
   Any-N knockout builder (server) — stable pointers
   ========================================================= */

/**
 * Build insert rows for a seeded knockout for any N (with byes).
 * - Computes next power-of-two P
 * - Seeds into standard bracket order for P
 * - R1: create only real-vs-real matches; byes advance the real seed to R2
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
