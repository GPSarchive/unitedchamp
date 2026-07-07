// src/app/lib/auditPlayerStats.ts
//
// Read-only drift audit + root-cause diagnosis.
//
// Recomputes every player-stats aggregate from the source of truth
// (match_player_stats) and diffs the result against what is stored in
// player_statistics, player_career_stats and player_tournament_stats.
//
// For every drifted row it then tries to attribute the drift to a concrete
// cause:
//   - missed_refresh : the missing amount is EXACTLY the contribution of
//                      specific matches that were saved after the aggregate
//                      was last written → the after-save refresh never ran
//                      (fire-and-forget progressAfterMatch cut off).
//   - truncation     : aggregate is undercounted but no missed match explains
//                      it → consistent with the >1000-row truncated reads in
//                      the inline sync / fix-stats tool.
//   - stale_data     : aggregate holds MORE than the match stats support →
//                      match stats were deleted/edited but the aggregate kept
//                      the old values.
//   - never_written  : the aggregate row does not exist at all.
//   - stale_row      : the aggregate row exists but no source stats remain.
//   - unexplained    : mixed over- and undercounts; needs a manual look.
//
// Never writes anything.

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

// PostgREST caps responses at ~1000 rows regardless of .limit(); paginate.
const PAGE = 500;

async function fetchAll<T>(table: string, select: string, orderCol = "id"): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .order(orderCol, { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

const n = (v: unknown) => Number(v) || 0;

// ── Public types ────────────────────────────────────────────────────────────

export type FieldDiff = { field: string; stored: number; recomputed: number };

export type Cause =
  | "missed_refresh"
  | "truncation"
  | "stale_data"
  | "never_written"
  | "stale_row"
  | "unexplained";

export type ImplicatedMatch = {
  matchId: number;
  date: string | null;
  /** e.g. "Ολυμπιακός 3–2 ΑΕΚ" */
  label: string;
  /** e.g. "2 goals, 1 assist, MVP" — this player's stats in that match */
  contribution: string;
};

export type Diagnosis = {
  cause: Cause;
  /** whether the implicated matches account for the drift EXACTLY */
  exact: boolean;
  matches: ImplicatedMatch[];
};

export type DriftRow = {
  playerName: string;
  playerId: number;
  tournamentId?: number;
  kind: "missing" | "stale" | "mismatch";
  diffs: FieldDiff[];
  diagnosis: Diagnosis;
};

export type TableAudit = {
  table: string;
  description: string;
  rowsChecked: number;
  drifted: DriftRow[];
};

export type AuditResult = {
  mpsRowCount: number;
  matchCount: number;
  tables: TableAudit[];
  totalDrifted: number;
  /** drift-row count per cause, across all tables */
  causeCounts: Record<Cause, number>;
  /** matches most often implicated in missed refreshes, worst first */
  hotMatches: { label: string; date: string | null; matchId: number; playersAffected: number }[];
};

// ── Internal types ──────────────────────────────────────────────────────────

type MpsRow = {
  player_id: number;
  match_id: number;
  team_id: number;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
  mvp: boolean | null;
  best_goalkeeper: boolean | null;
};

type MatchRow = {
  id: number;
  tournament_id: number | null;
  winner_team_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  match_date: string | null;
  updated_at: string | null;
};

type Bucket = Record<string, number>;

/** One player's stat line in one match, normalized to contribution units. */
type Contribution = {
  matchId: number;
  tournamentId: number | null;
  date: string | null;
  /** matches.updated_at — proxy for "when this match was last saved" */
  savedAt: number | null;
  units: Bucket; // matches, goals, assists, yellow, red, blue, mvp, gk, win
};

// Aggregate-table field → contribution unit
const FIELD_TO_UNIT: Record<string, string> = {
  total_matches: "matches",
  total_goals: "goals",
  total_assists: "assists",
  total_yellow_cards: "yellow",
  total_red_cards: "red",
  total_blue_cards: "blue",
  total_mvp: "mvp",
  total_best_gk: "gk",
  total_wins: "win",
  matches: "matches",
  goals: "goals",
  assists: "assists",
  yellow_cards: "yellow",
  red_cards: "red",
  blue_cards: "blue",
  mvp_count: "mvp",
  best_gk_count: "gk",
  wins: "win",
};

const UNIT_LABELS: Record<string, [string, string]> = {
  goals: ["goal", "goals"],
  assists: ["assist", "assists"],
  yellow: ["yellow card", "yellow cards"],
  red: ["red card", "red cards"],
  blue: ["blue card", "blue cards"],
  mvp: ["MVP", "MVP"],
  gk: ["Best GK", "Best GK"],
  win: ["win", "wins"],
};

function contributionText(units: Bucket): string {
  const parts: string[] = [];
  for (const [unit, [one, many]] of Object.entries(UNIT_LABELS)) {
    const v = n(units[unit]);
    if (v === 1) parts.push(unit === "mvp" || unit === "gk" ? one : `1 ${one}`);
    else if (v > 1) parts.push(`${v} ${many}`);
  }
  return parts.length ? parts.join(", ") : "played (no scoring stats)";
}

// ── Diagnosis ───────────────────────────────────────────────────────────────

/** Does `subset` account exactly for `delta` (recomputed − stored) on every field? */
function subsetExplainsDelta(subset: Contribution[], delta: Bucket, fields: string[]): boolean {
  for (const f of fields) {
    let sum = 0;
    for (const c of subset) sum += n(c.units[FIELD_TO_UNIT[f]]);
    if (sum !== n(delta[f])) return false;
  }
  return true;
}

function toImplicated(c: Contribution, matchLabel: (id: number) => string): ImplicatedMatch {
  return {
    matchId: c.matchId,
    date: c.date,
    label: matchLabel(c.matchId),
    contribution: contributionText(c.units),
  };
}

/**
 * Attribute a mismatch to a cause.
 * `contribs` = the player's per-match stat lines relevant to this aggregate
 * (all matches for career/legacy, tournament-filtered otherwise), newest first.
 * `aggUpdatedAt` = when the aggregate row was last written (null if unreliable).
 */
function diagnoseMismatch(
  delta: Bucket,
  fields: string[],
  contribs: Contribution[],
  aggUpdatedAt: number | null,
  matchLabel: (id: number) => string,
): Diagnosis {
  const deltas = fields.map((f) => n(delta[f]));
  const allNonNegative = deltas.every((d) => d >= 0);
  const allNonPositive = deltas.every((d) => d <= 0);

  // 1. Strongest evidence: matches saved AFTER the aggregate was last written,
  //    whose combined stats equal the missing amount exactly.
  if (aggUpdatedAt != null && allNonNegative) {
    const suspects = contribs.filter((c) => c.savedAt != null && c.savedAt > aggUpdatedAt);
    if (suspects.length && subsetExplainsDelta(suspects, delta, fields)) {
      return { cause: "missed_refresh", exact: true, matches: suspects.map((c) => toImplicated(c, matchLabel)) };
    }
  }

  // 2. Fallback: do the newest k matches account for the delta exactly?
  //    (covers tables whose updated_at is not maintained)
  if (allNonNegative) {
    for (let k = 1; k <= Math.min(contribs.length, 25); k++) {
      const prefix = contribs.slice(0, k);
      if (subsetExplainsDelta(prefix, delta, fields)) {
        return { cause: "missed_refresh", exact: true, matches: prefix.map((c) => toImplicated(c, matchLabel)) };
      }
    }
  }

  // 3. Pure undercount with no set of matches explaining it → truncated read.
  if (allNonNegative) {
    // Still surface the matches saved after the last refresh as leads, if any.
    const suspects =
      aggUpdatedAt != null
        ? contribs.filter((c) => c.savedAt != null && c.savedAt > aggUpdatedAt)
        : [];
    return { cause: "truncation", exact: false, matches: suspects.map((c) => toImplicated(c, matchLabel)) };
  }

  // 4. Aggregate holds more than the source supports → deleted/edited stats
  //    that were never propagated (or a corrupted fix-stats run).
  if (allNonPositive) {
    return { cause: "stale_data", exact: false, matches: [] };
  }

  return { cause: "unexplained", exact: false, matches: [] };
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function auditPlayerStats(): Promise<AuditResult> {
  // 1. Source of truth
  const mps = await fetchAll<MpsRow>(
    "match_player_stats",
    "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper",
  );
  const matches = await fetchAll<MatchRow>(
    "matches",
    "id, tournament_id, winner_team_id, team_a_id, team_b_id, team_a_score, team_b_score, match_date, updated_at",
  );
  const players = await fetchAll<{ id: number; first_name: string | null; last_name: string | null }>(
    "player",
    "id, first_name, last_name",
  );
  const teams = await fetchAll<{ id: number; name: string | null }>("teams", "id, name");

  const matchInfo = new Map(matches.map((m) => [m.id, m]));
  const teamName = new Map(teams.map((t) => [t.id, t.name ?? `team ${t.id}`]));
  const nameOf = new Map(
    players.map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `#${p.id}`]),
  );

  const matchLabel = (id: number): string => {
    const m = matchInfo.get(id);
    if (!m) return `match #${id}`;
    const a = m.team_a_id != null ? teamName.get(m.team_a_id) ?? "?" : "?";
    const b = m.team_b_id != null ? teamName.get(m.team_b_id) ?? "?" : "?";
    const score =
      m.team_a_score != null && m.team_b_score != null ? ` ${m.team_a_score}–${m.team_b_score} ` : " vs ";
    return `${a}${score}${b}`;
  };

  // 2. Recompute aggregates + collect per-player match contributions
  const legacy = new Map<string, Bucket>();
  const career = new Map<string, Bucket>();
  const tourney = new Map<string, Bucket>();
  const careerMatches = new Map<string, Set<number>>();
  const tourneyMatches = new Map<string, Set<number>>();
  const contribsByPlayer = new Map<number, Contribution[]>();

  for (const r of mps) {
    const pid = String(r.player_id);
    const mi = matchInfo.get(r.match_id);
    const win = mi?.winner_team_id != null && mi.winner_team_id === r.team_id ? 1 : 0;

    // per-match contribution line (used for diagnosis)
    if (!contribsByPlayer.has(r.player_id)) contribsByPlayer.set(r.player_id, []);
    contribsByPlayer.get(r.player_id)!.push({
      matchId: r.match_id,
      tournamentId: mi?.tournament_id ?? null,
      date: mi?.match_date ?? null,
      savedAt: mi?.updated_at ? Date.parse(mi.updated_at) : null,
      units: {
        matches: 1,
        goals: n(r.goals),
        assists: n(r.assists),
        yellow: n(r.yellow_cards),
        red: n(r.red_cards),
        blue: n(r.blue_cards),
        mvp: r.mvp ? 1 : 0,
        gk: r.best_goalkeeper ? 1 : 0,
        win,
      },
    });

    // legacy player_statistics (all rows — mirrors the app's inline sync)
    if (!legacy.has(pid))
      legacy.set(pid, { total_goals: 0, total_assists: 0, yellow_cards: 0, red_cards: 0, blue_cards: 0 });
    const L = legacy.get(pid)!;
    L.total_goals += n(r.goals);
    L.total_assists += n(r.assists);
    L.yellow_cards += n(r.yellow_cards);
    L.red_cards += n(r.red_cards);
    L.blue_cards += n(r.blue_cards);

    // career
    if (!career.has(pid))
      career.set(pid, {
        total_matches: 0, total_goals: 0, total_assists: 0, total_yellow_cards: 0,
        total_red_cards: 0, total_blue_cards: 0, total_mvp: 0, total_best_gk: 0, total_wins: 0,
      });
    const C = career.get(pid)!;
    C.total_goals += n(r.goals);
    C.total_assists += n(r.assists);
    C.total_yellow_cards += n(r.yellow_cards);
    C.total_red_cards += n(r.red_cards);
    C.total_blue_cards += n(r.blue_cards);
    C.total_mvp += r.mvp ? 1 : 0;
    C.total_best_gk += r.best_goalkeeper ? 1 : 0;
    C.total_wins += win;
    if (!careerMatches.has(pid)) careerMatches.set(pid, new Set());
    careerMatches.get(pid)!.add(r.match_id);

    // per-tournament
    if (mi?.tournament_id) {
      const key = `${pid}:${mi.tournament_id}`;
      if (!tourney.has(key))
        tourney.set(key, {
          matches: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0,
          blue_cards: 0, mvp_count: 0, best_gk_count: 0, wins: 0,
        });
      const T = tourney.get(key)!;
      T.goals += n(r.goals);
      T.assists += n(r.assists);
      T.yellow_cards += n(r.yellow_cards);
      T.red_cards += n(r.red_cards);
      T.blue_cards += n(r.blue_cards);
      T.mvp_count += r.mvp ? 1 : 0;
      T.best_gk_count += r.best_goalkeeper ? 1 : 0;
      T.wins += win;
      if (!tourneyMatches.has(key)) tourneyMatches.set(key, new Set());
      tourneyMatches.get(key)!.add(r.match_id);
    }
  }
  for (const [pid, s] of career) s.total_matches = careerMatches.get(pid)?.size ?? 0;
  for (const [key, s] of tourney) s.matches = tourneyMatches.get(key)?.size ?? 0;

  // newest first, for the "last k saves missing" heuristic
  for (const list of contribsByPlayer.values()) {
    list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }

  // 3. Load stored aggregates (with updated_at where it is maintained)
  const legacyRows = await fetchAll<Record<string, unknown>>(
    "player_statistics",
    "player_id, total_goals, total_assists, yellow_cards, red_cards, blue_cards",
    "player_id",
  );
  const careerRows = await fetchAll<Record<string, unknown>>(
    "player_career_stats",
    "player_id, total_matches, total_goals, total_assists, total_yellow_cards, total_red_cards, total_blue_cards, total_mvp, total_best_gk, total_wins, updated_at",
    "player_id",
  );
  const tourneyRows = await fetchAll<Record<string, unknown>>(
    "player_tournament_stats",
    "player_id, tournament_id, matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins, updated_at",
    "player_id",
  );

  // 4. Diff + diagnose one table
  function auditTable(opts: {
    table: string;
    description: string;
    storedRows: Record<string, unknown>[];
    keyOf: (r: Record<string, unknown>) => string;
    expected: Map<string, Bucket>;
    fields: string[];
    /** player's contributions relevant to this aggregate row */
    contribsFor: (playerId: number, tournamentId: number | null) => Contribution[];
    /** updated_at is only trustworthy where the writer maintains it */
    useUpdatedAt: boolean;
    withTournament?: boolean;
  }): TableAudit {
    const stored = new Map(opts.storedRows.map((r) => [opts.keyOf(r), r]));
    const allKeys = new Set([...stored.keys(), ...opts.expected.keys()]);
    const drifted: DriftRow[] = [];

    for (const key of allKeys) {
      const cur = stored.get(key);
      const exp = opts.expected.get(key);
      const diffs: FieldDiff[] = [];
      const delta: Bucket = {};
      for (const f of opts.fields) {
        const a = n(cur?.[f]);
        const b = n(exp?.[f]);
        delta[f] = b - a;
        if (a !== b) diffs.push({ field: f, stored: a, recomputed: b });
      }
      if (!diffs.length) continue;

      const [pidStr, tidStr] = key.split(":");
      const playerId = Number(pidStr);
      const tournamentId = opts.withTournament ? Number(tidStr) : null;
      const contribs = opts.contribsFor(playerId, tournamentId);

      let kind: DriftRow["kind"];
      let diagnosis: Diagnosis;
      if (!cur) {
        kind = "missing";
        diagnosis = {
          cause: "never_written",
          exact: true,
          matches: contribs.map((c) => toImplicated(c, matchLabel)),
        };
      } else if (!exp) {
        kind = "stale";
        diagnosis = { cause: "stale_row", exact: true, matches: [] };
      } else {
        kind = "mismatch";
        const aggUpdatedAt =
          opts.useUpdatedAt && typeof cur.updated_at === "string" ? Date.parse(cur.updated_at) : null;
        diagnosis = diagnoseMismatch(delta, opts.fields, contribs, aggUpdatedAt, matchLabel);
      }

      drifted.push({
        playerName: nameOf.get(playerId) ?? `#${playerId}`,
        playerId,
        ...(opts.withTournament ? { tournamentId: tournamentId! } : {}),
        kind,
        diffs,
        diagnosis,
      });
    }

    drifted.sort((a, b) => a.playerName.localeCompare(b.playerName, "el"));
    return { table: opts.table, description: opts.description, rowsChecked: allKeys.size, drifted };
  }

  const tables: TableAudit[] = [
    auditTable({
      table: "player_statistics",
      description: "Legacy totals — synced inline on every match save",
      storedRows: legacyRows,
      keyOf: (r) => String(r.player_id),
      expected: legacy,
      fields: ["total_goals", "total_assists", "yellow_cards", "red_cards", "blue_cards"],
      contribsFor: (pid) => contribsByPlayer.get(pid) ?? [],
      useUpdatedAt: false, // upserts don't maintain updated_at here
    }),
    auditTable({
      table: "player_career_stats",
      description: "All-time cache — feeds /paiktes and the home top players",
      storedRows: careerRows,
      keyOf: (r) => String(r.player_id),
      expected: career,
      fields: [
        "total_matches", "total_goals", "total_assists", "total_yellow_cards",
        "total_red_cards", "total_blue_cards", "total_mvp", "total_best_gk", "total_wins",
      ],
      contribsFor: (pid) => contribsByPlayer.get(pid) ?? [],
      useUpdatedAt: true,
    }),
    auditTable({
      table: "player_tournament_stats",
      description: "Per-tournament cache",
      storedRows: tourneyRows,
      keyOf: (r) => `${r.player_id}:${r.tournament_id}`,
      expected: tourney,
      fields: [
        "matches", "goals", "assists", "yellow_cards", "red_cards",
        "blue_cards", "mvp_count", "best_gk_count", "wins",
      ],
      contribsFor: (pid, tid) =>
        (contribsByPlayer.get(pid) ?? []).filter((c) => c.tournamentId === tid),
      useUpdatedAt: true,
      withTournament: true,
    }),
  ];

  // 5. Global rollups: cause counts + matches implicated most often
  const causeCounts: Record<Cause, number> = {
    missed_refresh: 0, truncation: 0, stale_data: 0,
    never_written: 0, stale_row: 0, unexplained: 0,
  };
  const hot = new Map<number, { label: string; date: string | null; players: Set<number> }>();

  for (const t of tables) {
    for (const d of t.drifted) {
      causeCounts[d.diagnosis.cause]++;
      if (d.diagnosis.cause === "missed_refresh") {
        for (const m of d.diagnosis.matches) {
          if (!hot.has(m.matchId)) hot.set(m.matchId, { label: m.label, date: m.date, players: new Set() });
          hot.get(m.matchId)!.players.add(d.playerId);
        }
      }
    }
  }

  const hotMatches = [...hot.entries()]
    .map(([matchId, h]) => ({ matchId, label: h.label, date: h.date, playersAffected: h.players.size }))
    .sort((a, b) => b.playersAffected - a.playersAffected)
    .slice(0, 15);

  return {
    mpsRowCount: mps.length,
    matchCount: new Set(mps.map((r) => r.match_id)).size,
    tables,
    totalDrifted: tables.reduce((sum, t) => sum + t.drifted.length, 0),
    causeCounts,
    hotMatches,
  };
}
