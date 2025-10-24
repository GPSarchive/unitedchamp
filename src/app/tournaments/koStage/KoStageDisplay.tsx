"use client";

import { useState, useEffect, useMemo } from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData";
import KOStageViewer from "./KOStageViewer"; // Import the viewer component
import { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { NodeBox } from "@/app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/newknockout/BracketEditor";

// Types for knockout
type Connection = [string, string]; // From -> To
type NodeMeta = { round: number; bracket_pos: number };

const KOStageDisplay = () => {
  const { stages, teams, matches } = useTournamentData();

  const [nodes, setNodes] = useState<NodeBox[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  const [teamsByNode, setTeamsByNode] = useState<Record<string, { A: number | null; B: number | null }>>({});

  // Memoize the KO stage data
  const knockoutMatches = useMemo(() => {
    const knockoutStage = stages?.find((stage) => stage.kind === "knockout");
    if (!knockoutStage) return [];

    const matchesForStage = matches?.filter((match) => match.stage_id === knockoutStage.id) ?? [];

    console.log('Knockout matches for the stage:', matchesForStage);  // Log the matches for debugging

    return matchesForStage.map((match) => ({
      ...match,
      stageIdx: match.stage_id,
      round: match.round ?? null,
      bracket_pos: match.bracket_pos ?? null,
      home_source_round: match.home_source_round ?? null,
      home_source_bracket_pos: match.home_source_bracket_pos ?? null,
      away_source_round: match.away_source_round ?? null,
      away_source_bracket_pos: match.away_source_bracket_pos ?? null,
    })) as DraftMatch[];
  }, [stages, matches]);

  useEffect(() => {
    const createBracketLayout = () => {
      const nodes: NodeBox[] = [];
      const connections: Connection[] = [];
      const nodeMeta: Record<string, NodeMeta> = {};
      const teamsByNode: Record<string, { A: number | null; B: number | null }> = {};
    
      // Define the knockout rounds and the number of matches in each round
      const rounds = [
        { round: 1, numMatches: 4, verticalSpacing: 130, horizontalSpacing: 240 }, // Round 1: 4 matches
        { round: 2, numMatches: 2, verticalSpacing: 200, horizontalSpacing: 320 }, // Round 2: 2 matches, more horizontal spacing
        { round: 3, numMatches: 1, verticalSpacing: 300, horizontalSpacing: 400 }, // Round 3: 1 match (final)
      ];
    
      let bracketPositionCounter = 1;
    
      rounds.forEach(({ round, numMatches, verticalSpacing, horizontalSpacing }) => {
        const bracketPositions = Array.from({ length: numMatches }, (_, i) => i + 1);
    
        bracketPositions.forEach((bracket_pos) => {
          const id = `R${round}-B${bracket_pos}`;
    
          // For each round, create nodes (matches) with correct positioning
          const xPosition = (round - 1) * horizontalSpacing + 60; // Horizontal position for each round
          let yPosition;
    
          // Calculate the vertical position to ensure matches are in between their parents
          if (round === 1) {
            yPosition = (bracket_pos - 1) * verticalSpacing + 60; // First round
          } else {
            yPosition = (bracket_pos - 1) * verticalSpacing + 60 + (verticalSpacing / 2); // Subsequent rounds in between
          }
    
          nodes.push({
            id,
            x: xPosition, // Set the horizontal position based on the round
            y: yPosition, // Set the vertical position based on the bracket position
            w: 220,
            h: 120,
            label: `R${round} • Pos ${bracket_pos}`,
          });
    
          nodeMeta[id] = { round, bracket_pos };
    
          if (round === 1 && teams) {
            // Round 1: Assign teams to nodes
            const teamA = teams[bracket_pos * 2 - 2];  // Assign team A
            const teamB = teams[bracket_pos * 2 - 1];  // Assign team B
            teamsByNode[id] = { A: teamA?.id ?? null, B: teamB?.id ?? null };
          } else if (round > 1) {
            // Round 2 and 3: Connect previous round's winners
            const homeKey = `R${round - 1}-B${bracket_pos * 2 - 1}`; // Home node (winner of previous round)
            const awayKey = `R${round - 1}-B${bracket_pos * 2}`; // Away node (winner of previous round)
            if (homeKey) connections.push([homeKey, id]);
            if (awayKey) connections.push([awayKey, id]);
          }
        });
      });
    
      setNodes(nodes);
      setConnections(connections);
      setNodeMeta(nodeMeta);
      setTeamsByNode(teamsByNode); // Save team assignments to nodes
    };
    
    

  if (teams) {
    createBracketLayout();
  }
}, [teams]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-center text-white">Knockout Stage</h2>
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
