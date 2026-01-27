// app/tournaments/koStage/KoStageDisplay.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTournamentData, type Stage } from "@/app/tournaments/useTournamentData";
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

type MatchNodeData = {
  teamA: number | null;
  teamB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  status: "scheduled" | "finished" | null;
  winnerId: number | null;
};

const KOStageDisplay = ({ stage }: { stage: Stage }) => {
  const tournament = useTournamentData((state) => state.tournament);
  const teams = useTournamentData((state) => state.teams);
  const matches = useTournamentData((state) => state.matches);
  const ids = useTournamentData((state) => state.ids);

  const [nodes, setNodes] = useState<NodeBox[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  const [matchData, setMatchData] = useState<Record<string, MatchNodeData>>({});

  const knockoutStageIdx = useMemo(
    () => ids.stageIndexById[stage.id] ?? -1,
    [ids.stageIndexById, stage.id]
  );

  const knockoutMatches = useMemo(() => {
    if (knockoutStageIdx === -1) return [];
    return (matches ?? []).filter((match) => match.stageIdx === knockoutStageIdx);
  }, [knockoutStageIdx, matches]);

  // Bigger cards for the new design
  const SCALE = 1.5;
  const BOX_W = 300;
  const BOX_H = 160;
  const COL_GAP = 300 * SCALE;
  const BASE_GAP_Y = 160 * SCALE;
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
      setMatchData({});
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
        label: tournament?.name ? `${tournament.name} • ${stage.name}` : stage.name,
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

    const md: Record<string, MatchNodeData> = {};
    stageRows.forEach((m) => {
      const r = m.round ?? 1;
      const b = m.bracket_pos ?? 1;
      md[`R${r}-B${b}`] = {
        teamA: m.team_a_id ?? null,
        teamB: m.team_b_id ?? null,
        scoreA: m.team_a_score ?? null,
        scoreB: m.team_b_score ?? null,
        status: m.status ?? null,
        winnerId: m.winner_team_id ?? null,
      };
    });

    setNodes(nx);
    setConnections(edges);
    setNodeMeta(meta);
    setMatchData(md);
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

  return (
    <KOStageViewer
      nodes={nodes}
      connections={connections}
      nodeContent={(n) => {
        const data = matchData[n.id];
        if (!data) return null;

        const { teamA, teamB, scoreA, scoreB, status, winnerId } = data;
        const nameA = getTeamName(teamA);
        const nameB = getTeamName(teamB);
        const logoA = getTeamLogo(teamA);
        const logoB = getTeamLogo(teamB);
        const isFinished = status === "finished";
        const aWon = isFinished && winnerId != null && winnerId === teamA;
        const bWon = isFinished && winnerId != null && winnerId === teamB;

        return (
          <div className="flex flex-col h-full justify-center gap-0.5 px-1">
            {/* Team A row */}
            <TeamRow
              logo={logoA}
              name={nameA}
              score={isFinished ? scoreA : null}
              isWinner={aWon}
              isTBD={teamA == null}
            />

            {/* Divider */}
            <div className="mx-2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            {/* Team B row */}
            <TeamRow
              logo={logoB}
              name={nameB}
              score={isFinished ? scoreB : null}
              isWinner={bWon}
              isTBD={teamB == null}
            />

            {/* Status badge */}
            {isFinished ? (
              <div className="mt-0.5 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
                  FT
                </span>
              </div>
            ) : (
              <div className="mt-0.5 text-center">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                  vs
                </span>
              </div>
            )}
          </div>
        );
      }}
    />
  );
};

/* ── Team Row sub-component ── */

function TeamRow({
  logo,
  name,
  score,
  isWinner,
  isTBD,
}: {
  logo: string | null;
  name: string;
  score: number | null;
  isWinner: boolean;
  isTBD: boolean;
}) {
  return (
    <div
      className={`
        flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors
        ${isWinner ? "bg-emerald-500/10" : ""}
      `}
    >
      {/* Logo */}
      {logo ? (
        <img
          src={logo}
          alt={name}
          className={`
            h-9 w-9 shrink-0 rounded-full object-cover border-2
            ${isWinner ? "border-emerald-400/60 shadow-md shadow-emerald-500/20" : "border-white/15"}
          `}
        />
      ) : (
        <div
          className={`
            flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2
            ${isTBD ? "border-white/10 bg-white/5" : "border-white/15 bg-zinc-800/60"}
          `}
        >
          <span className="text-[10px] font-bold text-white/30">
            {isTBD ? "?" : name.charAt(0)}
          </span>
        </div>
      )}

      {/* Name */}
      <span
        className={`
          flex-1 truncate text-sm font-semibold
          ${isWinner ? "text-white" : isTBD ? "text-white/25 italic" : "text-white/70"}
        `}
      >
        {name}
      </span>

      {/* Score */}
      {score != null && (
        <span
          className={`
            min-w-[28px] shrink-0 rounded-md py-0.5 text-center text-base font-black tabular-nums
            ${isWinner
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-white/5 text-white/50"
            }
          `}
        >
          {score}
        </span>
      )}
    </div>
  );
}

export default KOStageDisplay;
