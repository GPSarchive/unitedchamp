// app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/newknockout/BracketCanvas.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import BracketEditor, { type NodeBox } from "./BracketEditor";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import type { TournamentState } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

/* ============================
   Local types
   ============================ */
type TeamsMap = Record<number | string, { name: string; logo?: string | null; seed?: number | null }>;
type Connection = [string, string]; // from → to
type NodeMeta = { round: number; bracket_pos: number };

type DbOverlay = Pick<
  DraftMatch,
  | "status"
  | "team_a_score"
  | "team_b_score"
  | "winner_team_id"
  | "home_source_round"
  | "home_source_bracket_pos"
  | "away_source_round"
  | "away_source_bracket_pos"
> & { db_id?: number | null };
type MergedMatch = DraftMatch & Partial<DbOverlay>;

/* ============================
   Shared fallbacks
   ============================ */
const EMPTY_OBJ = Object.freeze({}) as Record<string, never>;
const EMPTY_ARR = Object.freeze([]) as ReadonlyArray<never>;

/* ============================
   Stable store selectors
   ============================ */
const selSetKOTeams        = (s: TournamentState) => s.setKOTeams;
const selSetKOLink         = (s: TournamentState) => s.setKOLink;
const selSetKORoundPos     = (s: TournamentState) => s.setKORoundPos;
const selReindexKOPointers = (s: TournamentState) => s.reindexKOPointers;
const selUpdateMatches     = (s: TournamentState) => s.updateMatches;

const selStagesById        = (s: TournamentState) => (s.entities?.stagesById ?? EMPTY_OBJ) as Record<number, any>;
const selStageIdByIndex    = (s: TournamentState) => (s.ids?.stageIdByIndex ?? {}) as Record<number, number>;
const selTournamentTeams   = (s: TournamentState) =>
  (s.entities?.tournamentTeams ?? EMPTY_ARR) as ReadonlyArray<{ team_id: number }>;
const selDraftMatches      = (s: TournamentState) => s.draftMatches as DraftMatch[];
const selDbOverlayBySig    = (s: TournamentState) => s.dbOverlayBySig as Record<string, Partial<DbOverlay>>;

/* ============================
   Utilities
   ============================ */
const nextId = (() => {
  let i = 1;
  return () => `N${i++}`;
})();

const keyOf = (r?: number | null, p?: number | null) => (r && p ? `R${r}-B${p}` : null);

/** Human-readable label for a KO round based on its position relative to the final. */
function getRoundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  switch (fromFinal) {
    case 0: return "Final";
    case 1: return "Semi-finals";
    case 2: return "Quarter-finals";
    default: {
      const teamsInRound = Math.pow(2, fromFinal + 1);
      return `Round of ${teamsInRound}`;
    }
  }
}

function rowSignature(m: DraftMatch) {
  const parts = [
    m.stageIdx ?? "",
    m.groupIdx ?? "",
    m.matchday ?? "",
    m.round ?? "",
    m.bracket_pos ?? "",
    m.team_a_id ?? "",
    m.team_b_id ?? "",
    m.match_date ?? "",
  ];
  return parts.join("|");
}

function bucketRoundsByX(nodes: NodeBox[], gap = 120) {
  const sorted = nodes.slice().sort((a, b) => a.x - b.x);
  const cols: NodeBox[][] = [];
  for (const n of sorted) {
    const last = cols[cols.length - 1];
    if (!last || Math.abs(n.x - last[0].x) > gap) cols.push([n]);
    else last.push(n);
  }
  const roundOf = new Map<string, number>();
  const posOf = new Map<string, number>();
  cols.forEach((col, i) => {
    const r = i + 1;
    col
      .slice()
      .sort((a, b) => a.y - b.y)
      .forEach((n, j) => {
        roundOf.set(n.id, r);
        posOf.set(n.id, j + 1);
      });
  });
  return { roundOf, posOf };
}

function computePointers(opts: {
  nodes: NodeBox[];
  connections: Connection[];
  meta: Record<string, NodeMeta>;
}) {
  const { nodes, connections, meta } = opts;
  const hasMeta = (id: string) => !!meta[id];
  const { roundOf, posOf } = bucketRoundsByX(nodes);
  const roundOfId = (id: string) => (hasMeta(id) ? meta[id].round : (roundOf.get(id) ?? 1));
  const posOfId = (id: string) => (hasMeta(id) ? meta[id].bracket_pos : (posOf.get(id) ?? 1));

  const incoming = new Map<string, Array<{ from: string; r: number; p: number }>>();
  connections.forEach(([from, to]) => {
    const rFrom = roundOfId(from);
    const pFrom = posOfId(from);
    const rTo = roundOfId(to);
    if (rFrom !== rTo - 1) return; // only prev-round → next-round
    const list = incoming.get(to) ?? [];
    if (list.length < 2) list.push({ from, r: rFrom, p: pFrom });
    incoming.set(to, list);
  });

  const ptr: Record<string, { home?: { r: number; p: number }; away?: { r: number; p: number } }> = {};
  for (const [to, list] of incoming) {
    const sorted = list.slice().sort((a, b) => a.p - b.p);
    if (sorted[0]) (ptr[to] ??= {}).home = { r: sorted[0].r, p: sorted[0].p };
    if (sorted[1]) (ptr[to] ??= {}).away = { r: sorted[1].r, p: sorted[1].p };
  }

  return { incoming, ptr };
}

/* ============================
   Guardrails: sanitize connections (visual + persistence)
   - Enforce: prevRound -> nextRound only
   - Enforce: ≤ 2 parents per child
   - Enforce: ≤ 1 child per parent (no fan-out)
   - Drop self-loops and duplicates
   ============================ */
function sanitizeConnections(
  cx: Connection[],
  meta: Record<string, NodeMeta>
): { cx: Connection[]; violations: string[] } {
  const allowed: Connection[] = [];
  const dedupe = new Set<string>();
  const violations: string[] = [];

  const hasMeta = (id: string) => !!meta[id];

  // 1) Filter to edges with meta, no self-loops, strictly prev->next round
  for (const [from, to] of cx) {
    const key = `${from}→${to}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    if (from === to) { violations.push(`Self-loop dropped: ${key}`); continue; }
    if (!hasMeta(from) || !hasMeta(to)) { violations.push(`Missing meta: ${key}`); continue; }

    const mFrom = meta[from];
    const mTo   = meta[to];
    if (mFrom.round !== mTo.round - 1) { violations.push(`Cross/skip round dropped: ${key}`); continue; }

    allowed.push([from, to]);
  }

  // 2) ≤2 parents per child: keep 2 with lowest parent bracket_pos
  const byTo = new Map<string, Array<{ from: string; to: string; fromPos: number }>>();
  for (const [from, to] of allowed) {
    const list = byTo.get(to) ?? [];
    list.push({ from, to, fromPos: meta[from].bracket_pos });
    byTo.set(to, list);
  }
  const cappedParents: Connection[] = [];
  for (const [to, list] of byTo) {
    const chosen = list.sort((a, b) => a.fromPos - b.fromPos).slice(0, 2);
    if (list.length > 2) violations.push(`Too many parents for ${to}: kept 2, dropped ${list.length - 2}`);
    for (const item of chosen) cappedParents.push([item.from, item.to]);
  }

  // 3) ≤1 child per parent (KO semantics): keep child with lowest bracket_pos
  const byFrom = new Map<string, Array<{ from: string; to: string; toPos: number }>>();
  for (const [from, to] of cappedParents) {
    const list = byFrom.get(from) ?? [];
    list.push({ from, to, toPos: meta[to].bracket_pos });
    byFrom.set(from, list);
  }

  const result: Connection[] = [];
  for (const [from, list] of byFrom) {
    const chosen = list.sort((a, b) => a.toPos - b.toPos)[0];
    if (list.length > 1) violations.push(`Fan-out from ${from}: kept ${chosen.to}, dropped ${list.length - 1} child link(s)`);
    result.push([from, chosen.to]);
  }

  return { cx: result, violations };
}

/* ============================
   Component
   ============================ */
export default function BracketCanvas({
  stageIdx,
  teamsMap,
}: {
  stageIdx: number;
  teamsMap: TeamsMap;
}) {
  // Stable actions
  const setKOTeams        = useTournamentStore(selSetKOTeams);
  const setKOLink         = useTournamentStore(selSetKOLink);
  const setKORoundPos     = useTournamentStore(selSetKORoundPos);
  const reindexKOPointers = useTournamentStore(selReindexKOPointers);
  const updateMatches     = useTournamentStore(selUpdateMatches);

  // Entities / ids
  const stagesById      = useTournamentStore(selStagesById);
  const stageIdByIndex  = useTournamentStore(selStageIdByIndex);
  const tournamentTeams = useTournamentStore(selTournamentTeams);

  // Raw slices + local merge (show overlay without a save)
  const draftMatches   = useTournamentStore(selDraftMatches);
  const dbOverlayBySig = useTournamentStore(selDbOverlayBySig);

  // Kind derive
  const isKO = useMemo(() => {
    const sid = stageIdByIndex[stageIdx];
    if (!sid) return false;
    return stagesById[sid]?.kind === "knockout";
  }, [stageIdx, stageIdByIndex, stagesById]);

  // Base rows for this stage (includes UNSAVED)
  const baseRows = useMemo<DraftMatch[]>(() => {
    const rows = draftMatches.filter((m) => m.stageIdx === stageIdx);
    return rows
      .slice()
      .sort((a, b) =>
        isKO
          ? (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
          : (a.matchday ?? 0) - (b.matchday ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
      );
  }, [draftMatches, stageIdx, isKO]);

  // Merge overlay → show status/score/db_id without needing a save
  const rows = useMemo<MergedMatch[]>(() => {
    return baseRows.map((r) => {
      const ov = dbOverlayBySig[rowSignature(r)] as DbOverlay | undefined;
      return ov ? ({ ...r, ...ov } as MergedMatch) : (r as MergedMatch);
    });
  }, [baseRows, dbOverlayBySig]);

  // Participants (ids only)
  const participantIds = useMemo(() => {
    const ids = (tournamentTeams ?? EMPTY_ARR)
      .map((tt) => tt.team_id)
      .filter((id): id is number => typeof id === "number");
    if (ids.length) return ids as number[];
    // fallback to provided map keys
    const maybes = Object.keys(teamsMap ?? {});
    const nums = maybes.map((k) => Number(k)).filter((n) => Number.isFinite(n)) as number[];
    return nums;
  }, [tournamentTeams, teamsMap]);

  // index for "R{round}-B{pos}" → row
  const rowByNodeKey = useMemo(() => {
    const m = new Map<string, MergedMatch>();
    rows.forEach((r) => {
      if ((r.round ?? null) != null && (r.bracket_pos ?? null) != null) {
        m.set(`R${r.round}-B${r.bracket_pos}`, r);
      }
    });
    return m;
  }, [rows]);

  // canvas state
  const [nodes, setNodes] = useState<NodeBox[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  const [teamsByNode, setTeamsByNode] = useState<Record<string, { A: number | null; B: number | null }>>({});

  // snapshots / guards
  const prevMetaRef = useRef<Record<string, NodeMeta>>({});
  const sigRef = useRef<{ n: string; c: string; m: string; t: string }>({ n: "", c: "", m: "", t: "" });
  const syncingRef = useRef(false); // true while we intentionally write to the store

  // Authoring guard: read-only by default; enabling tools turns on writes
  const [showTools, setShowTools] = useState<boolean>(false);
  const [allowWrites, setAllowWrites] = useState<boolean>(false);

  // Ignore the very first connections change after we set them from store
  const skipNextConnectionsRef = useRef<boolean>(false);

  // design tools selection
  const [selA, setSelA] = useState<string>("");
  const [selB, setSelB] = useState<string>("");
  const [target, setTarget] = useState<string>("");

  const getTeamName = (id: number | null | undefined) => {
    if (id == null) return "TBD";
    const rec = (teamsMap as any)[id] ?? (teamsMap as any)[String(id)] ?? (teamsMap as any)[`${id}`];
    return rec?.name ?? `Team #${id}`;
  };

  /* ============================
     LOAD FROM STORE (draft + overlay) — LISTEN ONLY
     ============================ */
  const loadFromStore = useCallback(() => {
    const stageRows = (rows ?? []).filter(
      (m) => (m.round ?? null) != null && (m.bracket_pos ?? null) != null
    );

    if (!stageRows.length) {
      // visual starter only
      const A = nextId(), B = nextId(), C = nextId();
      const meta: Record<string, NodeMeta> = {
        [A]: { round: 1, bracket_pos: 1 },
        [B]: { round: 1, bracket_pos: 2 },
        [C]: { round: 2, bracket_pos: 1 },
      };
      const nx: NodeBox[] = [
        { id: A, x: 60, y: 60,  w: 200, h: 120, label: "R1 • Pos 1" },
        { id: B, x: 60, y: 180, w: 200, h: 120, label: "R1 • Pos 2" },
        { id: C, x: 300, y: 120, w: 220, h: 120, label: "R2 • Pos 1" },
      ];
      const edges: Connection[] = [[A, C], [B, C]];
      const tbn: Record<string, { A: number | null; B: number | null }> = {};

      const nSig = JSON.stringify(nx.map(n => [n.id, n.x, n.y, n.w, n.h, n.label]));
      const cSig = JSON.stringify(edges);
      const mSig = JSON.stringify(meta);
      const tSig = JSON.stringify(tbn);

      if (sigRef.current.n !== nSig) { setNodes(nx); sigRef.current.n = nSig; }
      if (sigRef.current.c !== cSig) { setConnections(edges); sigRef.current.c = cSig; }
      if (sigRef.current.m !== mSig) { setNodeMeta(meta); sigRef.current.m = mSig; prevMetaRef.current = meta; }
      if (sigRef.current.t !== tSig) { setTeamsByNode(tbn); sigRef.current.t = tSig; }

      // prevent the first onConnectionsChange from writing
      skipNextConnectionsRef.current = true;
      return;
    }

    const colW = 240, rowH = 130, x0 = 60, y0 = 60;

    const nx: NodeBox[] = stageRows.map((m) => ({
      id: `R${m.round}-B${m.bracket_pos}`,
      x: ((m.round ?? 1) - 1) * colW + x0,
      y: ((m.bracket_pos ?? 1) - 1) * rowH + y0,
      w: 220,
      h: 120,
      label: `R${m.round} • Pos ${m.bracket_pos}`,
    }));

    const meta: Record<string, NodeMeta> = {};
    stageRows.forEach((m) => {
      const id = `R${m.round}-B${m.bracket_pos}`;
      meta[id] = { round: m.round ?? 1, bracket_pos: m.bracket_pos ?? 1 };
    });

    const edges: Connection[] = [];
    stageRows.forEach((m) => {
      const toKey = keyOf(m.round ?? null, m.bracket_pos ?? null);
      if (!toKey) return;
      const homeKey = keyOf(m.home_source_round ?? null, m.home_source_bracket_pos ?? null);
      const awayKey = keyOf(m.away_source_round ?? null, m.away_source_bracket_pos ?? null);
      if (homeKey) edges.push([homeKey, toKey]);
      if (awayKey) edges.push([awayKey, toKey]);
    });

    const tbn: Record<string, { A: number | null; B: number | null }> = {};
    stageRows.forEach((m) => {
      const id = keyOf(m.round ?? null, m.bracket_pos ?? null);
      if (!id) return;
      tbn[id] = { A: m.team_a_id ?? null, B: m.team_b_id ?? null };
    });

    const nSig = JSON.stringify(nx.map(n => [n.id, n.x, n.y, n.w, n.h, n.label]));
    const cSig = JSON.stringify(edges);
    const mSig = JSON.stringify(meta);
    const tSig = JSON.stringify(tbn);

    if (sigRef.current.n !== nSig) { setNodes(nx); sigRef.current.n = nSig; }
    if (sigRef.current.c !== cSig) { setConnections(edges); sigRef.current.c = cSig; }
    if (sigRef.current.m !== mSig) { setNodeMeta(meta); sigRef.current.m = mSig; prevMetaRef.current = meta; }
    if (sigRef.current.t !== tSig) { setTeamsByNode(tbn); sigRef.current.t = tSig; }

    // prevent the first onConnectionsChange from writing
    skipNextConnectionsRef.current = true;
  }, [rows]);

  // Reload canvas when merged rows change (pure read)
  useEffect(() => {
    if (syncingRef.current) return;
    loadFromStore();
  }, [loadFromStore]);

  /* ============================
     finished detection from merged rows (read-only)
     ============================ */
  const finishedNodeIds = useMemo(() => {
    const done = new Set<string>();
    rows.forEach((m) => {
      if ((m.round ?? null) == null || (m.bracket_pos ?? null) == null) return;
      const id = `R${m.round}-B${m.bracket_pos}`;
      const st = (m as any).status;
      const a = (m as any).team_a_score;
      const b = (m as any).team_b_score;
      const w = (m as any).winner_team_id;
      if (st === "finished" || typeof a === "number" || typeof b === "number" || w != null) {
        done.add(id);
      }
    });
    return done;
  }, [rows]);

  /* ============================
     Helpers
     ============================ */
  const sameLink = (a?: { r: number; p: number } | null, b?: { r: number; p: number } | null) =>
    (!a && !b) || (!!a && !!b && a.r === b.r && a.p === b.p);

  function currentStoreLinksFor(r: number, p: number) {
    const row = rowByNodeKey.get(`R${r}-B${p}`);
    const home =
      row?.home_source_round && row?.home_source_bracket_pos
        ? { r: row.home_source_round, p: row.home_source_bracket_pos }
        : null;
    const away =
      row?.away_source_round && row?.away_source_bracket_pos
        ? { r: row.away_source_round, p: row.away_source_bracket_pos }
        : null;
    return { home, away };
  }

  function ensureRowExists(r: number, p: number) {
    const stageRows = useTournamentStore.getState().draftMatches.filter((m) => m.stageIdx === stageIdx);
    const exists = stageRows.some((m) => m.round === r && m.bracket_pos === p);
    if (exists) return;
    syncingRef.current = true;
    updateMatches(stageIdx, (stageRowsIn) => [
      ...stageRowsIn,
      {
        stageIdx,
        groupIdx: null,
        matchday: null,
        round: r,
        bracket_pos: p,
        team_a_id: null,
        team_b_id: null,
        match_date: null,
        home_source_round: null,
        home_source_bracket_pos: null,
        away_source_round: null,
        away_source_bracket_pos: null,
      } as DraftMatch,
    ]);
    setTimeout(() => (syncingRef.current = false), 0);
  }

  function clearSlot(r: number, p: number) {
    if (!allowWrites) return;
    syncingRef.current = true;
    setKOLink(stageIdx, { round: r, bracket_pos: p }, "home", null);
    setKOLink(stageIdx, { round: r, bracket_pos: p }, "away", null);
    setKOTeams(stageIdx, { round: r, bracket_pos: p }, null, null);
    setTimeout(() => (syncingRef.current = false), 0);
  }

  function clearSlotById(id: string) {
    const m = nodeMeta[id];
    if (!m) return;
    setConnections((prev) => prev.filter(([a, b]) => a !== id && b !== id));
    setTeamsByNode((prev) => ({ ...prev, [id]: { A: null, B: null } }));
    clearSlot(m.round, m.bracket_pos);
  }

  function hardDeleteSlotById(id: string) {
    if (!allowWrites) return;
    const m = nodeMeta[id];
    if (!m) return;
    clearSlot(m.round, m.bracket_pos);

    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter(([a, b]) => a !== id && b !== id));
    setTeamsByNode((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setNodeMeta((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    syncingRef.current = true;
    updateMatches(stageIdx, (stageRows) =>
      stageRows.filter(
        (r) => !(r.stageIdx === stageIdx && r.round === m.round && r.bracket_pos === m.bracket_pos)
      )
    );
    setTimeout(() => (syncingRef.current = false), 0);
  }

  /* ============================
     Node content (display-only)
     ============================ */
  const incomingBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [from, to] of connections) m.set(to, [...(m.get(to) ?? []), from]);
    return m;
  }, [connections]);

  const nodeOptions = useMemo(
    () =>
      nodes
        .slice()
        .sort((a, b) => {
          const A = nodeMeta[a.id];
          const B = nodeMeta[b.id];
          if (A && B) return A.round - B.round || A.bracket_pos - B.bracket_pos;
          return a.id.localeCompare(b.id);
        })
        .map((n) => {
          const m = nodeMeta[n.id];
          const label = m ? `R${m.round}-B${m.bracket_pos} (${n.id})` : n.id;
          return { id: n.id, label };
        }),
    [nodes, nodeMeta]
  );

  // Only show an actual winner when winner_team_id exists (no BYE inference)
  const describeParent = useCallback(
    (srcId: string) => {
      const parentRow = rowByNodeKey.get(srcId);
      if (parentRow?.winner_team_id != null) {
        return `Winner: ${getTeamName(parentRow.winner_team_id)}`;
      }
      const m = nodeMeta[srcId];
      return m ? `Winner R${m.round}-B${m.bracket_pos}` : `Winner of ${srcId}`;
    },
    [rowByNodeKey, nodeMeta]
  );

  const linkLabel = (lp?: { r: number; p: number } | null) => (lp ? `W(R${lp.r}-B${lp.p})` : "—");

  const nodeContent = (n: NodeBox) => {
    const parents = incomingBy.get(n.id) ?? [];
    const row = rowByNodeKey.get(n.id);

    const meta = nodeMeta[n.id];
    const { home: storeHome, away: storeAway } = meta
      ? currentStoreLinksFor(meta.round, meta.bracket_pos)
      : { home: null, away: null };

    const connParents = (() => {
      const ps = connections.filter(([, to]) => to === n.id).map(([from]) => from);
      return ps
        .map((pid) => nodeMeta[pid])
        .filter(Boolean)
        .map((m) => ({ r: m!.round, p: m!.bracket_pos }))
        .sort((a, b) => a.p - b.p);
    })();
    const connHome = connParents[0] ?? null;
    const connAway = connParents[1] ?? null;

    // STRICT: do not infer BYE winners visually
    const parentWinnerId = (src?: { r: number; p: number } | null): number | null => {
      if (!src) return null;
      const parentKey = `R${src.r}-B${src.p}`;
      const parentRow = rowByNodeKey.get(parentKey);
      return (parentRow?.winner_team_id ?? null) as number | null;
    };

    const resolveSideName = (side: "home" | "away") => {
      // If the child match has an explicit team id, show it.
      const directId = side === "home" ? (row?.team_a_id ?? null) : (row?.team_b_id ?? null);
      if (directId != null) return getTeamName(directId);

      // Else, try the actual persisted winner from the sourced parent (no inference).
      const src = side === "home" ? (storeHome ?? connHome) : (storeAway ?? connAway);
      const w = parentWinnerId(src);
      if (w != null) return getTeamName(w);

      return "TBD";
    };

    const nameA = resolveSideName("home");
    const nameB = resolveSideName("away");
    const topIsDetermined = nameA !== "TBD" && nameB !== "TBD";
    const topLine = `${nameA} vs ${nameB}`;

    const sourceLine =
      parents.length > 0
        ? `${parents[0] ? describeParent(parents[0]) : "Winner ?"} vs ${
            parents[1] ? describeParent(parents[1]) : "Winner ?"
          }`
        : null;

    const tag = meta
      ? `${getRoundLabel(meta.round, totalRounds)} (R${meta.round}) • B${meta.bracket_pos}`
      : n.id;

    const finished = (() => {
      const r = rowByNodeKey.get(n.id);
      if (!r) return false;
      const st = (r as any).status;
      const a = (r as any).team_a_score;
      const b = (r as any).team_b_score;
      const w = (r as any).winner_team_id;
      return st === "finished" || typeof a === "number" || typeof b === "number" || w != null;
    })();

    const sameHome = sameLink(storeHome, connHome);
    const sameAway = sameLink(storeAway, connAway);

    const Badge = ({ ok, text }: { ok: boolean; text: string }) => (
      <span
        className={[
          "ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px]",
          ok
            ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
            : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
        ].join(" ")}
      >
        {text}
      </span>
    );

    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={`font-semibold leading-tight ${topIsDetermined ? "text-white" : "text-white/80"} truncate`}
              title={topLine}
            >
              {topLine}
            </div>
            {sourceLine && (
              <div className="text-[11px] leading-snug text-white/70 truncate" title={sourceLine}>
                {sourceLine}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              className="rounded px-1.5 py-0.5 text-[10px] border border-white/15 bg-white/5 hover:bg-white/10"
              onClick={(e) => { e.stopPropagation(); clearSlotById(n.id); }}
              title="Clear match (keep slot)"
              disabled={!allowWrites}
            >
              Clear
            </button>
            <button
              className="rounded px-1.5 py-0.5 text-[10px] border border-rose-400/40 text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
              onClick={(e) => { e.stopPropagation(); hardDeleteSlotById(n.id); }}
              title="Remove slot"
              disabled={!allowWrites}
            >
              Remove
            </button>
          </div>
        </div>

        <div className="mt-1 text-[11px] text-white/75 space-y-0.5">
          <div className="flex items-center">
            <span className="opacity-80">Home from:</span>
            <span className="ml-1">{linkLabel(storeHome ?? connHome)}</span>
            <Badge ok={sameHome} text={sameHome ? "OK" : "Mismatch/missing"} />
          </div>
          <div className="flex items-center">
            <span className="opacity-80">Away from:</span>
            <span className="ml-1">{linkLabel(storeAway ?? connAway)}</span>
            <Badge ok={sameAway} text={sameAway ? "OK" : "Mismatch/missing"} />
          </div>
        </div>

        {finished && (
          <span
            className="mt-1 inline-flex w-fit items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px]
                       font-semibold uppercase tracking-wide
                       bg-gradient-to-r from-red-600/80 to-amber-500/80 text-white
                       ring-1 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]"
            title="Match finished"
          >
            Finished
          </span>
        )}

        <div className="mt-auto text-[11px] text-white/70">{tag}</div>
      </div>
    );
  };

  /* ============================
     Design helpers (user actions WRITE here)
     ============================ */
  function firstFreePos(round: number) {
    const used = new Set(Object.values(nodeMeta).filter((m) => m.round === round).map((m) => m.bracket_pos));
    let p = 1;
    while (used.has(p)) p++;
    return p;
  }

  function addMatchToRound(round: number) {
    if (!allowWrites) return;
    const bracket_pos = firstFreePos(round);
    ensureRowExists(round, bracket_pos);

    const colW = 240, rowH = 130, x0 = 60, y0 = 60;
    const id = nextId();
    const x = (round - 1) * colW + x0;
    const y = (bracket_pos - 1) * rowH + y0;

    setNodes((prev) => [...prev, { id, x, y, w: 220, h: 120, label: `R${round} • Pos ${bracket_pos}` }]);
    setNodeMeta((prev) => ({ ...prev, [id]: { round, bracket_pos } }));
  }

  function addNewRound() {
    if (!allowWrites) return;
    const existingRounds = Object.values(nodeMeta).map((m) => m.round);
    const maxRound = existingRounds.length ? Math.max(...existingRounds) : 0;
    addMatchToRound(maxRound + 1);
  }

  function writeLinksForChild(round: number, bracket_pos: number, parentA: NodeMeta, parentB: NodeMeta) {
    if (!allowWrites) return;
    ensureRowExists(round, bracket_pos);
    ensureRowExists(parentA.round, parentA.bracket_pos);
    ensureRowExists(parentB.round, parentB.bracket_pos);

    const [homeP, awayP] =
      parentA.bracket_pos <= parentB.bracket_pos ? [parentA, parentB] : [parentB, parentA];

    syncingRef.current = true;
    setKOLink(stageIdx, { round, bracket_pos }, "home", { round: homeP.round, bracket_pos: homeP.bracket_pos }, "W");
    setKOLink(stageIdx, { round, bracket_pos }, "away", { round: awayP.round, bracket_pos: awayP.bracket_pos }, "W");
    reindexKOPointers(stageIdx);
    setTimeout(() => (syncingRef.current = false), 0);
  }

  // STRICT: block illegal wiring when auto-creating a child
  function addChildFromTwoParents() {
    if (!allowWrites) return;
    if (!selA || !selB || selA === selB) return;
    const A = nodeMeta[selA];
    const B = nodeMeta[selB];
    if (!A || !B) return;
    if (A.round !== B.round) { alert("Parents must be in the same round."); return; }

    // Fan-out guard: a KO match can feed only one child
    const fanOutA = connections.some(([from, to]) => from === selA);
    const fanOutB = connections.some(([from, to]) => from === selB);
    if (fanOutA || fanOutB) { alert("Each parent may feed only one child in a KO bracket."); return; }

    const round = A.round + 1;
    const base = Math.min(A.bracket_pos, B.bracket_pos);
    const bracket_pos = Math.floor((base + 1) / 2);

    const colW = 240, rowH = 130, x0 = 60, y0 = 60;
    const id = nextId();
    const x = (round - 1) * colW + x0;
    const y = (bracket_pos - 1) * rowH + y0;

    setNodes((prev) => [...prev, { id, x, y, w: 220, h: 120, label: `R${round} • Pos ${bracket_pos}` }]);
    setNodeMeta((prev) => ({ ...prev, [id]: { round, bracket_pos } }));
    setConnections((prev) => [...prev, [selA, id], [selB, id]]);
    setTarget(id);

    writeLinksForChild(round, bracket_pos, A, B);
  }

  // STRICT: block fan-out, cross/skip round, and 3rd parent
  function connectParentsToTarget() {
    if (!allowWrites) return;
    if (!target) return;
    const tMeta = nodeMeta[target];
    if (!tMeta) return;

    const conns: Connection[] = [];
    if (selA) conns.push([selA, target]);
    if (selB) conns.push([selB, target]);

    const prevRound = tMeta.round - 1;
    for (const [from] of conns) {
      const m = nodeMeta[from];
      if (!m || m.round !== prevRound) {
        alert("Each parent must be in the previous round of the target.");
        return;
      }
      // Fan-out guard: parent cannot already feed a different child
      const existingOtherChild = connections.some(([f, to]) => f === from && to !== target);
      if (existingOtherChild) {
        alert("A parent may feed only one child in a KO bracket.");
        return;
      }
    }
    const already = connections.filter(([, to]) => to === target).length;
    if (already + conns.length > 2) { alert("A KO match can have at most 2 parents."); return; }

    setConnections((prev) => [...prev, ...conns]);

    const parents = conns.map(([from]) => nodeMeta[from]!).sort((a, b) => a.bracket_pos - b.bracket_pos);
    const [pA, pB] = [parents[0], parents[1] ?? parents[0]];
    writeLinksForChild(tMeta.round, tMeta.bracket_pos, pA, pB);
  }

  function reflowFromMeta() {
    setNodes((prev) =>
      prev.map((n) => {
        const m = nodeMeta[n.id];
        if (!m) return n;
        const colW = 240, rowH = 130, x0 = 60, y0 = 60;
        return {
          ...n,
          x: (m.round - 1) * colW + x0,
          y: (m.bracket_pos - 1) * rowH + y0,
          label: `R${m.round} • Pos ${m.bracket_pos}`,
        };
      })
    );
  }

  /* ============================
     WRITE only in handlers (guarded)
     ============================ */
  const handleConnectionsChange = (cx: Connection[]) => {
    // Sanitize first so illegal wires never "stick" visually.
    const { cx: safeCx, violations } = sanitizeConnections(cx, nodeMeta);

    // Reflect sanitized graph immediately
    setConnections(safeCx);

    // Surface issues (swap to toast/snackbar in your app if desired)
    if (violations.length) {
      // eslint-disable-next-line no-console
      console.warn("[Bracket] connections sanitized:", violations);
      // Or: alert(violations.join("\n"));
    }

    // Skip the very first call that follows a store-driven load,
    // and never write if authoring is disabled.
    if (skipNextConnectionsRef.current) {
      skipNextConnectionsRef.current = false;
      return;
    }
    if (!allowWrites) return;
    if (!Object.keys(nodeMeta).length) return;

    // compute intended pointers from the sanitized connections
    const { ptr } = computePointers({ nodes, connections: safeCx, meta: nodeMeta });

    let changed = false;
    Object.keys(nodeMeta).forEach((id) => {
      const r = nodeMeta[id].round;
      const p = nodeMeta[id].bracket_pos;

      const nextHome = ptr[id]?.home ? { r: ptr[id]!.home!.r, p: ptr[id]!.home!.p } : null;
      const nextAway = ptr[id]?.away ? { r: ptr[id]!.away!.r, p: ptr[id]!.away!.p } : null;

      ensureRowExists(r, p);
      if (nextHome) ensureRowExists(nextHome.r, nextHome.p);
      if (nextAway) ensureRowExists(nextAway.r, nextAway.p);

      const { home: currHome, away: currAway } = currentStoreLinksFor(r, p);

      if (!sameLink(currHome, nextHome)) {
        syncingRef.current = true;
        setKOLink(
          stageIdx,
          { round: r, bracket_pos: p },
          "home",
          nextHome ? { round: nextHome.r, bracket_pos: nextHome.p } : null,
          "W"
        );
        changed = true;
      }
      if (!sameLink(currAway, nextAway)) {
        syncingRef.current = true;
        setKOLink(
          stageIdx,
          { round: r, bracket_pos: p },
          "away",
          nextAway ? { round: nextAway.r, bracket_pos: nextAway.p } : null,
          "W"
        );
        changed = true;
      }
    });

    if (changed) {
      reindexKOPointers(stageIdx);
      setTimeout(() => (syncingRef.current = false), 0);
    }
  };

  const handleApplyPos = (id: string) => {
    if (!allowWrites) return;
    const m = nodeMeta[id];
    if (!m) return;
    const prev = prevMetaRef.current[id];
    prevMetaRef.current = { ...nodeMeta };

    // move in store only when Apply is pressed
    if (prev && (prev.round !== m.round || prev.bracket_pos !== m.bracket_pos)) {
      ensureRowExists(prev.round, prev.bracket_pos);
      ensureRowExists(m.round, m.bracket_pos);
      syncingRef.current = true;
      setKORoundPos(
        stageIdx,
        { round: prev.round, bracket_pos: prev.bracket_pos },
        { round: m.round, bracket_pos: m.bracket_pos }
      );
      setTimeout(() => (syncingRef.current = false), 0);
    }

    const colW = 240, rowH = 130, x0 = 60, y0 = 60;
    setNodes((prevNodes) =>
      prevNodes.map((nb) =>
        nb.id === id
          ? { ...nb, x: (m.round - 1) * colW + x0, y: (m.bracket_pos - 1) * rowH + y0, label: `R${m.round} • Pos ${m.bracket_pos}` }
          : nb
      )
    );
  };

  const handleTeamChange = (nodeId: string, side: "A" | "B", value: string) => {
    const idNum = value ? Number(value) : null;
    setTeamsByNode((prev) => {
      const next = { ...(prev[nodeId] ?? { A: null, B: null }), [side]: idNum } as { A: number | null; B: number | null };
      // persist immediately if leaf and authoring allowed
      if (allowWrites) {
        const parents: string[] = [];
        connections.forEach(([from, to]) => { if (to === nodeId) parents.push(from); });
        if (parents.length === 0) {
          const meta = nodeMeta[nodeId];
          if (meta) {
            ensureRowExists(meta.round, meta.bracket_pos);
            syncingRef.current = true;
            setKOTeams(stageIdx, { round: meta.round, bracket_pos: meta.bracket_pos }, next.A, next.B);
            setTimeout(() => (syncingRef.current = false), 0);
          }
        }
      }
      return { ...prev, [nodeId]: next };
    });
  };

  /* ============================
     UI
     ============================ */
  const existingRounds = useMemo(() => {
    const rounds = new Set(Object.values(nodeMeta).map((m) => m.round));
    return [...rounds].sort((a, b) => a - b);
  }, [nodeMeta]);
  const totalRounds = existingRounds.length ? Math.max(...existingRounds) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={loadFromStore}
          title="Reload from store (discard local layout changes)"
        >
          Load from store
        </button>

        <button
          className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={() => {
            setShowTools((s) => {
              const next = !s;
              setAllowWrites(next); // writes only when tools are visible
              return next;
            });
          }}
          title="Show/hide knockout designer tools"
        >
          {showTools ? "Hide design tools (writing enabled)" : "Design tools (enable writing)"}
        </button>
      </div>

      {/* Per-round "Add Match" buttons */}
      {showTools && (
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-indigo-950/40 p-3 space-y-2">
          <div className="text-xs text-white/60 font-medium mb-1">Add match to a specific round:</div>
          <div className="flex flex-wrap items-center gap-2">
            {existingRounds.map((r) => {
              const label = getRoundLabel(r, totalRounds);
              const matchCount = Object.values(nodeMeta).filter((m) => m.round === r).length;
              return (
                <button
                  key={`add-r${r}`}
                  className="px-3 py-1.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 text-xs"
                  onClick={() => addMatchToRound(r)}
                  title={`Add a new match to Round ${r} (${label})`}
                  disabled={!allowWrites}
                >
                  + Round {r} — {label}
                  <span className="ml-1.5 text-white/50">({matchCount} match{matchCount !== 1 ? "es" : ""})</span>
                </button>
              );
            })}
            <button
              className="px-3 py-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50 text-xs"
              onClick={addNewRound}
              title="Add a brand new round after the last existing round"
              disabled={!allowWrites}
            >
              + New Round {totalRounds + 1}
            </button>
          </div>
        </div>
      )}

      {/* Designer tools */}
      {showTools && (
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-black/50 via-red-950/30 to-amber-900/20 p-3 space-y-2 shadow-inner">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <select
                className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                value={selA}
                onChange={(e) => setSelA(e.target.value)}
              >
                <option value="">Parent A…</option>
                {nodeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                value={selB}
                onChange={(e) => setSelB(e.target.value)}
              >
                <option value="">Parent B…</option>
                {nodeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50"
                onClick={addChildFromTwoParents}
                title="Create child in next round and connect both parents (and persist links)"
                disabled={!allowWrites}
              >
                + Child of A & B
              </button>
            </div>

            <div className="flex items-center gap-1">
              <select
                className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Target…</option>
                {nodeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50"
                onClick={connectParentsToTarget}
                title="Connect selected parent(s) to target (and persist links)"
                disabled={!allowWrites}
              >
                Connect → Target
              </button>
            </div>

            <span className="mx-2 h-5 w-px bg-white/10" />

            <button
              className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={reflowFromMeta}
            >
              Reflow from meta
            </button>
          </div>
        </div>
      )}

      <BracketEditor
        nodes={nodes}
        connections={connections}
        onNodesChange={setNodes}
        onConnectionsChange={handleConnectionsChange}
        nodeContent={nodeContent}
        isFinished={(id) => finishedNodeIds.has(id)}
        snap={10}
      />

      {/* First-round team pickers (leaf nodes only) */}
      <div className="grid md:grid-cols-2 gap-2">
        {nodes.map((n) => {
          const parents = ((): string[] => {
            const all: string[] = [];
            connections.forEach(([from, to]) => {
              if (to === n.id) all.push(from);
            });
            return all;
          })();
          if (parents.length > 0) return null;

          return (
            <div
              key={n.id}
              className="p-2 rounded-md border border-white/10 bg-gradient-to-br from-red-950/40 to-amber-900/20"
            >
              <div className="text-sm text-white/80 mb-2">
                Node {n.id} — Team slots (R{nodeMeta[n.id]?.round ?? "?"}/B{nodeMeta[n.id]?.bracket_pos ?? "?"})
              </div>
              <div className="flex gap-2">
                <select
                  className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                  value={teamsByNode[n.id]?.A ?? ""}
                  onChange={(e) => handleTeamChange(n.id, "A", e.target.value)}
                  disabled={!allowWrites}
                >
                  <option value="">— Team A —</option>
                  {participantIds.map((id) => (
                    <option key={id} value={id}>
                      {getTeamName(id)}
                    </option>
                  ))}
                </select>

                <select
                  className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                  value={teamsByNode[n.id]?.B ?? ""}
                  onChange={(e) => handleTeamChange(n.id, "B", e.target.value)}
                  disabled={!allowWrites}
                >
                  <option value="">— Team B —</option>
                  {participantIds.map((id) => (
                    <option key={id} value={id}>
                      {getTeamName(id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  className="w-20 bg-zinc-900 text-white border border-white/10 rounded px-2 py-1 text-xs"
                  type="number"
                  value={nodeMeta[n.id]?.round ?? 1}
                  onChange={(e) =>
                    setNodeMeta((prev) => ({
                      ...prev,
                      [n.id]: { round: Number(e.target.value) || 1, bracket_pos: prev[n.id]?.bracket_pos ?? 1 },
                    }))
                  }
                  title="Round"
                />
                <input
                  className="w-24 bg-zinc-900 text-white border border-white/10 rounded px-2 py-1 text-xs"
                  type="number"
                  value={nodeMeta[n.id]?.bracket_pos ?? 1}
                  onChange={(e) =>
                    setNodeMeta((prev) => ({
                      ...prev,
                      [n.id]: { round: prev[n.id]?.round ?? 1, bracket_pos: Number(e.target.value) || 1 },
                    }))
                  }
                  title="Bracket position"
                />
                <button
                  className="px-2 py-1 rounded border border-white/15 text-xs hover:bg-white/10 disabled:opacity-50"
                  onClick={() => handleApplyPos(n.id)}
                  disabled={!allowWrites}
                >
                  Apply pos
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
