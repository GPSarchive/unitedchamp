// app/components/DashboardPageComponents/TournamentCURD/stages/KnockoutTree/FlowKOAdapter.tsx
"use client";

import { useMemo, useState } from "react";
import FlowPlayground, { type NodeBox } from "./FlowPlayground"; // your component
import type { DraftMatch } from "@/app/dashboard/components/TournamentCURD/TournamentWizard";

type TeamsMap = Record<number, { name: string }>;

function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K) {
  const m = new Map<K, T[]>();
  arr.forEach((t) => {
    const k = key(t);
    m.set(k, [...(m.get(k) ?? []), t]);
  });
  return m;
}

function bucketRoundsByX(nodes: NodeBox[], gap = 120) {
  // Sort by x; start a new column when the x-gap grows
  const sorted = nodes.slice().sort((a, b) => a.x - b.x);
  const cols: NodeBox[][] = [];
  for (const n of sorted) {
    const lastCol = cols[cols.length - 1];
    if (!lastCol || Math.abs(n.x - lastCol[0].x) > gap) cols.push([n]);
    else lastCol.push(n);
  }
  // Left→right: round 1..N, pos by y within the column
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

type Connection = [string, string];

export default function FlowKOAdapter({
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
  // Keep a sidecar "team selections" for each node (leaf teams)
  const [teamsByNode, setTeamsByNode] = useState<Record<string, { A: number | null; B: number | null }>>({});
  const [nodes, setNodes] = useState<NodeBox[]>([
    { id: "A", x: 60, y: 60, w: 140, h: 72, label: "Seed 1 vs Seed 8" },
    { id: "B", x: 60, y: 200, w: 140, h: 72, label: "Seed 4 vs Seed 5" },
    { id: "C", x: 300, y: 130, w: 140, h: 72, label: "SF" },
  ]);
  const [connections, setConnections] = useState<Connection[]>([
    ["A", "C"],
    ["B", "C"],
  ]);

  // -------- Import: build nodes/edges from current stage matches --------
  function loadFromStage() {
    const rows = draftMatches.filter((m) => m.stageIdx === stageIdx && (m.round ?? null) != null);
    if (!rows.length) return;

    // place nodes on a grid: x by round, y by bracket_pos
    const colW = 200;
    const rowH = 100;
    const nx: NodeBox[] = rows.map((m) => ({
      id: `R${m.round}-B${m.bracket_pos}`,
      x: ((m.round ?? 1) - 1) * colW + 60,
      y: ((m.bracket_pos ?? 1) - 1) * rowH + 60,
      w: 160,
      h: 72,
      label: `R${m.round} • Pos ${m.bracket_pos}`,
    }));

    const nodeByKey = new Map(nx.map((n) => [n.id, n]));
    const keyOf = (r?: number | null, b?: number | null) => (r && b ? `R${r}-B${b}` : null);

    const edges: Connection[] = [];
    rows.forEach((m) => {
      const toKey = keyOf(m.round ?? null, m.bracket_pos ?? null);
      if (!toKey) return;
      const homeKey = keyOf(m.home_source_round ?? null, m.home_source_bracket_pos ?? null);
      const awayKey = keyOf(m.away_source_round ?? null, m.away_source_bracket_pos ?? null);
      if (homeKey && nodeByKey.has(homeKey)) edges.push([homeKey, toKey]);
      if (awayKey && nodeByKey.has(awayKey)) edges.push([awayKey, toKey]);
    });

    // team assignments only for first-column matches
    const tbn: Record<string, { A: number | null; B: number | null }> = {};
    rows.forEach((m) => {
      const k = keyOf(m.round ?? null, m.bracket_pos ?? null);
      if (!k) return;
      tbn[k] = { A: m.team_a_id ?? null, B: m.team_b_id ?? null };
    });

    setNodes(nx);
    setConnections(edges);
    setTeamsByNode(tbn);
  }

  // -------- Export: convert flow → DraftMatch[] with stable pointers --------
  function pushToStage() {
    if (!nodes.length) return;

    const { roundOf, posOf } = bucketRoundsByX(nodes);

    // Collect pointers for each target node
    const ptr: Record<string, { home?: { r: number; p: number }; away?: { r: number; p: number } }> = {};
    connections.forEach(([from, to]) => {
      const r = roundOf.get(from);
      const p = posOf.get(from);
      if (!r || !p) return;
      const entry = (ptr[to] ??= {});
      if (!entry.home) entry.home = { r, p };
      else if (!entry.away) entry.away = { r, p };
      // (3rd+ incoming ignored; could validate)
    });

    // Build/replace only this stage’s KO rows
    const others = draftMatches.filter((m) => m.stageIdx !== stageIdx);
    const currentStageRows = draftMatches.filter((m) => m.stageIdx === stageIdx);

    const nextStageRows: DraftMatch[] = nodes.map((n) => {
      const r = roundOf.get(n.id) ?? 1;
      const b = posOf.get(n.id) ?? 1;
      const teams = teamsByNode[n.id] ?? { A: null, B: null };

      // Start with a clean KO match skeleton
      const row: DraftMatch = {
        stageIdx,
        round: r,
        bracket_pos: b,
        team_a_id: teams.A ?? null,
        team_b_id: teams.B ?? null,
        matchday: null,
        match_date: null,
      };

      // If this node has incoming links, write stable pointers (winner inputs)
      const p = ptr[n.id];
      if (p?.home) {
        row.home_source_round = p.home.r;
        row.home_source_bracket_pos = p.home.p;
        row.home_source_outcome = "W";
        // For non-first round nodes, clear direct team IDs; they’ll be filled by winners.
        row.team_a_id = null;
      }
      if (p?.away) {
        row.away_source_round = p.away.r;
        row.away_source_bracket_pos = p.away.p;
        row.away_source_outcome = "W";
        row.team_b_id = null;
      }

      return row;
    });

    // Keep rows sorted for a stable diff
    nextStageRows.sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0));

    onDraftChange([...others, ...nextStageRows]);
  }

  // Simple side panel for the selected first-round node (assign teams)
  const firstRoundNodes = useMemo(() => {
    const { roundOf } = bucketRoundsByX(nodes);
    const minRound = Math.min(...nodes.map((n) => roundOf.get(n.id) ?? 999)) || 1;
    return nodes.filter((n) => (roundOf.get(n.id) ?? 1) === minRound);
  }, [nodes]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded-md border border-white/15" onClick={loadFromStage}>
          Load from stage
        </button>
        <button className="px-3 py-1.5 rounded-md border border-emerald-400/40 bg-emerald-600/20" onClick={pushToStage}>
          Push to stage
        </button>
      </div>

      <FlowPlayground />

      {/* Minimal team assignment grid for first-round nodes */}
      <div className="grid md:grid-cols-2 gap-2">
        {firstRoundNodes.map((n) => (
          <div key={n.id} className="p-2 rounded-md border border-white/10 bg-black/30">
            <div className="text-sm text-white/80 mb-2">Node {n.id} — Team slots</div>
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
                    {teamsMap[id]?.name ?? `Team #${id}`}
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
                    {teamsMap[id]?.name ?? `Team #${id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
