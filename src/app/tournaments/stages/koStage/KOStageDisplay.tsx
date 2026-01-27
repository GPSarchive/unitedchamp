// File: KOStageDisplay.tsx — Elegant sporty knockout bracket with big match cards & scores

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

type Connection = [string, string];
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
  status: string | null;
  winnerId: number | null;
  matchDate: string | null;
};

/* ────────────────────────────────────────────────────────────────── */
/*  Round label helper                                                */
/* ────────────────────────────────────────────────────────────────── */

function getRoundLabel(round: number, maxRound: number): string {
  const diff = maxRound - round;
  if (diff === 0) return "Final";
  if (diff === 1) return "Semi-Finals";
  if (diff === 2) return "Quarter-Finals";
  return `Round of ${Math.pow(2, maxRound - round + 1)}`;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Main component                                                    */
/* ────────────────────────────────────────────────────────────────── */

const KOStageDisplay = ({ stage }: { stage: Stage }) => {
  const tournament = useTournamentData((s) => s.tournament);
  const teams = useTournamentData((s) => s.teams);
  const matches = useTournamentData((s) => s.matches);
  const ids = useTournamentData((s) => s.ids);

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
    return (matches ?? []).filter((m) => m.stageIdx === knockoutStageIdx);
  }, [knockoutStageIdx, matches]);

  // ── Layout constants — big, spacious cards ──
  const SCALE = 1.6;
  const BOX_W = 320;
  const BOX_H = 170;
  const COL_GAP = 340 * SCALE;
  const BASE_GAP_Y = 170 * SCALE;
  const X_MARGIN = 80 * SCALE;
  const Y_MARGIN = 80 * SCALE;

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

    const maxRound = Math.max(...stageRows.map((m) => m.round ?? 1));

    const nx: NodeBox[] = stageRows.map((m) => {
      const r = m.round ?? 1;
      const b = m.bracket_pos ?? 1;
      return {
        id: `R${r}-B${b}`,
        x: (r - 1) * COL_GAP + X_MARGIN,
        y: getYPosition(r, b),
        w: BOX_W,
        h: BOX_H,
        label: getRoundLabel(r, maxRound),
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
        matchDate: m.match_date ?? null,
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

        const { teamA, teamB, scoreA, scoreB, status, winnerId, matchDate } = data;
        const nameA = getTeamName(teamA);
        const nameB = getTeamName(teamB);
        const logoA = getTeamLogo(teamA);
        const logoB = getTeamLogo(teamB);
        const isFinished = status === "finished";
        const aWon = isFinished && winnerId != null && winnerId === teamA;
        const bWon = isFinished && winnerId != null && winnerId === teamB;

        return (
          <div className="flex flex-col h-full">
            {/* Card header — round label + status */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                {n.label}
              </span>
              {isFinished ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  FT
                </span>
              ) : matchDate ? (
                <span className="text-[10px] text-white/30 font-medium">
                  {new Date(matchDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              ) : (
                <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider">
                  Scheduled
                </span>
              )}
            </div>

            {/* Match body */}
            <div className="flex-1 flex flex-col justify-center gap-1 px-1.5 py-1.5">
              {/* Team A */}
              <TeamRow
                logo={logoA}
                name={nameA}
                score={isFinished ? scoreA : null}
                isWinner={aWon}
                isLoser={isFinished && !aWon && winnerId != null}
                isTBD={teamA == null}
              />

              {/* Separator */}
              <div className="relative mx-3">
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                {!isFinished && (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 px-2 text-[9px] font-bold uppercase tracking-widest text-white/20">
                    vs
                  </span>
                )}
              </div>

              {/* Team B */}
              <TeamRow
                logo={logoB}
                name={nameB}
                score={isFinished ? scoreB : null}
                isWinner={bWon}
                isLoser={isFinished && !bWon && winnerId != null}
                isTBD={teamB == null}
              />
            </div>
          </div>
        );
      }}
    />
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  TeamRow — a single team row inside a match card                   */
/* ────────────────────────────────────────────────────────────────── */

function TeamRow({
  logo,
  name,
  score,
  isWinner,
  isLoser,
  isTBD,
}: {
  logo: string | null;
  name: string;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isTBD: boolean;
}) {
  return (
    <div
      className={`
        flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all
        ${isWinner ? "bg-emerald-500/[0.08]" : ""}
      `}
    >
      {/* Team logo */}
      {logo ? (
        <img
          src={logo}
          alt={name}
          className={`
            h-10 w-10 shrink-0 rounded-full object-cover ring-2 transition-all
            ${isWinner
              ? "ring-emerald-400/50 shadow-lg shadow-emerald-500/20"
              : isLoser
                ? "ring-white/[0.06] opacity-50"
                : "ring-white/10"
            }
          `}
        />
      ) : (
        <div
          className={`
            flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 transition-all
            ${isTBD
              ? "ring-white/[0.06] bg-white/[0.03]"
              : isLoser
                ? "ring-white/[0.06] bg-zinc-800/40 opacity-50"
                : "ring-white/10 bg-zinc-800/60"
            }
          `}
        >
          <span className={`text-xs font-bold ${isTBD ? "text-white/15" : "text-white/30"}`}>
            {isTBD ? "?" : name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Team name */}
      <span
        className={`
          flex-1 truncate text-[13px] font-semibold leading-tight transition-all
          ${isWinner
            ? "text-white"
            : isLoser
              ? "text-white/30"
              : isTBD
                ? "text-white/20 italic"
                : "text-white/70"
          }
        `}
      >
        {name}
      </span>

      {/* Score badge */}
      {score != null ? (
        <div
          className={`
            flex h-8 min-w-[32px] shrink-0 items-center justify-center rounded-lg text-base font-black tabular-nums transition-all
            ${isWinner
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/25"
              : "bg-white/[0.04] text-white/35"
            }
          `}
        >
          {score}
        </div>
      ) : (
        /* Empty score placeholder to maintain alignment */
        <div className="h-8 min-w-[32px] shrink-0" />
      )}
    </div>
  );
}

export default KOStageDisplay;
