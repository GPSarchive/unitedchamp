// app/tournaments/koStage/KoStageDisplay.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData";
import KOStageViewer from "./KOStageViewer";

// Types for knockout
export type DraftMatch = {
  db_id?: number | null;
  stageIdx: number;
  groupIdx?: number | null;
  bracket_pos?: number | null;
  matchday?: number | null;
  match_date?: string | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  round?: number | null;
  status?: "scheduled" | "finished" | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
};

type Connection = [string, string]; // From -> To
type NodeMeta = { round: number; bracket_pos: number };

interface NodeBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

const KOStageDisplay = () => {
  const tournament = useTournamentData((state) => state.tournament);
  const stages = useTournamentData((state) => state.stages);
  const teams = useTournamentData((state) => state.teams);
  const matches = useTournamentData((state) => state.matches);

  const [nodes, setNodes] = useState<NodeBox[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  const [teamsByNode, setTeamsByNode] = useState<
    Record<string, { A: number | null; B: number | null }>
  >({});

  const knockoutStageIdx = useMemo(
    () => stages?.findIndex((stage) => stage.kind === "knockout") ?? -1,
    [stages]
  );

  const knockoutMatches = useMemo(() => {
    if (knockoutStageIdx === -1) return [];
    return (matches ?? []).filter((match) => match.stageIdx === knockoutStageIdx);
  }, [knockoutStageIdx, matches]);

  // Spacing controls
  const SCALE = 1.5;          // single knob to spread everything out
  const BOX_W = 220;
  const BOX_H = 120;
  const COL_GAP = 240 * SCALE; // horizontal gap between rounds
  const BASE_GAP_Y = 140 * SCALE; // base vertical gap multiplier
  const X_MARGIN = 60 * SCALE;
  const Y_MARGIN = 60 * SCALE;

  const getYPosition = (round: number, bracket_pos: number) => {
    const spacing = BASE_GAP_Y * Math.pow(2, round - 1);
    const offset = spacing / 2;
    return Y_MARGIN + offset + (bracket_pos - 1) * spacing;
  };

  const loadFromStore = () => {
    const stageRows = knockoutMatches.filter(
      (m) => (m.round ?? null) != null && (m.bracket_pos ?? null) != null
    );

    if (!stageRows.length) {
      setNodes([]);
      setConnections([]);
      setNodeMeta({});
      setTeamsByNode({});
      return;
    }

    const nx: NodeBox[] = stageRows.map((m) => {
      const r = m.round ?? 1;
      const b = m.bracket_pos ?? 1;
      return {
        id: `R${r}-B${b}`,
        x: (r - 1) * COL_GAP + X_MARGIN,
        y: getYPosition(r, b),
        w: BOX_W,
        h: BOX_H,
        label: `R${r} • Pos ${b}`,
      };
    });

    const meta: Record<string, NodeMeta> = {};
    stageRows.forEach((m) => {
      const r = m.round ?? 1;
      const b = m.bracket_pos ?? 1;
      meta[`R${r}-B${b}`] = { round: r, bracket_pos: b };
    });

    const edges: Connection[] = [];
    stageRows.forEach((m) => {
      const toKey = `R${m.round}-B${m.bracket_pos}`;
      const homeKey =
        m.home_source_round && m.home_source_bracket_pos
          ? `R${m.home_source_round}-B${m.home_source_bracket_pos}`
          : null;
      const awayKey =
        m.away_source_round && m.away_source_bracket_pos
          ? `R${m.away_source_round}-B${m.away_source_bracket_pos}`
          : null;
      if (homeKey) edges.push([homeKey, toKey]);
      if (awayKey) edges.push([awayKey, toKey]);
    });

    const tbn: Record<string, { A: number | null; B: number | null }> = {};
    stageRows.forEach((m) => {
      const r = m.round ?? 1;
      const b = m.bracket_pos ?? 1;
      tbn[`R${r}-B${b}`] = { A: m.team_a_id ?? null, B: m.team_b_id ?? null };
    });

    setNodes(nx);
    setConnections(edges);
    setNodeMeta(meta);
    setTeamsByNode(tbn);
  };

  useEffect(() => {
    if (knockoutMatches.length > 0) loadFromStore();
  }, [knockoutMatches]);

  const getTeamName = (id: number | null) => {
    if (id == null) return "TBD";
    const team = teams?.find((t) => t.id === id);
    return team?.name ?? `Team #${id}`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-center text-white">Knockout Stage</h2>
      <div className="overflow-auto bg-zinc-950/60 p-4 rounded-2xl border border-white/10 shadow-lg">
        <KOStageViewer
          nodes={nodes}
          connections={connections}
          nodeContent={(n) => {
            const teamsNode = teamsByNode[n.id] ?? { A: null, B: null };
            const nameA = getTeamName(teamsNode.A);
            const nameB = getTeamName(teamsNode.B);
            const isFirstNode = n.id === "R1-B1";
            return (
              <div className="flex flex-col items-center justify-center gap-2 text-white h-full">
                {/* Logo Rings */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-400/40 bg-zinc-900/50 flex items-center justify-center">
                    <span className="text-xs text-amber-400/60">A</span>
                  </div>
                  <span className="text-xs text-orange-400/80 font-medium">vs</span>
                  <div className="w-10 h-10 rounded-full border-2 border-orange-400/40 bg-zinc-900/50 flex items-center justify-center">
                    <span className="text-xs text-orange-400/60">B</span>
                  </div>
                </div>
                {/* Team Names */}
                <div className="font-medium text-sm">
                  {nameA} vs {nameB}
                </div>
                {/* Tournament Name for R1-B1 */}
                {isFirstNode && tournament && (
                  <div className="text-xs text-amber-300/90 font-semibold mt-1">
                    {tournament.name} • Knockout Stage
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

export default KOStageDisplay;
