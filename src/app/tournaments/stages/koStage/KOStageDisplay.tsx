// File: KOStageDisplay.tsx — Elegant sporty knockout bracket with big match cards & scores

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTournamentData, type Stage } from "@/app/tournaments/useTournamentData";
import KOStageViewer, { type Edge, type NodeGroup } from "./KOStageViewer";
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

interface NodeBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** Cards sharing a group id are the two legs of one tie. */
  group?: string;
}

type MatchNodeData = {
  teamA: number | null;
  teamB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  status: string | null;
  winnerId: number | null;
  matchDate: string | null;
  // two-legged KO — each leg is now its own card.
  twoLegged?: boolean;
  /** 1 or 2 for a leg card; undefined for a single-leg slot. */
  leg?: number | null;
  /** Aggregate + pens, attached to the leg-2 (decider) card only. */
  agg?: { a: number; b: number; finished: boolean; penA: number | null; penB: number | null } | null;
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
  const [connections, setConnections] = useState<Edge[]>([]);
  const [groups, setGroups] = useState<NodeGroup[]>([]);
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
  // Single-leg slots use one tall card. Two-legged ties stack two shorter leg
  // cards inside a dashed "tie" container, mirroring the builder's bracket.
  const SCALE = 1.6;
  const BOX_W = 320;
  const BOX_H = 170;          // single-leg card height
  const LEG_H = 132;          // each leg card in a two-legged tie
  const LEG_GAP = 16;         // gap between the two stacked leg cards
  const TIE_PAD_X = 14;       // tie-container horizontal inset
  const TIE_PAD_TOP = 26;     // room for the tie header label
  const TIE_PAD_BOTTOM = 14;
  const COL_GAP = 360 * SCALE;
  // Vertical pitch must clear the tallest block in a column: a two-legged tie
  // (two leg cards + gap + container padding). Single cards fit comfortably.
  const TIE_BLOCK_H = LEG_H * 2 + LEG_GAP + TIE_PAD_TOP + TIE_PAD_BOTTOM;
  const BASE_GAP_Y = Math.max(BOX_H, TIE_BLOCK_H) + 90;
  const X_MARGIN = 80 * SCALE;
  const Y_MARGIN = 80 * SCALE;

  const getYPosition = (round: number, bracket_pos: number) => {
    const spacing = BASE_GAP_Y * Math.pow(2, round - 1);
    const offset = spacing / 2;
    return Y_MARGIN + offset + (bracket_pos - 1) * spacing;
  };

  const slotKey = (r: number, p: number) => `R${r}-B${p}`;
  const legId = (r: number, p: number, leg: number | null | undefined) => `R${r}-B${p}-L${leg ?? 0}`;
  const tieGroupId = (r: number, p: number) => `TIE-R${r}-B${p}`;

  const loadFromStore = () => {
    const stageRows = knockoutMatches.filter(
      (m) => (m.round ?? null) != null && (m.bracket_pos ?? null) != null
    );

    if (!stageRows.length) {
      setNodes([]);
      setConnections([]);
      setGroups([]);
      setMatchData({});
      return;
    }

    const maxRound = Math.max(...stageRows.map((m) => m.round ?? 1));

    // Group rows by bracket slot — two-legged ties have two rows per (round, pos).
    const byKey = new Map<string, DraftMatch[]>();
    stageRows.forEach((m) => {
      const key = slotKey(m.round ?? 1, m.bracket_pos ?? 1);
      const arr = byKey.get(key) ?? [];
      arr.push(m);
      byKey.set(key, arr);
    });
    // Stable leg order (leg 1 above leg 2).
    for (const arr of byKey.values()) arr.sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));

    const nx: NodeBox[] = [];
    const grp: NodeGroup[] = [];
    const edges: Edge[] = [];
    const md: Record<string, MatchNodeData> = {};

    // Score that `teamId` put up in a row (teams may be on either side).
    const scoreFor = (m: DraftMatch, teamId: number | null) => {
      if (teamId == null) return 0;
      if (m.team_a_id === teamId) return m.team_a_score ?? 0;
      if (m.team_b_id === teamId) return m.team_b_score ?? 0;
      return 0;
    };

    // The card a parent slot feeds INTO / advances FROM: the decider (leg 2) for a
    // two-legged tie, else the single card. Children attach to leg 1 (or single).
    const deciderId = (r: number, p: number) => {
      const rows = byKey.get(slotKey(r, p));
      if (!rows) return null;
      if (rows.length > 1 || rows.some((m) => m.leg != null)) {
        const dec = rows.find((m) => m.leg === 2) ?? rows[rows.length - 1];
        return legId(r, p, dec.leg);
      }
      return legId(r, p, rows[0].leg);
    };

    byKey.forEach((rows) => {
      const sample = rows[0];
      const r = sample.round ?? 1;
      const b = sample.bracket_pos ?? 1;
      const colX = (r - 1) * COL_GAP + X_MARGIN;
      const centerY = getYPosition(r, b);
      const label = getRoundLabel(r, maxRound);

      const twoLegged = rows.length > 1 || rows.some((m) => m.leg != null);

      // Progression edges from this slot's parents → this slot's leg-1 / single card.
      const childAnchor = legId(r, b, rows[0].leg);
      const homeDec =
        sample.home_source_round && sample.home_source_bracket_pos
          ? deciderId(sample.home_source_round, sample.home_source_bracket_pos)
          : null;
      const awayDec =
        sample.away_source_round && sample.away_source_bracket_pos
          ? deciderId(sample.away_source_round, sample.away_source_bracket_pos)
          : null;
      if (homeDec) edges.push({ from: homeDec, to: childAnchor, kind: "progress" });
      if (awayDec) edges.push({ from: awayDec, to: childAnchor, kind: "progress" });

      if (!twoLegged) {
        const id = legId(r, b, sample.leg);
        nx.push({
          id,
          x: colX,
          y: centerY - BOX_H / 2,
          w: BOX_W,
          h: BOX_H,
          label,
        });
        md[id] = {
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

      // ── Two-legged tie: stacked leg cards inside a dashed tie container. ──
      const gid = tieGroupId(r, b);
      const startY = centerY - TIE_BLOCK_H / 2;
      const cardsTop = startY + TIE_PAD_TOP;
      const cardX = colX + TIE_PAD_X;

      // Aggregate (decided on leg 2; pens live on leg 2).
      const leg2 = rows.find((m) => m.leg === 2) ?? rows[rows.length - 1];
      const teamA2 = leg2.team_a_id ?? null;
      const teamB2 = leg2.team_b_id ?? null;
      const allFinished = rows.every((m) => m.status === "finished");
      const aggA = rows.reduce((s, m) => s + scoreFor(m, teamA2), 0);
      const aggB = rows.reduce((s, m) => s + scoreFor(m, teamB2), 0);
      const penA = leg2.penalty_a ?? null;
      const penB = leg2.penalty_b ?? null;

      const accent = allFinished
        ? `agg ${aggA}–${aggB}${penA != null && penB != null ? ` · pens ${penA}-${penB}` : ""}`
        : "2 legs";

      grp.push({
        id: gid,
        x: colX,
        y: startY,
        w: BOX_W + TIE_PAD_X * 2,
        h: TIE_BLOCK_H,
        label: "Tie",
        accent,
        finished: allFinished,
      });

      rows.forEach((row, li) => {
        const id = legId(r, b, row.leg);
        nx.push({
          id,
          x: cardX,
          y: cardsTop + li * (LEG_H + LEG_GAP),
          w: BOX_W,
          h: LEG_H,
          label,
          group: gid,
        });
        const isLeg2 = row.leg === 2;
        const finished = row.status === "finished";
        md[id] = {
          teamA: row.team_a_id ?? null,
          teamB: row.team_b_id ?? null,
          scoreA: finished ? row.team_a_score ?? null : null,
          scoreB: finished ? row.team_b_score ?? null : null,
          status: row.status ?? null,
          winnerId: row.winner_team_id ?? null,
          matchDate: row.match_date ?? null,
          twoLegged: true,
          leg: row.leg ?? (li + 1),
          agg: isLeg2
            ? { a: aggA, b: aggB, finished: allFinished, penA, penB }
            : null,
        };
      });

      // Leg connector: leg-1 card → leg-2 card (vertical dashed).
      const leg1Row = rows.find((m) => m.leg !== 2) ?? rows[0];
      if (leg2 && leg2 !== leg1Row) {
        edges.push({ from: legId(r, b, leg1Row.leg), to: legId(r, b, leg2.leg), kind: "leg" });
      }
    });

    setNodes(nx);
    setConnections(edges);
    setGroups(grp);
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
      groups={groups}
      nodeContent={(n) => {
        const data = matchData[n.id];
        if (!data) return null;

        const { teamA, teamB, scoreA, scoreB, status, matchDate, twoLegged, leg, agg } = data;
        const nameA = getTeamName(teamA);
        const nameB = getTeamName(teamB);
        const logoA = getTeamLogo(teamA);
        const logoB = getTeamLogo(teamB);
        const isFinished = status === "finished";

        // Each leg of a two-legged tie renders as a compact card with a leg tag;
        // the aggregate lives on the tie container header (drawn by the viewer).
        const isLeg2 = twoLegged && leg === 2;
        const legTag = twoLegged ? (isLeg2 ? "Leg 2" : "Leg 1") : null;
        const compact = !!twoLegged;
        const hasPens = agg?.penA != null && agg?.penB != null;

        return (
          <div className="flex flex-col h-full">
            {/* Card header — round label (+ leg tag) + status */}
            <div className={`flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] ${compact ? "px-3 py-1.5" : "px-3.5 py-2"}`}>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {n.label}
                </span>
                {legTag && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${
                      isLeg2
                        ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/30"
                        : "bg-white/5 text-white/55 ring-white/15"
                    }`}
                  >
                    {legTag}
                  </span>
                )}
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
            <div className={`flex-1 flex flex-col justify-center ${compact ? "gap-0.5 px-1 py-1" : "gap-1 px-1.5 py-1.5"}`}>
              <TeamRow logo={logoA} name={nameA} score={isFinished ? scoreA : null} isTBD={teamA == null} compact={compact} />

              {/* Separator */}
              <div className={compact ? "relative mx-2" : "relative mx-3"}>
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                {!isFinished && (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 px-2 text-[9px] font-bold uppercase tracking-widest text-white/20">
                    vs
                  </span>
                )}
              </div>

              <TeamRow logo={logoB} name={nameB} score={isFinished ? scoreB : null} isTBD={teamB == null} compact={compact} />

              {/* Leg-2 footer: the tie is decided here. Aggregate sits on the tie
                  container; the card only flags pending / penalties. */}
              {isLeg2 && agg && (
                <div className="mt-0.5 flex items-center justify-center gap-2 px-2 text-[9px] font-medium text-white/40">
                  {!agg.finished && <span className="uppercase tracking-wider text-cyan-400/60">decider</span>}
                  {hasPens && (
                    <span className="rounded bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 text-amber-300 tabular-nums">
                      pens {agg.penA}-{agg.penB}
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
  compact = false,
}: {
  logo: string | null;
  name: string;
  score: number | null;
  isTBD: boolean;
  compact?: boolean;
}) {
  const logoSize = compact ? "h-7 w-7" : "h-10 w-10";
  const scoreBox = compact ? "h-7 min-w-[28px] text-sm" : "h-8 min-w-[32px] text-base";
  return (
    <div className={`flex items-center rounded-lg ${compact ? "gap-2 px-2 py-1" : "gap-3 px-2.5 py-2"}`}>
      {/* Team logo */}
      {logo ? (
        <img
          src={logo}
          alt={name}
          className={`${logoSize} shrink-0 rounded-full object-cover ring-2 ring-white/10`}
        />
      ) : (
        <div
          className={`flex ${logoSize} shrink-0 items-center justify-center rounded-full ring-2 ${
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
        className={`flex-1 truncate font-semibold leading-tight ${compact ? "text-[12px]" : "text-[13px]"} ${
          isTBD ? "text-white/20 italic" : "text-white/70"
        }`}
      >
        {name}
      </span>

      {/* Score badge */}
      {score != null ? (
        <div className={`flex ${scoreBox} shrink-0 items-center justify-center rounded-lg font-black tabular-nums bg-white/[0.04] text-white/70`}>
          {score}
        </div>
      ) : (
        <div className={`${scoreBox} shrink-0`} />
      )}
    </div>
  );
}

export default KOStageDisplay;
