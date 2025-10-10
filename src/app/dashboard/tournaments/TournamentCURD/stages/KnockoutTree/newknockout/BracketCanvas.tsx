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
  const roundOfId = (id: string) => (hasMeta(id) ? meta[id].round : roundOf.get(id) ?? 1);
  const posOfId = (id: string) => (hasMeta(id) ? meta[id].bracket_pos : posOf.get(id) ?? 1);

  const incoming = new Map<string, Array<{ from: string; r: number; p: number }>>();
  connections.forEach(([from, to]) => {
    const rFrom = roundOfId(from);
    const pFrom = posOfId(from);
    const rTo = roundOfId(to);
    if (rFrom !== rTo - 1) return; // only allow prev-round → next-round
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

  // Raw slices (stable selectors) + local merge so unsaved matches appear immediately
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

  // design tools selection
  const [selA, setSelA] = useState<string>("");
  const [selB, setSelB] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [showTools, setShowTools] = useState<boolean>(false);

  const getTeamName = (id: number | null | undefined) => {
    if (id == null) return "TBD";
    const rec = (teamsMap as any)[id] ?? (teamsMap as any)[String(id)] ?? (teamsMap as any)[`${id}`];
    return rec?.name ?? `Team #${id}`;
  };

  /* ============================
     LOAD FROM STORE (draft + overlay)
     ============================ */
  const loadFromStore = useCallback(() => {
    // only KO rows with round/bracket_pos
    const stageRows = (rows ?? []).filter(
      (m) => (m.round ?? null) != null && (m.bracket_pos ?? null) != null
    );

    if (!stageRows.length) {
      // visual starter
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

    // signature-based setState (prevents useless local updates → effects)
    const nSig = JSON.stringify(nx.map(n => [n.id, n.x, n.y, n.w, n.h, n.label]));
    const cSig = JSON.stringify(edges);
    const mSig = JSON.stringify(meta);
    const tSig = JSON.stringify(tbn);

    if (sigRef.current.n !== nSig) { setNodes(nx); sigRef.current.n = nSig; }
    if (sigRef.current.c !== cSig) { setConnections(edges); sigRef.current.c = cSig; }
    if (sigRef.current.m !== mSig) { setNodeMeta(meta); sigRef.current.m = mSig; prevMetaRef.current = meta; }
    if (sigRef.current.t !== tSig) { setTeamsByNode(tbn); sigRef.current.t = tSig; }
  }, [rows]);

  // Reload canvas when merged rows change (skip during intentional writes)
  useEffect(() => {
    if (syncingRef.current) return;
    loadFromStore();
  }, [loadFromStore]);

  /* ============================
     finished detection from merged rows
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
     Slot helpers (soft/hard)
     ============================ */
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
     Helpers to compare links
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

  /* ============================
     Auto-sync canvas → store
     ============================ */
  // 1) When nodeMeta changes: ensure rows exist and move slots that changed
  useEffect(() => {
    const prev = prevMetaRef.current;
    const curr = nodeMeta;

    let moved = false;

    Object.keys(curr).forEach((id) => {
      const before = prev[id];
      const after = curr[id];
      ensureRowExists(after.round, after.bracket_pos);
      if (before && (before.round !== after.round || before.bracket_pos !== after.bracket_pos)) {
        syncingRef.current = true;
        setKORoundPos(
          stageIdx,
          { round: before.round, bracket_pos: before.bracket_pos },
          { round: after.round, bracket_pos: after.bracket_pos }
        );
        moved = true;
      }
    });

    prevMetaRef.current = { ...curr };
    if (moved) setTimeout(() => (syncingRef.current = false), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeMeta, stageIdx]);

  // 2) When connections change: rewrite KO pointers (home/away) — DIFF ONLY
  useEffect(() => {
    if (!Object.keys(nodeMeta).length) return;

    // ensure all target rows exist before writing links
    Object.values(nodeMeta).forEach(({ round, bracket_pos }) => ensureRowExists(round, bracket_pos));

    const { ptr } = computePointers({ nodes, connections, meta: nodeMeta });

    let changed = false;

    Object.keys(nodeMeta).forEach((id) => {
      const r = nodeMeta[id].round;
      const p = nodeMeta[id].bracket_pos;

      const nextHome = ptr[id]?.home ? { r: ptr[id]!.home!.r, p: ptr[id]!.home!.p } : null;
      const nextAway = ptr[id]?.away ? { r: ptr[id]!.away!.r, p: ptr[id]!.away!.p } : null;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, nodes, nodeMeta, rowByNodeKey, stageIdx]);

  // 3) When leaf team picks change: push A/B teams for leaves (diff only)
  useEffect(() => {
    if (!Object.keys(nodeMeta).length) return;

    const incomingByLocal = new Map<string, string[]>();
    for (const [from, to] of connections) {
      incomingByLocal.set(to, [...(incomingByLocal.get(to) ?? []), from]);
    }

    let wrote = false;

    Object.keys(nodeMeta).forEach((id) => {
      const parents = incomingByLocal.get(id) ?? [];
      if (parents.length > 0) return; // not a leaf

      const picks = teamsByNode[id] ?? { A: null, B: null };
      const meta = nodeMeta[id];
      const row = rowByNodeKey.get(`R${meta.round}-B${meta.bracket_pos}`);

      const currA = row?.team_a_id ?? null;
      const currB = row?.team_b_id ?? null;

      if (currA !== (picks.A ?? null) || currB !== (picks.B ?? null)) {
        syncingRef.current = true;
        setKOTeams(stageIdx, { round: meta.round, bracket_pos: meta.bracket_pos }, picks.A, picks.B);
        wrote = true;
      }
    });

    if (wrote) setTimeout(() => (syncingRef.current = false), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsByNode, nodeMeta, connections, rowByNodeKey, stageIdx]);

  /* ============================
     UI helpers
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

  const describeParent = useCallback(
    (srcId: string) => {
      const parentRow = rowByNodeKey.get(srcId);
      const aId = parentRow?.team_a_id ?? teamsByNode[srcId]?.A ?? null;
      const bId = parentRow?.team_b_id ?? teamsByNode[srcId]?.B ?? null;
      if (aId || bId) {
        return `W(${getTeamName(aId)} vs ${getTeamName(bId)})`;
      }
      const m = nodeMeta[srcId];
      return m ? `Winner R${m.round}-B${m.bracket_pos}` : `Winner of ${srcId}`;
    },
    [rowByNodeKey, teamsByNode, nodeMeta]
  );

  const linkLabel = (lp?: { r: number; p: number } | null) => (lp ? `W(R${lp.r}-B${lp.p})` : "—");

  /* ============================
     Node content
     ============================ */
  const nodeContent = (n: NodeBox) => {
    const parents = incomingBy.get(n.id) ?? [];
    const row = rowByNodeKey.get(n.id);

    // --- Resolve which sources feed this node (store → fallback to canvas connections) ---
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

    // --- Display-side names: show exactly what we have (TBD vs TBD / Team A vs TBD / …) ---
    const resolveSideName = (side: "home" | "away") => {
      // Direct assignment wins
      const directId = side === "home" ? (row?.team_a_id ?? null) : (row?.team_b_id ?? null);
      if (directId != null) return getTeamName(directId);

      // Else, try winner from the sourced parent (store pointer first, then connection)
      const src = side === "home" ? (storeHome ?? connHome) : (storeAway ?? connAway);
      if (src) {
        const parentKey = `R${src.r}-B${src.p}`;
        const parentRow = rowByNodeKey.get(parentKey);
        if (parentRow?.winner_team_id != null) {
          return getTeamName(parentRow.winner_team_id);
        }
      }
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

    const tag = meta ? `Round ${meta.round} • B${meta.bracket_pos}` : n.id;

    const finished = (() => {
      const r = rowByNodeKey.get(n.id);
      if (!r) return false;
      const st = (r as any).status;
      const a = (r as any).team_a_score;
      const b = (r as any).team_b_score;
      const w = (r as any).winner_team_id;
      return st === "finished" || typeof a === "number" || typeof b === "number" || w != null;
    })();

    // store vs connections, show if mismatched (helps authors avoid bad saves)
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
            >
              Clear
            </button>
            <button
              className="rounded px-1.5 py-0.5 text-[10px] border border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
              onClick={(e) => { e.stopPropagation(); hardDeleteSlotById(n.id); }}
              title="Remove slot"
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
     Design helpers
     ============================ */
  function firstFreePos(round: number) {
    const used = new Set(Object.values(nodeMeta).filter((m) => m.round === round).map((m) => m.bracket_pos));
    let p = 1;
    while (used.has(p)) p++;
    return p;
  }

  // NEW: ensure store row immediately on add
  function addFirstRoundMatch() {
    const round = 1;
    const bracket_pos = firstFreePos(round);
    ensureRowExists(round, bracket_pos); // create in store now

    const colW = 240, rowH = 130, x0 = 60, y0 = 60;
    const id = nextId();
    const x = (round - 1) * colW + x0;
    const y = (bracket_pos - 1) * rowH + y0;

    setNodes((prev) => [...prev, { id, x, y, w: 220, h: 120, label: `R${round} • Pos ${bracket_pos}` }]);
    setNodeMeta((prev) => ({ ...prev, [id]: { round, bracket_pos } })); // effect will keep store synced
  }

  // NEW: write links to the store immediately after creating a child
  function writeLinksForChild(round: number, bracket_pos: number, parentA: NodeMeta, parentB: NodeMeta) {
    // guarantee rows
    ensureRowExists(round, bracket_pos);
    ensureRowExists(parentA.round, parentA.bracket_pos);
    ensureRowExists(parentB.round, parentB.bracket_pos);

    // order parents by bracket_pos to map → home, away
    const [homeP, awayP] =
      parentA.bracket_pos <= parentB.bracket_pos ? [parentA, parentB] : [parentB, parentA];

    syncingRef.current = true;
    setKOLink(stageIdx, { round, bracket_pos }, "home", { round: homeP.round, bracket_pos: homeP.bracket_pos }, "W");
    setKOLink(stageIdx, { round, bracket_pos }, "away", { round: awayP.round, bracket_pos: awayP.bracket_pos }, "W");
    reindexKOPointers(stageIdx);
    setTimeout(() => (syncingRef.current = false), 0);
  }

  function addChildFromTwoParents() {
    if (!selA || !selB || selA === selB) return;
    const A = nodeMeta[selA];
    const B = nodeMeta[selB];
    if (!A || !B) return;
    if (A.round !== B.round) { alert("Parents must be in the same round."); return; }

    const round = A.round + 1;
    const base = Math.min(A.bracket_pos, B.bracket_pos);
    const bracket_pos = Math.floor((base + 1) / 2);

    const colW = 240, rowH = 130, x0 = 60, y0 = 60;
    const id = nextId();
    const x = (round - 1) * colW + x0;
    const y = (bracket_pos - 1) * rowH + y0;

    // UI
    setNodes((prev) => [...prev, { id, x, y, w: 220, h: 120, label: `R${round} • Pos ${bracket_pos}` }]);
    setNodeMeta((prev) => ({ ...prev, [id]: { round, bracket_pos } }));
    setConnections((prev) => [...prev, [selA, id], [selB, id]]);
    setTarget(id);

    // Store: create row + write links now
    writeLinksForChild(round, bracket_pos, A, B);
  }

  function connectParentsToTarget() {
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
    }
    const already = connections.filter(([, to]) => to === target).length;
    if (already + conns.length > 2) { alert("A KO match can have at most 2 parents."); return; }

    // UI
    setConnections((prev) => [...prev, ...conns]);

    // Store: write links immediately (order by bracket_pos)
    const parents = conns.map(([from]) => nodeMeta[from]!).sort((a, b) => a.bracket_pos - b.bracket_pos);
    const [pA, pB] = [parents[0], parents[1] ?? parents[0]]; // if only one, use it as home
    writeLinksForChild(tMeta.round, tMeta.bracket_pos, pA, pB);
  }

  function reflowFromMeta() {
    const colW = 240, rowH = 130, x0 = 60, y0 = 60;
    setNodes((prev) =>
      prev.map((n) => {
        const m = nodeMeta[n.id];
        if (!m) return n;
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
     UI
     ============================ */
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
          onClick={() => setShowTools((s) => !s)}
          title="Show/hide knockout designer tools"
        >
          {showTools ? "Hide design tools" : "Design tools"}
        </button>

        {showTools && (
          <button
            className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={addFirstRoundMatch}
            title="Create a new Round 1 slot and persist it in the store"
          >
            + Add 1st-round match
          </button>
        )}
      </div>

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
                className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={addChildFromTwoParents}
                title="Create child in next round and connect both parents (and persist links)"
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
                className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={connectParentsToTarget}
                title="Connect selected parent(s) to target (and persist links)"
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
        onNodesChange={(nx) => setNodes(nx)}
        onConnectionsChange={setConnections}
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
                  onChange={(e) =>
                    setTeamsByNode((prev) => ({
                      ...prev,
                      [n.id]: { ...(prev[n.id] ?? { A: null, B: null }), A: e.target.value ? Number(e.target.value) : null },
                    }))
                  }
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
                  onChange={(e) =>
                    setTeamsByNode((prev) => ({
                      ...prev,
                      [n.id]: { ...(prev[n.id] ?? { A: null, B: null }), B: e.target.value ? Number(e.target.value) : null },
                    }))
                  }
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
                  className="px-2 py-1 rounded border border-white/15 text-xs hover:bg-white/10"
                  onClick={() => {
                    const m = nodeMeta[n.id];
                    if (!m) return;
                    const colW = 240, rowH = 130, x0 = 60, y0 = 60;
                    setNodes((prev) =>
                      prev.map((nb) =>
                        nb.id === n.id
                          ? { ...nb, x: (m.round - 1) * colW + x0, y: (m.bracket_pos - 1) * rowH + y0, label: `R${m.round} • Pos ${m.bracket_pos}` }
                          : nb
                      )
                    );
                  }}
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
