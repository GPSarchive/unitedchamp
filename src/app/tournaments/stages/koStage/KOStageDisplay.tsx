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
  const BASE_GAP_Y = 80 * SCALE; // base vertical gap multiplier
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

  const getTeamLogo = (id: number | null) => {
    if (id == null) return null;
    const team = teams?.find((t) => t.id === id);
    return team?.logo ?? null;
  };

  const getMatchInfo = (nodeId: string) => {
    const meta = nodeMeta[nodeId];
    if (!meta) return null;

    const match = knockoutMatches.find(
      m => m.round === meta.round && m.bracket_pos === meta.bracket_pos
    );
    return match;
  };

  return (
    <div className="space-y-6">
      <KOStageViewer
        nodes={nodes}
        connections={connections}
        nodeContent={(n) => {
          const teamsNode = teamsByNode[n.id] ?? { A: null, B: null };
          const nameA = getTeamName(teamsNode.A);
          const nameB = getTeamName(teamsNode.B);
          const logoA = getTeamLogo(teamsNode.A);
          const logoB = getTeamLogo(teamsNode.B);
          const match = getMatchInfo(n.id);
          const isFinished = match?.status === 'finished';

          return (
            <div className="h-full flex flex-col justify-center gap-1.5 px-1">
              {/* Team A */}
              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                isFinished && match?.winner_team_id === teamsNode.A
                  ? 'bg-[#FFD700]/20 border border-[#FFD700]/30'
                  : 'bg-white/[0.03] border border-white/5'
              }`}>
                {logoA && (
                  <img src={logoA} alt="" className="w-6 h-6 rounded-full object-cover" />
                )}
                <span className="flex-1 text-xs font-medium text-white truncate">{nameA}</span>
                {isFinished && (
                  <span className={`text-sm font-bold ${
                    match?.winner_team_id === teamsNode.A ? 'text-[#FFD700]' : 'text-white/40'
                  }`}>
                    {match?.team_a_score ?? 0}
                  </span>
                )}
              </div>

              {/* VS or Score */}
              <div className="text-center text-[10px] text-white/50 font-medium">
                {isFinished ? '' : 'vs'}
              </div>

              {/* Team B */}
              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                isFinished && match?.winner_team_id === teamsNode.B
                  ? 'bg-[#FFD700]/20 border border-[#FFD700]/30'
                  : 'bg-white/[0.03] border border-white/5'
              }`}>
                {logoB && (
                  <img src={logoB} alt="" className="w-6 h-6 rounded-full object-cover" />
                )}
                <span className="flex-1 text-xs font-medium text-white truncate">{nameB}</span>
                {isFinished && (
                  <span className={`text-sm font-bold ${
                    match?.winner_team_id === teamsNode.B ? 'text-[#FFD700]' : 'text-white/40'
                  }`}>
                    {match?.team_b_score ?? 0}
                  </span>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

export default KOStageDisplay;
