"use client";

import { useEffect, useMemo, useState } from "react";
import BracketEditor, { type NodeBox } from "./BracketEditor";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

type TeamsMap = Record<number | string, { name: string }>;
type Connection = [string, string];

type NodeMeta = { round: number; bracket_pos: number };

// ===== utilities =====
const nextId = (() => {
  let i = 1;
  return () => `N${i++}`;
})();

function sortByRoundPos(a: NodeMeta, b: NodeMeta) {
  return a.round - b.round || a.bracket_pos - b.bracket_pos;
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
    col.slice().sort((a, b) => a.y - b.y).forEach((n, j) => {
      roundOf.set(n.id, r);
      posOf.set(n.id, j + 1);
    });
  });
  return { roundOf, posOf };
}

/** Reindex KO local *_match_idx pointers from (round, bracket_pos). */
function wireKnockoutSourcesLocal(rows: DraftMatch[]) {
  const key = (r?: number | null, p?: number | null) => (r && p ? `${r}:${p}` : "");
  const idxOf = new Map<string, number>();
  const same = rows
    .slice()
    .sort(
      (a, b) =>
        (a.round ?? 0) - (b.round ?? 0) ||
        (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
    );
  same.forEach((m, i) => idxOf.set(key(m.round ?? null, m.bracket_pos ?? null), i));
  for (const m of rows) {
    const hk = key(m.home_source_round ?? null, m.home_source_bracket_pos ?? null);
    const ak = key(m.away_source_round ?? null, m.away_source_bracket_pos ?? null);
    const hIdx = hk ? idxOf.get(hk) : undefined;
    const aIdx = ak ? idxOf.get(ak) : undefined;
    if (typeof hIdx === "number") (m as any).home_source_match_idx = hIdx;
    else delete (m as any).home_source_match_idx;
    if (typeof aIdx === "number") (m as any).away_source_match_idx = aIdx;
    else delete (m as any).away_source_match_idx;
  }
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
    if (rFrom !== rTo - 1) return;
    const list = incoming.get(to) ?? [];
    if (list.length < 2) list.push({ from, r: rFrom, p: pFrom });
    incoming.set(to, list);
  });

  const ptr: Record<
    string,
    { home?: { r: number; p: number }; away?: { r: number; p: number } }
  > = {};
  for (const [to, list] of incoming) {
    const sorted = list.slice().sort((a, b) => a.p - b.p);
    if (sorted[0]) (ptr[to] ??= {}).home = { r: sorted[0].r, p: sorted[0].p };
    if (sorted[1]) (ptr[to] ??= {}).away = { r: sorted[1].r, p: sorted[1].p };
  }

  return { incoming, ptr, roundOfId, posOfId };
}

/* ------------------------------------------------------------------ */

export default function BracketCanvas({
  stageIdx,
  teamsMap,
  eligibleTeamIds,
  draftMatches,
  onDraftChange,
}: {
  stageIdx: number;
  teamsMap: TeamsMap;
  eligibleTeamIds: number[];
  draftMatches: DraftMatch[];
  onDraftChange: (next: DraftMatch[]) => void;
}) {
  // ===== canvas state =====
  const [nodes, setNodes] = useState<NodeBox[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  const [teamsByNode, setTeamsByNode] = useState<Record<string, { A: number | null; B: number | null }>>({});

  // selection controls
  const [selA, setSelA] = useState<string>("");
  const [selB, setSelB] = useState<string>("");
  const [target, setTarget] = useState<string>("");

  // layout preset + tools
  const [layoutPreset, setLayoutPreset] = useState<"grid-ltr" | "final-centered">("grid-ltr");
  const [showTools, setShowTools] = useState<boolean>(false);

  // ===== names =====
  const getTeamName = (id: number | null | undefined) => {
    if (id == null) return "—";
    const rec = (teamsMap as any)[id] ?? (teamsMap as any)[String(id)] ?? (teamsMap as any)[`${id}`];
    return rec?.name ?? `Team #${id}`;
  };

  // ===== import stage -> canvas =====
  function loadFromStage() {
    const rows = draftMatches.filter((m) => m.stageIdx === stageIdx && (m.round ?? null) != null);
    if (!rows.length) {
      const A = nextId(), B = nextId(), C = nextId();
      setNodes([
        { id: A, x: 60, y: 60, w: 170, h: 84, label: "Seed 1 vs 8" },
        { id: B, x: 60, y: 200, w: 170, h: 84, label: "Seed 4 vs 5" },
        { id: C, x: 300, y: 130, w: 190, h: 90, label: "SF" },
      ]);
      setConnections([[A, C], [B, C]]);
      setNodeMeta({
        [A]: { round: 1, bracket_pos: 1 },
        [B]: { round: 1, bracket_pos: 2 },
        [C]: { round: 2, bracket_pos: 1 },
      });
      setTeamsByNode({});
      return;
    }

    const colW = 220;
    const rowH = 110;
    const nx: NodeBox[] = rows.map((m) => ({
      id: `R${m.round}-B${m.bracket_pos}`,
      x: ((m.round ?? 1) - 1) * colW + 60,
      y: ((m.bracket_pos ?? 1) - 1) * rowH + 60,
      w: 190,
      h: 90,
      label: `R${m.round} • Pos ${m.bracket_pos}`,
    }));

    const meta: Record<string, NodeMeta> = {};
    rows.forEach((m) => {
      meta[`R${m.round}-B${m.bracket_pos}`] = {
        round: m.round ?? 1,
        bracket_pos: m.bracket_pos ?? 1,
      };
    });

    const keyOf = (r?: number | null, b?: number | null) => (r && b ? `R${r}-B${b}` : null);
    const edges: Connection[] = [];
    rows.forEach((m) => {
      const toKey = keyOf(m.round ?? null, m.bracket_pos ?? null);
      if (!toKey) return;
      const homeKey = keyOf(m.home_source_round ?? null, m.home_source_bracket_pos ?? null);
      const awayKey = keyOf(m.away_source_round ?? null, m.away_source_bracket_pos ?? null);
      if (homeKey) edges.push([homeKey, toKey]);
      if (awayKey) edges.push([awayKey, toKey]);
    });

    const tbn: Record<string, { A: number | null; B: number | null }> = {};
    rows.forEach((m) => {
      const k = keyOf(m.round ?? null, m.bracket_pos ?? null);
      if (!k) return;
      tbn[k] = { A: m.team_a_id ?? null, B: m.team_b_id ?? null };
    });

    setNodes(nx);
    setConnections(edges);
    setTeamsByNode(tbn);
    setNodeMeta(meta);
  }

  useEffect(() => {
    loadFromStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIdx, JSON.stringify(draftMatches)]);

  // ===== finished detection =====
  const finishedNodeIds = useMemo(() => {
    const isFinished = (m: DraftMatch | undefined) => {
      if (!m) return false;
      if ((m as any).status === "finished") return true;
      const scA = (m as any).team_a_score;
      const scB = (m as any).team_b_score;
      if (typeof scA === "number" || typeof scB === "number") return true;
      if ((m as any).winner_team_id != null) return true;
      return false;
    };
    const byKey = new Set<string>();
    draftMatches
      .filter((m) => m.stageIdx === stageIdx && (m.round ?? null) != null && (m.bracket_pos ?? null) != null)
      .forEach((m) => {
        const id = `R${m.round}-B${m.bracket_pos}`;
        if (isFinished(m)) byKey.add(id);
      });
    return byKey;
  }, [draftMatches, stageIdx]);

  // ===== export canvas -> stage =====
  function pushToStage() {
    if (!nodes.length) return;

    const { ptr, roundOfId, posOfId } = computePointers({ nodes, connections, meta: nodeMeta });
    const others = draftMatches.filter((m) => m.stageIdx !== stageIdx);

    const rows: DraftMatch[] = nodes
      .slice()
      .sort((a, b) => {
        const ra = roundOfId(a.id);
        const rb = roundOfId(b.id);
        const pa = posOfId(a.id);
        const pb = posOfId(b.id);
        return ra - rb || pa - pb;
      })
      .map((n) => {
        const r = roundOfId(n.id);
        const p = posOfId(n.id);
        const teams = teamsByNode[n.id] ?? { A: null, B: null };
        const row: DraftMatch = {
          stageIdx,
          round: r,
          bracket_pos: p,
          team_a_id: teams.A ?? null,
          team_b_id: teams.B ?? null,
          matchday: null,
          match_date: null,
        };
        const pptr = (ptr as any)[n.id] as
          | { home?: { r: number; p: number }; away?: { r: number; p: number } }
          | undefined;

        if (pptr?.home) {
          row.home_source_round = pptr.home.r;
          row.home_source_bracket_pos = pptr.home.p;
          row.home_source_outcome = "W";
          row.team_a_id = null;
        }
        if (pptr?.away) {
          row.away_source_round = pptr.away.r;
          row.away_source_bracket_pos = pptr.away.p;
          row.away_source_outcome = "W";
          row.team_b_id = null;
        }
        return row;
      });

    wireKnockoutSourcesLocal(rows);
    onDraftChange([...others, ...rows]);
  }

  // ===== node content (names or winners) =====
  const incomingBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [from, to] of connections) m.set(to, [...(m.get(to) ?? []), from]);
    return m;
  }, [connections]);

  const nodeContent = (n: NodeBox) => {
    const incoming = incomingBy.get(n.id) ?? [];
    const picks = teamsByNode[n.id];
    const line =
      incoming.length === 0
        ? `${getTeamName(picks?.A)} vs ${getTeamName(picks?.B)}`
        : (() => {
            const describe = (srcId: string) => {
              const t = teamsByNode[srcId];
              if (t?.A || t?.B) return `W(${getTeamName(t?.A)} vs ${getTeamName(t?.B)})`;
              const meta = nodeMeta[srcId];
              return meta ? `Winner R${meta.round}-B${meta.bracket_pos}` : `Winner of ${srcId}`;
            };
            const L = incoming[0] ? describe(incoming[0]) : "—";
            const R = incoming[1] ? describe(incoming[1]) : "—";
            return `${L} vs ${R}`;
          })();

    const meta = nodeMeta[n.id];
    const tag = meta ? `Round ${meta.round} • B${meta.bracket_pos}` : n.id;

    const finished = finishedNodeIds.has(n.id);

    return (
      <>
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium truncate" title={line}>
            {line}
          </div>
          {finished && (
            <span
              className="inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px]
                         font-semibold uppercase tracking-wide
                         bg-gradient-to-r from-red-600/80 to-amber-500/80 text-white
                         ring-1 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]"
              title="Match finished"
            >
              Finished
            </span>
          )}
        </div>
        <div className="mt-auto text-[11px] text-white/70">{tag}</div>
      </>
    );
  };

  // ===== first round nodes =====
  const firstRoundNodes = useMemo(() => {
    const rs = Object.values(nodeMeta).map((m) => m.round);
    const min = rs.length ? Math.min(...rs) : 1;
    return nodes.filter((n) => (nodeMeta[n.id]?.round ?? 999) === min);
  }, [nodes, nodeMeta]);

  // ===== toolbar actions =====
  const nodeOptions = useMemo(
    () =>
      nodes
        .slice()
        .sort((a, b) => {
          const A = nodeMeta[a.id];
          const B = nodeMeta[b.id];
          if (A && B) return sortByRoundPos(A, B);
          return a.id.localeCompare(b.id);
        })
        .map((n) => {
          const m = nodeMeta[n.id];
          const label = m ? `R${m.round}-B${m.bracket_pos} (${n.id})` : n.id;
          return { id: n.id, label };
        }),
    [nodes, nodeMeta]
  );

  function addFirstRoundMatch() {
    const round = 1;
    const used = Object.values(nodeMeta).filter((m) => m.round === round).map((m) => m.bracket_pos);
    const nextPos = used.length === 0 ? 1 : Math.max(...used) + 1;

    const id = nextId();
    const x = 60;
    const y = 60 + (nextPos - 1) * 110;

    setNodes((prev) => [...prev, { id, x, y, w: 190, h: 90, label: `R1 • Pos ${nextPos}` }]);
    setNodeMeta((prev) => ({ ...prev, [id]: { round, bracket_pos: nextPos } }));
  }

  function addChildFromTwoParents() {
    if (!selA || !selB) return;
    if (selA === selB) return;
    const A = nodeMeta[selA];
    const B = nodeMeta[selB];
    if (!A || !B) return;
    if (A.round !== B.round) return alert("Parents must be in the same round.");

    const round = A.round + 1;
    const base = Math.min(A.bracket_pos, B.bracket_pos);
    const bracket_pos = Math.floor((base + 1) / 2);

    const id = nextId();
    const x = (round - 1) * 220 + 60;
    const y = (bracket_pos - 1) * 110 + 60;

    setNodes((prev) => [...prev, { id, x, y, w: 200, h: 94, label: `R${round} • Pos ${bracket_pos}` }]);
    setNodeMeta((prev) => ({ ...prev, [id]: { round, bracket_pos } }));
    setConnections((prev) => [...prev, [selA, id], [selB, id]]);
    setTarget(id);
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
        return alert("Each parent must be in the previous round of the target.");
      }
    }
    const already = connections.filter(([, to]) => to === target).length;
    if (already + conns.length > 2) return alert("A KO match can have at most 2 parents.");

    setConnections((prev) => [...prev, ...conns]);
  }

  function removeNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter(([a, b]) => a !== id && b !== id));
    setTeamsByNode((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setNodeMeta((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    if (selA === id) setSelA("");
    if (selB === id) setSelB("");
    if (target === id) setTarget("");
  }

  function reflowFromMeta() {
    const colW = 220, rowH = 110, x0 = 60, y0 = 60;
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

  function applyBalancedPreset(bracketSize: 4 | 8 | 16 | 32) {
    const rounds = Math.ceil(Math.log2(bracketSize));
    const colW = 220, rowH = 110, x0 = 60, y0 = 60;

    const nx: NodeBox[] = [];
    const meta: Record<string, NodeMeta> = {};
    const tbn: Record<string, { A: number | null; B: number | null }> = {};
    const edges: Connection[] = [];

    const mk = (round: number, pos: number) => {
      const id = `R${round}-B${pos}`;
      nx.push({
        id, x: (round - 1) * colW + x0, y: (pos - 1) * rowH + y0, w: 200, h: 94,
        label: `R${round} • Pos ${pos}`,
      });
      meta[id] = { round, bracket_pos: pos };
      if (round === 1) tbn[id] = { A: null, B: null };
      return id;
    };

    for (let p = 1; p <= bracketSize / 2; p++) mk(1, p);

    for (let r = 2; r <= rounds; r++) {
      const count = Math.pow(2, rounds - r);
      for (let p = 1; p <= count; p++) {
        const id = mk(r, p);
        const aPos = (p * 2 - 1);
        thead: // keep TS calm
        0;
        const bPos = (p * 2);
        const fromA = `R${r - 1}-B${aPos}`;
        const fromB = `R${r - 1}-B${bPos}`;
        edges.push([fromA, id], [fromB, id]);
      }
    }

    setNodes(nx);
    setNodeMeta(meta);
    setConnections(edges);
    setTeamsByNode(tbn);
  }

  function applyLayoutPreset() {
    if (!nodes.length) return;
    const opts = { colW: 220, rowH: 110, x0: 60, y0: 60 };
    const next =
      layoutPreset === "final-centered"
        ? layoutFinalCentered(nodes, nodeMeta, opts as any)
        : layoutGridLTR(nodes, nodeMeta, opts as any);
    setNodes(next);
  }

  // ===== UI =====
  return (
    <div className="space-y-3">
      {/* Top row: stage buttons + toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="px-3 py-1.5 rounded-md border border-red-500/40
                     bg-gradient-to-r from-red-700/40 to-amber-600/30
                     text-white hover:from-red-600/50 hover:to-amber-500/40
                     ring-1 ring-white/10"
          onClick={loadFromStage}
        >
          Load from stage
        </button>

        <button
          className="px-3 py-1.5 rounded-md border border-amber-500/50
                     bg-gradient-to-r from-red-600/70 to-amber-500/70
                     text-white font-semibold shadow
                     hover:from-red-500/80 hover:to-amber-400/80
                     ring-1 ring-white/10"
          onClick={pushToStage}
          title="Apply design to the stage matches"
        >
          Push to stage
        </button>

        <button
          className="px-3 py-1.5 rounded-md border border-white/15
                     bg-white/5 text-white hover:bg-white/10"
          onClick={() => setShowTools((s) => !s)}
          title="Show/hide knockout designer tools"
        >
          {showTools ? "Hide design tools" : "Design tools"}
        </button>
      </div>

      {/* Collapsible designer panel */}
      {showTools && (
        <div className="rounded-xl border border-white/10
                        bg-gradient-to-br from-black/50 via-red-950/30 to-amber-900/20
                        p-3 space-y-2 shadow-inner">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={addFirstRoundMatch}
            >
              + Add 1st-round match
            </button>

            <div className="flex items-center gap-1">
              <select
                className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                value={selA}
                onChange={(e) => setSelA(e.target.value)}
              >
                <option value="">Parent A…</option>
                {nodeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <select
                className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                value={selB}
                onChange={(e) => setSelB(e.target.value)}
              >
                <option value="">Parent B…</option>
                {nodeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <button
                className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={addChildFromTwoParents}
                title="Create child in next round and connect both parents"
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
                {nodeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <button
                className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={connectParentsToTarget}
                title="Connect selected parent(s) to target"
              >
                Connect → Target
              </button>
              {target && (
                <button
                  className="px-3 py-1.5 rounded-md border border-red-500/40 text-red-200 hover:bg-red-500/10"
                  onClick={() => removeNode(target)}
                  title="Remove target node"
                >
                  Remove target
                </button>
              )}
            </div>

            <span className="mx-2 h-5 w-px bg-white/10" />

            <button
              className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={reflowFromMeta}
            >
              Reflow from meta
            </button>

            <div className="flex items-center gap-1">
              <span className="text-white/60 text-xs">Layout:</span>
              <select
                className="px-2 py-1 rounded bg-zinc-900 text-white border border-white/10"
                value={layoutPreset}
                onChange={(e) => setLayoutPreset(e.target.value as "grid-ltr" | "final-centered")}
                title="Choose an auto-layout algorithm"
              >
                <option value="grid-ltr">Grid (L→R)</option>
                <option value="final-centered">Final centered (mirrored)</option>
              </select>
              <button
                className="px-2 py-1 rounded-md border border-white/15 text-xs hover:bg-white/10"
                onClick={applyLayoutPreset}
                title="Apply layout to current nodes"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <BracketEditor
        nodes={nodes}
        connections={connections}
        onNodesChange={(nx) => setNodes(nx)}
        onConnectionsChange={setConnections}
        nodeContent={nodeContent}
        isFinished={(id) => finishedNodeIds.has(id)}
        snap={10}
      />

      {/* First-round pickers */}
      <div className="grid md:grid-cols-2 gap-2">
        {firstRoundNodes.map((n) => (
          <div
            key={n.id}
            className="p-2 rounded-md border border-white/10
                       bg-gradient-to-br from-red-950/40 to-amber-900/20"
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
                {eligibleTeamIds.map((id) => (
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
                {eligibleTeamIds.map((id) => (
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
                  const colW = 220, rowH = 110, x0 = 60, y0 = 60;
                  setNodes((prev) =>
                    prev.map((nb) =>
                      nb.id === n.id
                        ? {
                            ...nb,
                            x: (m.round - 1) * colW + x0,
                            y: (m.bracket_pos - 1) * rowH + y0,
                            label: `R${m.round} • Pos ${m.bracket_pos}`,
                          }
                        : nb
                    )
                  );
                }}
              >
                Apply pos
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Layout helpers ------------------------- */
type RoundsMap = Record<number, string[]>;
function computeRounds(nodes: NodeBox[], meta: Record<string, NodeMeta>) {
  const { roundOf, posOf } = bucketRoundsByX(nodes);
  const rounds: RoundsMap = {};
  nodes.forEach((n) => {
    const r = meta[n.id]?.round ?? roundOf.get(n.id) ?? 1;
    (rounds[r] ??= []).push(n.id);
  });
  const maxRound = Math.max(1, ...Object.keys(rounds).map((k) => Number(k)));
  Object.entries(rounds).forEach(([rk, arr]) => {
    arr.sort((a, b) => {
      const pa = meta[a]?.bracket_pos ?? posOf.get(a) ?? nodes.find((n) => n.id === a)?.y ?? 0;
      const pb = meta[b]?.bracket_pos ?? posOf.get(b) ?? nodes.find((n) => n.id === b)?.y ?? 0;
      return pa - pb;
    });
  });
  return { rounds, maxRound };
}
function placeEvenY(ids: string[], y0: number, rowH: number): Record<string, number> {
  const y: Record<string, number> = {};
  ids.forEach((id, i) => (y[id] = y0 + i * rowH));
  return y;
}
function layoutGridLTR(nodes: NodeBox[], meta: Record<string, NodeMeta>, { colW = 220, rowH = 110, x0 = 60, y0 = 60 } = {}) {
  const { rounds } = computeRounds(nodes, meta);
  const nx = nodes.map((n) => ({ ...n }));
  const byId = new Map(nx.map((n) => [n.id, n]));
  Object.entries(rounds).forEach(([rk, ids]) => {
    const r = Number(rk);
    const ys = placeEvenY(ids, y0, rowH);
    ids.forEach((id) => {
      const nb = byId.get(id)!;
      nb.x = (r - 1) * colW + x0;
      nb.y = ys[id];
      const m = meta[id];
      nb.label = m ? `R${m.round} • Pos ${m.bracket_pos}` : nb.label ?? id;
    });
  });
  return nx;
}
function layoutFinalCentered(nodes: NodeBox[], meta: Record<string, NodeMeta>, { colW = 220, rowH = 110, x0 = 60, y0 = 60 } = {}) {
  const { rounds, maxRound: R } = computeRounds(nodes, meta);
  const nx = nodes.map((n) => ({ ...n }));
  const byId = new Map(nx.map((n) => [n.id, n]));
  const centerX = (R - 1) * colW + x0;
  for (let r = 1; r <= R; r++) {
    const ids = (rounds[r] ?? []).slice();
    if (r === R) {
      const ys = placeEvenY(ids, y0, rowH);
      ids.forEach((id) => {
        const nb = byId.get(id)!;
        nb.x = centerX;
        nb.y = ys[id];
        const m = meta[id];
        nb.label = m ? `R${m.round} • Pos ${m.bracket_pos}` : nb.label ?? id;
      });
      continue;
    }
    const half = Math.floor(ids.length / 2);
    const left = ids.slice(0, half);
    const right = ids.slice(half);
    const k = R - r;
    const xLeft = centerX - k * colW;
    const xRight = centerX + k * colW;
    const ysL = placeEvenY(left, y0, rowH);
    const ysR = placeEvenY(right, y0, rowH);
    left.forEach((id) => {
      const nb = byId.get(id)!;
      nb.x = xLeft;
      nb.y = ysL[id];
      const m = meta[id];
      nb.label = m ? `R${m.round} • Pos ${m.bracket_pos}` : nb.label ?? id;
    });
    right.forEach((id) => {
      const nb = byId.get(id)!;
      nb.x = xRight;
      nb.y = ysR[id];
      const m = meta[id];
      nb.label = m ? `R${m.round} • Pos ${m.bracket_pos}` : nb.label ?? id;
    });
  }
  return nx;
}
