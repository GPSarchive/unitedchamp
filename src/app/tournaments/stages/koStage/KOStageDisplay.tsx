// File: KOStageDisplay.tsx — Elegant sporty knockout bracket with big match cards & scores

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTournamentData, type Stage } from "@/app/tournaments/useTournamentData";
import KOStageViewer from "./KOStageViewer";
import { formatMatchDate } from "@/app/lib/datetime";

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
  status?: "scheduled" | "postponed" | "finished" | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
  // two-legged KO
  leg?: number | null;
  tie_leg1_match_id?: number | null;
  penalty_a?: number | null;
  penalty_b?: number | null;
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
  // two-legged KO (null for single-leg)
  twoLegged?: boolean;
  legScores?: { a: number | null; b: number | null }[]; // per displayed leg, in teamA/teamB orientation
  penA?: number | null;
  penB?: number | null;
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

    // Group rows by bracket slot — two-legged ties have two rows per (round, pos).
    const byKey = new Map<string, DraftMatch[]>();
    stageRows.forEach((m) => {
      const key = `R${m.round ?? 1}-B${m.bracket_pos ?? 1}`;
      const arr = byKey.get(key) ?? [];
      arr.push(m);
      byKey.set(key, arr);
    });

    const nx: NodeBox[] = [];
    const meta: Record<string, NodeMeta> = {};
    const edges: Connection[] = [];
    const md: Record<string, MatchNodeData> = {};

    // Score that `teamId` put up in a row (teams may be on either side).
    const scoreFor = (m: DraftMatch, teamId: number | null) => {
      if (teamId == null) return 0;
      if (m.team_a_id === teamId) return m.team_a_score ?? 0;
      if (m.team_b_id === teamId) return m.team_b_score ?? 0;
      return 0;
    };

    byKey.forEach((rows, key) => {
      const sample = rows[0];
      const r = sample.round ?? 1;
      const b = sample.bracket_pos ?? 1;

      nx.push({
        id: key,
        x: (r - 1) * COL_GAP + X_MARGIN,
        y: getYPosition(r, b),
        w: BOX_W,
        h: BOX_H,
        label: getRoundLabel(r, maxRound),
      });
      meta[key] = { round: r, bracket_pos: b };

      // Edges from a representative row (both legs share the same source coords).
      const homeKey =
        sample.home_source_round && sample.home_source_bracket_pos
          ? `R${sample.home_source_round}-B${sample.home_source_bracket_pos}`
          : null;
      const awayKey =
        sample.away_source_round && sample.away_source_bracket_pos
          ? `R${sample.away_source_round}-B${sample.away_source_bracket_pos}`
          : null;
      if (homeKey) edges.push([homeKey, key]);
      if (awayKey) edges.push([awayKey, key]);

      const twoLegged = rows.length > 1 || rows.some((m) => m.leg != null);

      if (!twoLegged) {
        md[key] = {
          teamA: sample.team_a_id ?? null,
          teamB: sample.team_b_id ?? null,
          scoreA: sample.team_a_score ?? null,
          scoreB: sample.team_b_score ?? null,
          status: sample.status ?? null,
          winnerId: sample.winner_team_id ?? null,
          matchDate: sample.match_date ?? null,
        };
        return;
      }

      // Two-legged: display in leg-2 (decider) orientation; pens live on leg 2.
      const leg2 = rows.find((m) => m.leg === 2) ?? rows[rows.length - 1];
      const leg1 = rows.find((m) => m !== leg2) ?? null;
      const teamA = leg2.team_a_id ?? null;
      const teamB = leg2.team_b_id ?? null;

      const orderedLegs = [leg1, leg2].filter(Boolean) as DraftMatch[];
      const allFinished = orderedLegs.every((m) => m.status === "finished");
      const aggA = orderedLegs.reduce((sum, m) => sum + scoreFor(m, teamA), 0);
      const aggB = orderedLegs.reduce((sum, m) => sum + scoreFor(m, teamB), 0);

      md[key] = {
        teamA,
        teamB,
        scoreA: allFinished ? aggA : null,
        scoreB: allFinished ? aggB : null,
        status: allFinished ? "finished" : "scheduled",
        winnerId: leg2.winner_team_id ?? null,
        matchDate: leg2.match_date ?? leg1?.match_date ?? null,
        twoLegged: true,
        legScores: orderedLegs.map((m) => ({ a: scoreFor(m, teamA), b: scoreFor(m, teamB) })),
        penA: leg2.penalty_a ?? null,
        penB: leg2.penalty_b ?? null,
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

        const { teamA, teamB, scoreA, scoreB, status, winnerId, matchDate, twoLegged, legScores, penA, penB } = data;
        const nameA = getTeamName(teamA);
        const nameB = getTeamName(teamB);
        const logoA = getTeamLogo(teamA);
        const logoB = getTeamLogo(teamB);
        const isFinished = status === "finished";
        const hasPens = penA != null && penB != null;

        return (
          <div className="flex flex-col h-full">
            {/* Card header — round label + status */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                {n.label}
                {twoLegged && <span className="ml-1.5 text-cyan-400/70">· 2 legs</span>}
              </span>
              {isFinished ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  FT
                </span>
              ) : matchDate ? (
                <span className="text-[10px] text-white/30 font-medium">
                  {formatMatchDate(matchDate, { month: "short", day: "numeric" })}
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
                isTBD={teamB == null}
              />

              {/* Two-legged breakdown: aggregate label + per-leg scores + pens */}
              {twoLegged && (
                <div className="mt-1 flex items-center justify-center gap-2 px-2 text-[9px] font-medium text-white/40">
                  {isFinished && <span className="uppercase tracking-wider text-cyan-400/60">agg</span>}
                  {legScores && legScores.length > 0 && (
                    <span className="tabular-nums">
                      {legScores
                        .map((l) => `${l.a ?? "–"}-${l.b ?? "–"}`)
                        .join(" , ")}
                    </span>
                  )}
                  {hasPens && (
                    <span className="rounded bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 text-amber-300 tabular-nums">
                      pens {penA}-{penB}
                    </span>
                  )}
                </div>
              )}
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
  isTBD,
}: {
  logo: string | null;
  name: string;
  score: number | null;
  isTBD: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
      {/* Team logo */}
      {logo ? (
        <img
          src={logo}
          alt={name}
          className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/10"
        />
      ) : (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ${
            isTBD ? "ring-white/[0.06] bg-white/[0.03]" : "ring-white/10 bg-zinc-800/60"
          }`}
        >
          <span className={`text-xs font-bold ${isTBD ? "text-white/15" : "text-white/30"}`}>
            {isTBD ? "?" : name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Team name */}
      <span
        className={`flex-1 truncate text-[13px] font-semibold leading-tight ${
          isTBD ? "text-white/20 italic" : "text-white/70"
        }`}
      >
        {name}
      </span>

      {/* Score badge */}
      {score != null ? (
        <div className="flex h-8 min-w-[32px] shrink-0 items-center justify-center rounded-lg text-base font-black tabular-nums bg-white/[0.04] text-white/70">
          {score}
        </div>
      ) : (
        <div className="h-8 min-w-[32px] shrink-0" />
      )}
    </div>
  );
}

export default KOStageDisplay;
