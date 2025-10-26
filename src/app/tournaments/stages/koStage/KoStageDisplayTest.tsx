"use client";

import { useState, useEffect, useMemo } from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData"; // Import Zustand hook
import KOStageViewer from "./KOStageViewer"; // Import the viewer component

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
  home_source_match_idx?: number | null;
  away_source_match_idx?: number | null;
  home_source_outcome?: "W" | "L" | null;
  away_source_outcome?: "W" | "L" | null;
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
  // Fetch stages, teams, and matches from Zustand using separate selectors to avoid new object references
  const stages = useTournamentData((state) => state.stages);
  const teams = useTournamentData((state) => state.teams);
  const matches = useTournamentData((state) => state.matches);

  const [nodes, setNodes] = useState<NodeBox[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  const [teamsByNode, setTeamsByNode] = useState<Record<string, { A: number | null; B: number | null }>>({});

  // Memoize knockout matches to prevent unnecessary re-calculations
  const knockoutMatches = useMemo(() => {
    const knockoutStage = stages?.find((stage) => stage.kind === "knockout");
    if (!knockoutStage) return [];

    return matches?.filter((match) => match.stageIdx === knockoutStage.id) ?? [];
  }, [stages, matches]);

  // Function to generate the knockout bracket layout
  const createBracketLayout = () => {
    // Perform the bracket layout only if nodes haven't been set yet
    if (nodes.length > 0) return;

    const newNodes: NodeBox[] = [];
    const newConnections: Connection[] = [];
    const newNodeMeta: Record<string, NodeMeta> = {};
    const newTeamsByNode: Record<string, { A: number | null; B: number | null }> = {};

    const rounds = [
      { round: 1, numMatches: 4, verticalSpacing: 130, horizontalSpacing: 240 }, // Round 1: 4 matches
      { round: 2, numMatches: 2, verticalSpacing: 200, horizontalSpacing: 320 }, // Round 2: 2 matches, more horizontal spacing
      { round: 3, numMatches: 1, verticalSpacing: 300, horizontalSpacing: 400 }, // Round 3: 1 match (final)
    ];

    rounds.forEach(({ round, numMatches, verticalSpacing, horizontalSpacing }) => {
      const bracketPositions = Array.from({ length: numMatches }, (_, i) => i + 1);

      bracketPositions.forEach((bracket_pos) => {
        const id = `R${round}-B${bracket_pos}`;
        const xPosition = (round - 1) * horizontalSpacing + 60;

        let yPosition;
        if (round === 1) {
          yPosition = (bracket_pos - 1) * verticalSpacing + 60;
        } else {
          yPosition = (bracket_pos - 1) * verticalSpacing + 60 + verticalSpacing / 2;
        }

        newNodes.push({
          id,
          x: xPosition,
          y: yPosition,
          w: 220,
          h: 120,
          label: `R${round} • Pos ${bracket_pos}`,
        });

        newNodeMeta[id] = { round, bracket_pos };

        if (round === 1 && teams) {
          // Round 1: Assign teams to nodes
          const teamA = teams[bracket_pos * 2 - 2];
          const teamB = teams[bracket_pos * 2 - 1];
          newTeamsByNode[id] = { A: teamA?.id ?? null, B: teamB?.id ?? null };
        } else if (round > 1) {
          // Round 2 and 3: Connect previous round's winners
          const homeKey = `R${round - 1}-B${bracket_pos * 2 - 1}`;
          const awayKey = `R${round - 1}-B${bracket_pos * 2}`;
          if (homeKey) newConnections.push([homeKey, id]);
          if (awayKey) newConnections.push([awayKey, id]);
        }
      });
    });

    setNodes(newNodes);
    setConnections(newConnections);
    setNodeMeta(newNodeMeta);
    setTeamsByNode(newTeamsByNode);
  };

  // Initialize the layout when data is ready (useEffect)
  useEffect(() => {
    if (teams && knockoutMatches.length > 0) {
      createBracketLayout();
    }
  }, [teams, knockoutMatches]); // Trigger layout creation only when `teams` or `knockoutMatches` change
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-center text-black">Knockout Stage</h2>
      <div className="overflow-auto bg-black p-4 rounded-lg shadow-lg">
        <KOStageViewer
          nodes={nodes}
          connections={connections}
          nodeContent={(n) => {
            const teamA = teams?.find((team) => team.id === teamsByNode[n.id]?.A);
            const teamB = teams?.find((team) => team.id === teamsByNode[n.id]?.B);
            return (
              <div className="text-center text-white">
                <div>{teamA?.name ?? "TBD"} vs {teamB?.name ?? "TBD"}</div>
                <div className="text-xs text-gray-400">Round {nodeMeta[n.id]?.round} • Pos {nodeMeta[n.id]?.bracket_pos}</div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

export default KOStageDisplay;