"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Types (aligns with your DB but safe for draft UI) ---------- */
export type MatchDraft = {
  id: number; // negative/temporary ok in builder
  round: number; // 1..N
  bracket_pos: number; // 1..M per round
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  status?: "scheduled" | "live" | "finished" | string;
  best_of?: number; // default 1
  // links (winner/loser of prior matches)
  home_source_match_id?: number | null;
  away_source_match_id?: number | null;
  home_source_outcome?: "winner" | "loser" | null;
  away_source_outcome?: "winner" | "loser" | null;

  /** cosmetic flags for the builder */
  _isNew?: boolean;
};

export type TeamsMap = Record<
  number,
  { name: string; logo?: string | null; seed?: number | null }
>;

type BuilderProps = {
  title?: string;
  teamsMap: TeamsMap;
  /** Start with existing matches (can be empty). */
  initialMatches?: MatchDraft[];
  /** Called whenever the bracket changes. */
  onChange?: (matches: MatchDraft[]) => void;
  /** Optional: control sizes */
  colWidth?: number;
  colGap?: number;
  minCardHeight?: number;
  rowGap?: number;
};

/** ---------- Utilities ---------- */
let __nextTempId = -1;
const newId = () => __nextTempId--;

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const byRoundThenPos = (a: MatchDraft, b: MatchDraft) =>
  a.round - b.round || a.bracket_pos - b.bracket_pos;

const groupByRound = (matches: MatchDraft[]) => {
  const map = new Map<number, MatchDraft[]>();
  matches.slice().sort(byRoundThenPos).forEach((m) => {
    const arr = map.get(m.round) ?? [];
    arr.push(m);
    map.set(m.round, arr);
  });
  return map;
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** ---------- Component ---------- */
export default function KnockoutBuilder({
  title = "Knockout Builder",
  teamsMap,
  initialMatches = [],
  onChange,
  colWidth = 300,
  colGap = 28,
  minCardHeight = 100,
  rowGap = 16,
}: BuilderProps) {
  const [matches, setMatches] = useState<MatchDraft[]>(
    initialMatches.length ? clone(initialMatches) : []
  );

  // push changes up
  useEffect(() => {
    onChange?.(matches);
  }, [matches, onChange]);

  const roundsMap = useMemo(() => groupByRound(matches), [matches]);
  const roundNumbers = useMemo(
    () => [...roundsMap.keys()].sort((a, b) => a - b),
    [roundsMap]
  );
  const maxInRound = useMemo(
    () => Math.max(1, ...[...roundsMap.values()].map((arr) => arr.length)),
    [roundsMap]
  );

  /** ---------- Toolbar Actions ---------- */

  const addRoundAfter = (afterRound: number | null) => {
    setMatches((prev) => {
      const next = clone(prev);
      if (roundNumbers.length === 0) {
        // create round 1 starter with one empty match
        next.push(blankMatch(1, 1));
        return next;
      }
      const insertAfter = afterRound ?? roundNumbers[roundNumbers.length - 1];
      // shift following rounds up by 1
      next.forEach((m) => {
        if (m.round > insertAfter) m.round += 1;
      });
      // add one blank match in the new round
      next.push(blankMatch(insertAfter + 1, 1));
      renumberRound(next, insertAfter + 1);
      return next;
    });
  };

  const addMatchToRound = (round: number) => {
    setMatches((prev) => {
      const next = clone(prev);
      const count = next.filter((m) => m.round === round).length;
      next.push(blankMatch(round, count + 1));
      return next;
    });
  };

  const deleteMatch = (id: number) => {
    setMatches((prev) => {
      const next = clone(prev).filter((m) => m.id !== id);
      // remove references to it
      next.forEach((m) => {
        if (m.home_source_match_id === id) {
          m.home_source_match_id = null;
          m.home_source_outcome = null;
        }
        if (m.away_source_match_id === id) {
          m.away_source_match_id = null;
          m.away_source_outcome = null;
        }
      });
      // renumber each affected round’s bracket_pos contiguously
      const byR = groupByRound(next);
      byR.forEach((_arr, r) => renumberRound(next, r));
      return next;
    });
  };

  const swapSides = (id: number) => {
    setMatches((prev) => {
      const next = clone(prev);
      const m = next.find((x) => x.id === id);
      if (!m) return prev;
      [m.team_a_id, m.team_b_id] = [m.team_b_id, m.team_a_id];
      [m.home_source_match_id, m.away_source_match_id] = [
        m.away_source_match_id ?? null,
        m.home_source_match_id ?? null,
      ];
      [m.home_source_outcome, m.away_source_outcome] = [
        m.away_source_outcome ?? null,
        m.home_source_outcome ?? null,
      ];
      return next;
    });
  };

  const setBestOf = (id: number, bo: number) => {
    setMatches((prev) => {
      const next = clone(prev);
      const m = next.find((x) => x.id === id);
      if (!m) return prev;
      m.best_of = Math.max(1, Math.min(9, Math.floor(bo)));
      return next;
    });
  };

  const setTeam = (id: number, side: "A" | "B", teamId: number | null) => {
    setMatches((prev) => {
      const next = clone(prev);
      const m = next.find((x) => x.id === id);
      if (!m) return prev;
      if (side === "A") {
        m.team_a_id = teamId;
        // if team is set by hand, drop any source link on that side
        if (teamId !== null) {
          m.home_source_match_id = null;
          m.home_source_outcome = null;
        }
      } else {
        m.team_b_id = teamId;
        if (teamId !== null) {
          m.away_source_match_id = null;
          m.away_source_outcome = null;
        }
      }
      return next;
    });
  };

  /** Connect winner/loser of sourceMatch → target match/side */
  const connectSource = (
    targetId: number,
    side: "A" | "B",
    sourceMatchId: number,
    outcome: "winner" | "loser" = "winner"
  ) => {
    setMatches((prev) => {
      const next = clone(prev);
      const t = next.find((x) => x.id === targetId);
      if (!t) return prev;
      if (side === "A") {
        t.team_a_id = null;
        t.home_source_match_id = sourceMatchId;
        t.home_source_outcome = outcome;
      } else {
        t.team_b_id = null;
        t.away_source_match_id = sourceMatchId;
        t.away_source_outcome = outcome;
      }
      return next;
    });
  };

  /** Autogenerate next round by pairing matches in current round. */
  const autoBuildNextRound = (round: number) => {
    setMatches((prev) => {
      const next = clone(prev);
      const current = next
        .filter((m) => m.round === round)
        .sort((a, b) => a.bracket_pos - b.bracket_pos);

      if (current.length < 2) return prev;

      const nextRound = round + 1;
      const existing = next
        .filter((m) => m.round === nextRound)
        .sort((a, b) => a.bracket_pos - b.bracket_pos);

      const needPairs = Math.ceil(current.length / 2);
      // ensure we have enough matches in next round
      while (existing.length < needPairs) {
        existing.push(blankMatch(nextRound, existing.length + 1));
      }

      // wire sources
      for (let i = 0; i < needPairs; i++) {
        const m1 = current[i * 2];
        const m2 = current[i * 2 + 1];
        const target = existing[i];

        if (m1) {
          target.home_source_match_id = m1.id;
          target.home_source_outcome = "winner";
          target.team_a_id = null;
        }
        if (m2) {
          target.away_source_match_id = m2.id;
          target.away_source_outcome = "winner";
          target.team_b_id = null;
        }
      }

      // merge back (ensuring unique by id)
      const keepNonNext = next.filter((m) => m.round !== nextRound);
      return [...keepNonNext, ...existing].sort(byRoundThenPos);
    });
  };

  /** Add a 3rd-place playoff using losers of the two semis (round N-1). */
  const addThirdPlaceFromSemis = () => {
    if (roundNumbers.length < 2) return;
    const finalRound = Math.max(...roundNumbers);
    const semiRound = finalRound - 1;

    setMatches((prev) => {
      const next = clone(prev);
      const semis = next
        .filter((m) => m.round === semiRound)
        .sort((a, b) => a.bracket_pos - b.bracket_pos);
      if (semis.length < 2) return prev;

      // create or reuse a match in finalRound for 3rd-place (bracket_pos 2 if free)
      const finals = next.filter((m) => m.round === finalRound);
      const existingThird = finals.find((m) => isThirdPlace(next, m.id));
      if (existingThird) return prev;

      const target = blankMatch(finalRound, finals.length + 1);
      target.home_source_match_id = semis[0].id;
      target.home_source_outcome = "loser";
      target.away_source_match_id = semis[1].id;
      target.away_source_outcome = "loser";
      target._isNew = true;

      next.push(target);
      renumberRound(next, finalRound);
      return next.sort(byRoundThenPos);
    });
  };

  /** ---------- Validation ---------- */
  const issues = useMemo(() => validateBracket(matches), [matches]);

  /** ---------- Layout calc & connectors (like your ModernKnockoutTree) ---------- */
  const rowHeight = minCardHeight + rowGap;
  const boardWidth =
    roundNumbers.length * colWidth + Math.max(0, roundNumbers.length - 1) * colGap;
  const boardHeight = Math.max(300, rowHeight * maxInRound + 24);

  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [boxes, setBoxes] = useState<
    Map<number, { x: number; y: number; w: number; h: number }>
  >(new Map());

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapBB = wrap.getBoundingClientRect();
    const map = new Map<number, { x: number; y: number; w: number; h: number }>();
    matches.forEach((m) => {
      const el = cardRefs.current.get(m.id);
      if (!el) return;
      const r = el.getBoundingClientRect();
      map.set(m.id, { x: r.left - wrapBB.left, y: r.top - wrapBB.top, w: r.width, h: r.height });
    });
    setBoxes(map);
  }, [matches, boardWidth, boardHeight]);

  const edges = useMemo(() => {
    const out: Array<{
      from: number;
      to: number;
      label: "winner" | "loser";
    }> = [];
    matches.forEach((m) => {
      if (m.home_source_match_id) {
        out.push({
          from: m.home_source_match_id,
          to: m.id,
          label: m.home_source_outcome ?? "winner",
        });
      }
      if (m.away_source_match_id) {
        out.push({
          from: m.away_source_match_id,
          to: m.id,
          label: m.away_source_outcome ?? "winner",
        });
      }
    });
    return out;
  }, [matches]);

  /** ---------- Render ---------- */
  return (
    <section className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-cyan-200 font-semibold">{title}</h3>
          <span className="text-xs text-white/60">
            Rounds: <b className="text-white">{roundNumbers.length}</b> • Matches:{" "}
            <b className="text-white">{matches.length}</b>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5"
            onClick={() => addRoundAfter(null)}
          >
            + Add Round
          </button>
          {roundNumbers.map((r) => (
            <button
              key={`autonext-${r}`}
              className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5"
              onClick={() => autoBuildNextRound(r)}
              title={`Pair Round ${r} into Round ${r + 1}`}
            >
              Auto-build R{r} → R{r + 1}
            </button>
          ))}
          <button
            className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5"
            onClick={addThirdPlaceFromSemis}
          >
            + Third-place (from semis)
          </button>
        </div>
      </div>

      {/* Validation summary */}
      {issues.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-100 text-xs p-2">
          <div className="font-medium mb-1">Validation</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {issues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Board */}
      <div
        ref={wrapRef}
        className="relative overflow-auto rounded-lg border border-white/5"
        style={{ minHeight: boardHeight }}
      >
        {/* SVG connectors */}
        <svg
          width={boardWidth}
          height={boardHeight}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          {edges.map((e, i) => {
            const from = boxes.get(e.from);
            const to = boxes.get(e.to);
            if (!from || !to) return null;
            const x1 = from.x + from.w;
            const y1 = from.y + from.h / 2;
            const x2 = to.x;
            const y2 = to.y + to.h / 2;
            const mid = (x1 + x2) / 2;
            const path = `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
            return (
              <g key={i}>
                <path d={path} stroke="rgba(148,163,184,.65)" strokeWidth={2} fill="none" />
                {/* small tag for winner/loser */}
                <circle cx={mid} cy={(y1 + y2) / 2} r={9} fill="rgba(30,41,59,.75)" />
                <text
                  x={mid}
                  y={(y1 + y2) / 2 + 3}
                  fontSize={9}
                  textAnchor="middle"
                  fill="white"
                  style={{ fontFamily: "ui-sans-serif, system-ui" }}
                >
                  {e.label === "winner" ? "W" : "L"}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Columns */}
        <div className="relative" style={{ width: boardWidth, height: boardHeight }}>
          {roundNumbers.map((r, colIdx) => {
            const col = (roundsMap.get(r) ?? []).slice().sort(byRoundThenPos);
            const left = colIdx * (colWidth + colGap);

            return (
              <div
                key={`round-col-${r}`}
                className="absolute"
                style={{ left, top: 0, width: colWidth }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white/80 text-sm font-medium">Round {r}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addMatchToRound(r)}
                      className="text-xs text-white/80 hover:text-white/100 underline underline-offset-2"
                      title={`Add match to Round ${r}`}
                    >
                      + match
                    </button>
                  </div>
                </div>

                {col.map((m, idx) => {
                  const top = idx * (minCardHeight + rowGap);
                  return (
                    <div
                      key={m.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(m.id, el);
                        else cardRefs.current.delete(m.id);
                      }}
                      className={`rounded-xl border px-3 py-2 mb-3 bg-black/40 shadow-sm ${
                        m._isNew ? "border-cyan-400/40" : "border-white/10"
                      }`}
                      style={{ position: "absolute", top, width: "100%", minHeight: minCardHeight }}
                    >
                      {/* header */}
                      <div className="flex items-center justify-between text-[11px] text-white/60 mb-2">
                        <div className="flex items-center gap-2">
                          <span>Match #{m.bracket_pos}</span>
                          <span className="inline-block h-1 w-1 rounded-full bg-white/20" />
                          <span>Bo{m.best_of ?? 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15"
                            onClick={() => setBestOf(m.id, (m.best_of ?? 1) + 2)}
                            title="Increase best-of by 2 (1→3→5→7…)"
                          >
                            +BO
                          </button>
                          <button
                            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15"
                            onClick={() => setBestOf(m.id, Math.max(1, (m.best_of ?? 1) - 2))}
                            title="Decrease best-of"
                          >
                            −BO
                          </button>
                          <button
                            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15"
                            onClick={() => swapSides(m.id)}
                            title="Swap A/B"
                          >
                            ⇄
                          </button>
                          <button
                            className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-100"
                            onClick={() => deleteMatch(m.id)}
                            title="Delete match"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* teams */}
                      <div className="space-y-2">
                        <TeamRow
                          side="A"
                          match={m}
                          teamsMap={teamsMap}
                          label={slotLabel("A", m, teamsMap)}
                          onPick={(tid) => setTeam(m.id, "A", tid)}
                          onConnect={(srcId, outcome) =>
                            connectSource(m.id, "A", srcId, outcome)
                          }
                          candidates={sourceCandidates(matches, m.round - 1)}
                        />
                        <TeamRow
                          side="B"
                          match={m}
                          teamsMap={teamsMap}
                          label={slotLabel("B", m, teamsMap)}
                          onPick={(tid) => setTeam(m.id, "B", tid)}
                          onConnect={(srcId, outcome) =>
                            connectSource(m.id, "B", srcId, outcome)
                          }
                          candidates={sourceCandidates(matches, m.round - 1)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** ---------- Subcomponents ---------- */

function TeamRow({
  side,
  match,
  label,
  teamsMap,
  onPick,
  onConnect,
  candidates,
}: {
  side: "A" | "B";
  match: MatchDraft;
  label: string;
  teamsMap: TeamsMap;
  onPick: (teamId: number | null) => void;
  onConnect: (sourceMatchId: number, outcome: "winner" | "loser") => void;
  candidates: MatchDraft[];
}) {
  const [mode, setMode] = useState<"pick" | "link">("pick");

    function currentTeamId(side: string, match: MatchDraft): string | number | readonly string[] | undefined {
        throw new Error("Function not implemented.");
    }

  return (
    <div className="flex items-center gap-2">
      <div className="text-[11px] text-white/60 w-4">{side}</div>

      {/* Current label */}
      <div className="flex-1 text-white truncate">{label}</div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1">
        <button
          className={`text-[11px] px-2 py-1 rounded ${
            mode === "pick" ? "bg-cyan-500/20 text-cyan-100" : "bg-white/10 text-white/70"
          }`}
          onClick={() => setMode("pick")}
          title="Pick team from list"
        >
          Pick
        </button>
        <button
          className={`text-[11px] px-2 py-1 rounded ${
            mode === "link" ? "bg-cyan-500/20 text-cyan-100" : "bg-white/10 text-white/70"
          }`}
          onClick={() => setMode("link")}
          title="Link winner/loser of a prior match"
        >
          Link
        </button>
      </div>

      {/* Controls */}
      {mode === "pick" ? (
        <select
          className="bg-white/10 text-white text-xs rounded px-2 py-1"
          value={currentTeamId(side, match) ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onPick(v ? Number(v) : null);
          }}
        >
          <option value="">— Select team —</option>
          {Object.entries(teamsMap)
            .sort((a, b) => (a[1].seed ?? 9999) - (b[1].seed ?? 9999))
            .map(([id, t]) => (
              <option key={id} value={id}>
                {t.seed != null ? `S${t.seed} — ` : ""}{t.name}
              </option>
            ))}
          <option value="">Clear slot</option>
        </select>
      ) : (
        <div className="flex items-center gap-1">
          <select
            className="bg-white/10 text-white text-xs rounded px-2 py-1"
            onChange={(e) => {
              const src = Number(e.target.value);
              if (!src) return;
              onConnect(src, "winner");
              e.currentTarget.selectedIndex = 0; // reset
            }}
          >
            <option value="">Winner of…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                Match {m.round}-{m.bracket_pos}
              </option>
            ))}
          </select>
          <select
            className="bg-white/10 text-white text-xs rounded px-2 py-1"
            onChange={(e) => {
              const src = Number(e.target.value);
              if (!src) return;
              onConnect(src, "loser");
              e.currentTarget.selectedIndex = 0;
            }}
          >
            <option value="">Loser of…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                Match {m.round}-{m.bracket_pos}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** ---------- Helpers ---------- */

function blankMatch(round: number, pos: number): MatchDraft {
  return {
    id: newId(),
    round,
    bracket_pos: pos,
    team_a_id: null,
    team_b_id: null,
    best_of: 1,
    status: "scheduled",
    _isNew: true,
  };
}

/** Ensure bracket_pos are 1..N without gaps for a round. */
function renumberRound(arr: MatchDraft[], round: number) {
  const col = arr
    .filter((m) => m.round === round)
    .sort((a, b) => a.bracket_pos - b.bracket_pos);
  col.forEach((m, i) => (m.bracket_pos = i + 1));
}

function teamLabel(teamsMap: TeamsMap, id: number | null) {
  if (!id) return null;
  const t = teamsMap[id];
  if (!t) return `Team#${id}`;
  return t.seed != null ? `${t.name} (S${t.seed})` : t.name;
}

function slotLabel(side: "A" | "B", m: MatchDraft, teamsMap: TeamsMap) {
  const tid = side === "A" ? m.team_a_id : m.team_b_id;
  const srcId =
    side === "A" ? m.home_source_match_id ?? null : m.away_source_match_id ?? null;
  const outcome =
    side === "A" ? m.home_source_outcome ?? "winner" : m.away_source_outcome ?? "winner";

  const tl = teamLabel(teamsMap, tid);
  if (tl) return tl;

  if (srcId) {
    const [r, p] = [m.round, m.bracket_pos]; // only for context if needed
    return `${outcome === "winner" ? "Winner" : "Loser"} of M${srcId}`;
  }
  return "TBD";
}

/** Any finals match with both sources coming from the previous round as 'loser' counts as 3rd-place here. */
function isThirdPlace(all: MatchDraft[], id: number) {
  const m = all.find((x) => x.id === id);
  if (!m) return false;
  return (
    (m.home_source_outcome === "loser" && m.away_source_outcome === "loser") ||
    false
  );
}

/** Candidates to link from (round n-1 and earlier). */
function sourceCandidates(matches: MatchDraft[], upToRound: number) {
  return matches
    .filter((m) => m.round <= upToRound)
    .slice()
    .sort(byRoundThenPos);
}

/** Bracket validation with friendly messages. */
function validateBracket(matches: MatchDraft[]): string[] {
  const msgs: string[] = [];
  if (matches.length === 0) {
    msgs.push("No matches yet — add a round and at least one match.");
    return msgs;
  }

  const rounds = groupByRound(matches);
  const nums = [...rounds.keys()].sort((a, b) => a - b);
  // consecutive rounds
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      msgs.push(
        `Rounds should be consecutive starting at 1 (found round ${nums[i]} at position ${i + 1}).`
      );
      break;
    }
  }

  // bracket_pos uniqueness
  rounds.forEach((arr, r) => {
    const seen = new Set<number>();
    arr.forEach((m) => {
      if (seen.has(m.bracket_pos)) {
        msgs.push(`Duplicate bracket_pos in round ${r} (position ${m.bracket_pos}).`);
      }
      seen.add(m.bracket_pos);
    });
  });

  // orphan checks: any non-final match that feeds nowhere?
  const maxR = Math.max(...nums);
  const referenced = new Set<number>();
  matches.forEach((m) => {
    if (m.home_source_match_id) referenced.add(m.home_source_match_id);
    if (m.away_source_match_id) referenced.add(m.away_source_match_id);
  });
  matches
    .filter((m) => m.round < maxR)
    .forEach((m) => {
      if (!referenced.has(m.id)) {
        msgs.push(
          `Match R${m.round}-#${m.bracket_pos} doesn’t feed any later match. (Auto-build the next round or link it.)`
        );
      }
    });

  // simple cycle detection via DFS
  const graph = new Map<number, number[]>(); // from → [to...]
  matches.forEach((m) => {
    if (m.home_source_match_id) {
      const a = graph.get(m.home_source_match_id) ?? [];
      a.push(m.id);
      graph.set(m.home_source_match_id, a);
    }
    if (m.away_source_match_id) {
      const a = graph.get(m.away_source_match_id) ?? [];
      a.push(m.id);
      graph.set(m.away_source_match_id, a);
    }
  });
  const temp = new Set<number>();
  const perm = new Set<number>();
  const hasCycle = (n: number): boolean => {
    if (perm.has(n)) return false;
    if (temp.has(n)) return true;
    temp.add(n);
    for (const m of graph.get(n) ?? []) if (hasCycle(m)) return true;
    temp.delete(n);
    perm.add(n);
    return false;
  };
  for (const id of graph.keys()) {
    if (hasCycle(id)) {
      msgs.push("There’s a cycle in your links (a match feeds into itself indirectly).");
      break;
    }
  }

  return msgs;
}
