// src/app/lib/auditPlayerStats.ts
//
// Read-only drift audit: recomputes every player-stats aggregate from the
// source of truth (match_player_stats) and diffs the result against what is
// stored in player_statistics, player_career_stats and player_tournament_stats.
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

export type FieldDiff = { field: string; stored: number; recomputed: number };

export type DriftRow = {
  /** e.g. "Γιώργος Παπαδόπουλος" */
  playerName: string;
  playerId: number;
  /** set only for player_tournament_stats rows */
  tournamentId?: number;
  /** "missing" = aggregate row never written; "stale" = no source stats remain; "mismatch" = values differ */
  kind: "missing" | "stale" | "mismatch";
  diffs: FieldDiff[];
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
};

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

type Bucket = Record<string, number>;

function diffTable(
  storedRows: Record<string, unknown>[],
  keyOf: (r: Record<string, unknown>) => string,
  expected: Map<string, Bucket>,
  fields: string[],
): { key: string; kind: DriftRow["kind"]; diffs: FieldDiff[] }[] {
  const stored = new Map(storedRows.map((r) => [keyOf(r), r]));
  const allKeys = new Set([...stored.keys(), ...expected.keys()]);
  const out: { key: string; kind: DriftRow["kind"]; diffs: FieldDiff[] }[] = [];
  for (const key of allKeys) {
    const cur = stored.get(key);
    const exp = expected.get(key);
    const diffs: FieldDiff[] = [];
    for (const f of fields) {
      const a = n(cur?.[f]);
      const b = n(exp?.[f]);
      if (a !== b) diffs.push({ field: f, stored: a, recomputed: b });
    }
    if (diffs.length) {
      out.push({ key, kind: !cur ? "missing" : !exp ? "stale" : "mismatch", diffs });
    }
  }
  return out;
}

export async function auditPlayerStats(): Promise<AuditResult> {
  // ── 1. Source of truth ────────────────────────────────────────────────
  const mps = await fetchAll<MpsRow>(
    "match_player_stats",
    "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper",
  );
  const matches = await fetchAll<{ id: number; tournament_id: number | null; winner_team_id: number | null }>(
    "matches",
    "id, tournament_id, winner_team_id",
  );
  const players = await fetchAll<{ id: number; first_name: string | null; last_name: string | null }>(
    "player",
    "id, first_name, last_name",
  );

  const matchInfo = new Map(matches.map((m) => [m.id, m]));
  const nameOf = new Map(
    players.map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `#${p.id}`]),
  );

  // ── 2. Recompute all three aggregates ────────────────────────────────
  const legacy = new Map<string, Bucket>();
  const career = new Map<string, Bucket>();
  const tourney = new Map<string, Bucket>();
  const careerMatches = new Map<string, Set<number>>();
  const tourneyMatches = new Map<string, Set<number>>();

  for (const r of mps) {
    const pid = String(r.player_id);
    const mi = matchInfo.get(r.match_id);

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
    if (r.mvp) C.total_mvp += 1;
    if (r.best_goalkeeper) C.total_best_gk += 1;
    if (mi?.winner_team_id != null && mi.winner_team_id === r.team_id) C.total_wins += 1;
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
      if (r.mvp) T.mvp_count += 1;
      if (r.best_goalkeeper) T.best_gk_count += 1;
      if (mi.winner_team_id != null && mi.winner_team_id === r.team_id) T.wins += 1;
      if (!tourneyMatches.has(key)) tourneyMatches.set(key, new Set());
      tourneyMatches.get(key)!.add(r.match_id);
    }
  }
  for (const [pid, s] of career) s.total_matches = careerMatches.get(pid)?.size ?? 0;
  for (const [key, s] of tourney) s.matches = tourneyMatches.get(key)?.size ?? 0;

  // ── 3. Load stored aggregates and diff ───────────────────────────────
  const legacyRows = await fetchAll<Record<string, unknown>>(
    "player_statistics",
    "player_id, total_goals, total_assists, yellow_cards, red_cards, blue_cards",
    "player_id",
  );
  const careerRows = await fetchAll<Record<string, unknown>>(
    "player_career_stats",
    "player_id, total_matches, total_goals, total_assists, total_yellow_cards, total_red_cards, total_blue_cards, total_mvp, total_best_gk, total_wins",
    "player_id",
  );
  const tourneyRows = await fetchAll<Record<string, unknown>>(
    "player_tournament_stats",
    "player_id, tournament_id, matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins",
    "player_id",
  );

  const toDrift = (
    raw: { key: string; kind: DriftRow["kind"]; diffs: FieldDiff[] }[],
    withTournament = false,
  ): DriftRow[] =>
    raw
      .map((d) => {
        const [pidStr, tidStr] = d.key.split(":");
        const pid = Number(pidStr);
        return {
          playerName: nameOf.get(pid) ?? `#${pid}`,
          playerId: pid,
          ...(withTournament ? { tournamentId: Number(tidStr) } : {}),
          kind: d.kind,
          diffs: d.diffs,
        };
      })
      .sort((a, b) => a.playerName.localeCompare(b.playerName, "el"));

  const tables: TableAudit[] = [
    {
      table: "player_statistics",
      description: "Legacy totals — synced inline on every match save",
      rowsChecked: new Set([...legacyRows.map((r) => String(r.player_id)), ...legacy.keys()]).size,
      drifted: toDrift(
        diffTable(legacyRows, (r) => String(r.player_id), legacy, [
          "total_goals", "total_assists", "yellow_cards", "red_cards", "blue_cards",
        ]),
      ),
    },
    {
      table: "player_career_stats",
      description: "All-time cache — feeds /paiktes and the home top players",
      rowsChecked: new Set([...careerRows.map((r) => String(r.player_id)), ...career.keys()]).size,
      drifted: toDrift(
        diffTable(careerRows, (r) => String(r.player_id), career, [
          "total_matches", "total_goals", "total_assists", "total_yellow_cards",
          "total_red_cards", "total_blue_cards", "total_mvp", "total_best_gk", "total_wins",
        ]),
      ),
    },
    {
      table: "player_tournament_stats",
      description: "Per-tournament cache",
      rowsChecked: new Set([
        ...tourneyRows.map((r) => `${r.player_id}:${r.tournament_id}`),
        ...tourney.keys(),
      ]).size,
      drifted: toDrift(
        diffTable(tourneyRows, (r) => `${r.player_id}:${r.tournament_id}`, tourney, [
          "matches", "goals", "assists", "yellow_cards", "red_cards",
          "blue_cards", "mvp_count", "best_gk_count", "wins",
        ]),
        true,
      ),
    },
  ];

  return {
    mpsRowCount: mps.length,
    matchCount: new Set(mps.map((r) => r.match_id)).size,
    tables,
    totalDrifted: tables.reduce((sum, t) => sum + t.drifted.length, 0),
  };
}
