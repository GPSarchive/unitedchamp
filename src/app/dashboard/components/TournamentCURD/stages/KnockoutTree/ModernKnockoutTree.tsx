// app/components/DashboardPageComponents/TournamentCURD/stages/KnockoutTree/ModernKnockoutTree.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";
import { getLabels } from "../../../../../tournoua/[slug]/components/teams/Knockout/labels";
import MatchRow from "./MatchRow";
import EditablePairCard from "./EditablePairCard";
import CanvasBacklight from "./CanvasBacklight";

/** Public prop types kept local to avoid missing exports in lib/types */
export type RoundLabelFnArgs = {
  round: number;
  index: number;
  total: number;
  matchesInRound: number;
  teamsInRound: number;
};

export type ModernKnockoutTreeProps = {
  title?: string;
  matches: Match[];
  teamsMap: TeamsMap;
  onMatchClick?: (m: Match) => void;
  roundLabelFn?: (a: RoundLabelFnArgs) => string;
  colWidth?: number;
  minCardHeight?: number;
  gapX?: number;
  maxAutoFit?: number;
  minRowGap?: number;
  lang?: "en" | "el";
  labels?: Partial<Labels>;
  editable?: boolean;
  eligibleTeamIds?: number[];
  onAssignSlot?: (matchId: number, slot: "A" | "B", teamId: number | null) => void;
  onSwapPair?: (matchId: number) => void;
  onBulkAssignFirstRound?: (
    rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>
  ) => void;
  onClearFirstRound?: () => void;
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
};

type Edge = { fromId: number; toId: number };

export default function ModernKnockoutTree({
  title = "Knockout Bracket",
  matches,
  teamsMap,
  onMatchClick,
  roundLabelFn,
  colWidth,
  minCardHeight = 76,
  gapX,
  maxAutoFit = 8,
  minRowGap = 12,
  lang = "en",
  labels,
  editable = false,
  eligibleTeamIds,
  onAssignSlot,
  onSwapPair,
  onBulkAssignFirstRound,
  onClearFirstRound,
  onAutoAssignTeamSeeds,
}: ModernKnockoutTreeProps) {
  /** Labels */
  const L: Labels = useMemo(() => getLabels(lang, labels), [lang, labels]);

  /** Group by round & sort by bracket_pos (base) */
  const baseRounds = useMemo(() => {
    const m = new Map<number, Match[]>();
    matches.forEach((x: Match) => {
      const r = x.round ?? 0;
      m.set(r, [...(m.get(r) ?? []), x]);
    });
    return Array.from(m.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({
        round,
        list: list.slice().sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)),
      }));
  }, [matches]);

  /**
   * Insert lightweight "BYE stubs" into the previous round at the expected parent slots
   * that do not exist. Those stubs are later aligned to their child’s Y.
   */
  const { rounds, stubIds } = useMemo(() => {
    const cloned = baseRounds.map((c) => ({ round: c.round, list: c.list.slice() as Match[] }));
    const byKey: Map<string, Match> = new Map();
    cloned.forEach(({ round, list }) =>
      list.forEach((m) => byKey.set(`${round}:${m.bracket_pos ?? 0}`, m))
    );

    const stubs = new Set<number>();
    let stubSeq = 1;
    const makeStub = (round: number, bracket_pos: number): Match =>
      ({
        id: -100000 - stubSeq++,
        round,
        bracket_pos,
        team_a_id: null,
        team_b_id: null,
        team_a_score: null,
        team_b_score: null,
        status: "scheduled" as any,
      } as unknown as Match);

    for (let ri = 1; ri < cloned.length; ri++) {
      const prev = cloned[ri - 1];
      const curr = cloned[ri];
      const add: Match[] = [];

      curr.list.forEach((m) => {
        const r = m.round ?? 0;
        const p = m.bracket_pos ?? 1;
        const leftKey = `${r - 1}:${2 * p - 1}`;
        const rightKey = `${r - 1}:${2 * p}`;
        if (!byKey.has(leftKey)) {
          const s = makeStub(r - 1, 2 * p - 1);
          add.push(s);
          byKey.set(leftKey, s);
        }
        if (!byKey.has(rightKey)) {
          const s2 = makeStub(r - 1, 2 * p);
          add.push(s2);
          byKey.set(rightKey, s2);
        }
      });

      if (add.length) {
        prev.list = prev.list.concat(add).sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0));
      }
    }

    return { rounds: cloned, stubIds: stubs };
  }, [baseRounds]);

  const isStubId = (id: number) => stubIds.has(id);

  /** Map (round,bracket_pos) -> Match (for fast lookup) */
  const byRoundPos = useMemo(() => {
    const map: Map<string, Match> = new Map();
    rounds.forEach(({ round, list }) => {
      list.forEach((m) => map.set(`${round}:${m.bracket_pos ?? 0}`, m));
    });
    return map;
  }, [rounds]);

  /** Counts per round (for labels) */
  const counts = useMemo(
    () =>
      rounds.map((col) => {
        const matchesInRound = col.list.length;
        const teamsInRound = matchesInRound > 1 ? matchesInRound * 2 : 2;
        return { round: col.round, matchesInRound, teamsInRound };
      }),
    [rounds]
  );

  /** Teams that appeared per round (for BYE badge detection) */
  const teamsPerRound: Array<Set<number>> = useMemo(() => {
    return rounds.map(({ list }) => {
      const s = new Set<number>();
      list.forEach((m) => {
        if (m.team_a_id != null) s.add(m.team_a_id);
        if (m.team_b_id != null) s.add(m.team_b_id);
      });
      return s;
    });
  }, [rounds]);

  /** Helpers to resolve parents deterministically */
  const expectedParents = (m: Match): Match[] => {
    if (!Number.isFinite(m.round) || !Number.isFinite(m.bracket_pos) || (m.round ?? 0) <= 1) return [];
    const r = m.round as number;
    const p = m.bracket_pos as number;
    const a = byRoundPos.get(`${r - 1}:${2 * p - 1}`);
    const b = byRoundPos.get(`${r - 1}:${2 * p}`);
    return [a, b].filter(Boolean) as Match[];
  };

  const resolveParents = (m: any): Match[] => {
    const out: Match[] = [];
    const add = (x?: Match) => {
      if (x && !out.some((y) => y.id === x.id)) out.push(x);
    };

    // 1) explicit ids
    if (Number.isInteger(m.home_source_match_id)) add(matches.find((mm) => mm.id === m.home_source_match_id));
    if (Number.isInteger(m.away_source_match_id)) add(matches.find((mm) => mm.id === m.away_source_match_id));

    // 2) stable (round, bracket_pos)
    if (Number.isFinite(m.home_source_round) && Number.isFinite(m.home_source_bracket_pos)) {
      add(byRoundPos.get(`${m.home_source_round}:${m.home_source_bracket_pos}`));
    }
    if (Number.isFinite(m.away_source_round) && Number.isFinite(m.away_source_bracket_pos)) {
      add(byRoundPos.get(`${m.away_source_round}:${m.away_source_bracket_pos}`));
    }

    // 3) fallback to expected by bracket rule
    if (out.length === 0) return expectedParents(m as Match);
    if (out.length === 1) {
      const exp = expectedParents(m as Match);
      const other = exp.find((x) => x.id !== out[0].id);
      if (other) out.push(other);
    }
    return out.slice(0, 2);
  };

  /** Edges between rounds (explicit/stable/expected; includes stubs) */
  const edgesByPair = useMemo(() => {
    const edges: Edge[] = [];
    const seen = new Set<string>();

    for (let ri = 1; ri < rounds.length; ri++) {
      const curr = rounds[ri].list;
      curr.forEach((m) => {
        const parents = resolveParents(m);
        parents.forEach((p) => {
          const k = `${p.id}->${m.id}`;
          if (!seen.has(k)) {
            edges.push({ fromId: p.id, toId: m.id });
            seen.add(k);
          }
        });
      });
    }
    return edges;
  }, [rounds, byRoundPos, matches]);

  /** key so effects re-run even if only which-edges changed */
  const edgesKey = useMemo(
    () => edgesByPair.map((e) => `${e.fromId}->${e.toId}`).sort().join(","),
    [edgesByPair]
  );

  /** Determine which side (A/B) a parent feeds in the child */
  const feedsA = (child: Match, parent: Match): boolean => {
    if (Number.isInteger((child as any).home_source_match_id) && (child as any).home_source_match_id === parent.id)
      return true;
    if (Number.isInteger((child as any).away_source_match_id) && (child as any).away_source_match_id === parent.id)
      return false;

    if (
      Number.isFinite((child as any).home_source_round) &&
      Number.isFinite((child as any).home_source_bracket_pos) &&
      (child as any).home_source_round === parent.round &&
      (child as any).home_source_bracket_pos === parent.bracket_pos
    )
      return true;

    if (
      Number.isFinite((child as any).away_source_round) &&
      Number.isFinite((child as any).away_source_bracket_pos) &&
      (child as any).away_source_round === parent.round &&
      (child as any).away_source_bracket_pos === parent.bracket_pos
    )
      return false;

    // expected topology (left parent -> A, right parent -> B)
    if (
      Number.isFinite(child.round) &&
      Number.isFinite(child.bracket_pos) &&
      Number.isFinite(parent.round) &&
      Number.isFinite(parent.bracket_pos) &&
      (child.round as number) - 1 === (parent.round as number)
    ) {
      const leftPos = 2 * (child.bracket_pos as number) - 1;
      if (parent.bracket_pos === leftPos) return true;
      if (parent.bracket_pos === leftPos + 1) return false;
    }
    return true; // default
  };

  /** Compute winner from scores (no winner_team_id in type) */
  const calcWinnerId = (m: Match): number | null => {
    if (m.status !== "finished") return null;
    const a = typeof m.team_a_score === "number" ? m.team_a_score : null;
    const b = typeof m.team_b_score === "number" ? m.team_b_score : null;
    if (a == null || b == null) return null;
    if (a > b) return m.team_a_id ?? null;
    if (b > a) return m.team_b_id ?? null;
    return null; // draw → no progression
  };

  /** UI-only winner carry-over (no DB writes) */
  const smartTeams = useMemo(() => {
    const map = new Map<number, { a: number | null; b: number | null }>();
    for (const child of matches) {
      let a = child.team_a_id ?? null;
      let b = child.team_b_id ?? null;

      const parents = resolveParents(child);
      for (const p of parents) {
        if (!p || isStubId(p.id)) continue;
        const winner = calcWinnerId(p);
        if (!winner) continue;

        if (feedsA(child, p)) {
          if (a == null) a = winner;
        } else {
          if (b == null) b = winner;
        }
      }
      map.set(child.id, { a, b });
    }
    return map;
  }, [matches, edgesKey, isStubId]);

  /** DOM refs, measuring & paths */
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const setNodeRef = (id: number) => (el: HTMLDivElement | null) => {
    if (!el) nodeRefs.current.delete(id);
    else nodeRefs.current.set(id, el);
  };

  const baseCenters = useRef<Map<string, number>>(new Map());
  const baseHeights = useRef<Map<string, number>>(new Map());
  const keyRB = (ri: number, idxInRound: number) => `${ri}:${idxInRound}`;

  const [transforms, setTransforms] = useState<Map<number, number>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);

  const getTranslateY = (el: Element) => {
    const t = window.getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    if (t.startsWith("matrix3d(")) {
      const v = t
        .slice(9, -1)
        .split(",")
        .map((x) => parseFloat(x.trim()));
      return Number.isFinite(v[13]) ? v[13] : 0;
    }
    if (t.startsWith("matrix(")) {
      const v = t
        .slice(7, -1)
        .split(",")
        .map((x) => parseFloat(x.trim()));
      return Number.isFinite(v[5]) ? v[5] : 0;
    }
    return 0;
  };

  const measureBase = () => {
    const cont = containerRef.current;
    if (!cont) return;
    const cbox = cont.getBoundingClientRect();
    const centers: Map<string, number> = new Map();
    const heights: Map<string, number> = new Map();

    rounds.forEach((col, ri) => {
      col.list.forEach((m, idx) => {
        const el = nodeRefs.current.get(m.id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ty = getTranslateY(el);
        const center = rect.top + rect.height / 2 - cbox.top - ty;
        centers.set(keyRB(ri, idx), center);

        const isStub = isStubId(m.id);
        const h = isStub ? rect.height : Math.max(minCardHeight, rect.height);
        heights.set(keyRB(ri, idx), h);
      });
    });

    baseCenters.current = centers;
    baseHeights.current = heights;
  };

  /**
   * Layout:
   *  - For real parents: child y = avg(parent ys)
   *  - For BYE-only parents (stubs): align stub to child
   *  - Then enforce measured non-overlap for the CURRENT round only.
   */
  const computeTransforms = () => {
    const centers = baseCenters.current;
    if (!centers.size) return new Map<number, number>();

    const heightsMap = baseHeights.current;

    const indexOf: Map<number, { ri: number; idx: number }> = new Map();
    rounds.forEach((col, ri) => col.list.forEach((m, idx) => indexOf.set(m.id, { ri, idx })));

    const targets: number[][] = rounds.map((_col, ri) =>
      rounds[ri].list.map((_m, idx) => centers.get(keyRB(ri, idx)) ?? 0)
    );
    const heights: number[][] = rounds.map((_col, ri) =>
      rounds[ri].list.map((_m, idx) => heightsMap.get(keyRB(ri, idx)) ?? minCardHeight)
    );

    for (let ri = 1; ri < rounds.length; ri++) {
      const curr = rounds[ri].list;
      const prevTargets = targets[ri - 1];

      curr.forEach((m, idx) => {
        const exp = expectedParents(m);
        const yExp = exp
          .filter((p) => !isStubId(p.id))
          .map((p) => {
            const pos = indexOf.get(p.id);
            return pos ? prevTargets[pos.idx] : null;
          })
          .filter((n): n is number => Number.isFinite(n));
        if (yExp.length >= 1) {
          const avg = yExp.reduce((a, b) => a + b, 0) / yExp.length;
          targets[ri][idx] = avg;
        } else {
          const res = resolveParents(m).filter((p) => !isStubId(p.id));
          const yRes = res
            .map((p) => {
              const pos = indexOf.get(p.id);
              return pos ? prevTargets[pos.idx] : null;
            })
            .filter((n): n is number => Number.isFinite(n));
          if (yRes.length >= 1) {
            const avg = yRes.reduce((a, b) => a + b, 0) / yRes.length;
            targets[ri][idx] = avg;
          }
        }
      });

      curr.forEach((m, idx) => {
        const expAll = expectedParents(m);
        expAll.forEach((p) => {
          if (!isStubId(p.id)) return;
          const pos = indexOf.get(p.id);
          if (pos) targets[ri - 1][pos.idx] = targets[ri][idx];
        });
      });

      for (let i = 1; i < curr.length; i++) {
        const required = (heights[ri][i - 1] + heights[ri][i]) / 2 + Math.max(0, minRowGap);
        if (targets[ri][i] < targets[ri][i - 1] + required) targets[ri][i] = targets[ri][i - 1] + required;
      }
      for (let i = curr.length - 2; i >= 0; i--) {
        const required = (heights[ri][i + 1] + heights[ri][i]) / 2 + Math.max(0, minRowGap);
        if (targets[ri][i] > targets[ri][i + 1] - required)
          targets[ri][i] = Math.min(targets[ri][i + 1] - required, targets[ri][i]);
      }
    }

    const next: Map<number, number> = new Map();
    rounds.forEach((col, ri) => {
      col.list.forEach((m, idx) => {
        const baseY = centers.get(keyRB(ri, idx)) ?? 0;
        const tgtY = targets[ri][idx] ?? baseY;
        next.set(m.id, tgtY - baseY);
      });
    });
    return next;
  };

  /** Compute SVG paths using measured centers + our transforms */
  const computePaths = () => {
    const cont = containerRef.current;
    if (!cont) return;

    const cbox = cont.getBoundingClientRect();
    const indexOf: Map<number, { ri: number; idx: number }> = new Map();
    rounds.forEach((col, ri) => col.list.forEach((m, idx) => indexOf.set(m.id, { ri, idx })));

    type XY = { x: number; y: number };

    const centerRight = (id: number): XY | null => {
      const el = nodeRefs.current.get(id);
      const pos = indexOf.get(id);
      if (!el || !pos) return null;
      const r = el.getBoundingClientRect();
      const baseY = baseCenters.current.get(keyRB(pos.ri, pos.idx)) ?? 0;
      const ty = transforms.get(id) ?? 0;
      return { x: r.right - cbox.left, y: baseY + ty };
    };

    const centerLeft = (id: number): XY | null => {
      const el = nodeRefs.current.get(id);
      const pos = indexOf.get(id);
      if (!el || !pos) return null;
      const r = el.getBoundingClientRect();
      const baseY = baseCenters.current.get(keyRB(pos.ri, pos.idx)) ?? 0;
      const ty = transforms.get(id) ?? 0;
      return { x: r.left - cbox.left, y: baseY + ty };
    };

    const ds: string[] = [];
    edgesByPair.forEach(({ fromId, toId }) => {
      if (isStubId(fromId) || isStubId(toId)) return;
      const a = centerRight(fromId);
      const b = centerLeft(toId);
      if (!a || !b) return;

      const t = 0.35;
      const dx = b.x - a.x;
      const cx1 = a.x + t * dx;
      const cx2 = b.x - t * dx;
      ds.push(`M ${a.x} ${a.y} C ${cx1} ${a.y} ${cx2} ${b.y} ${b.x} ${b.y}`);
    });

    setPaths(ds);
  };

  /** Layout columns & gaps */
  const cols = rounds.length || 1;
  const autoCol = colWidth ?? (cols > maxAutoFit ? 220 : 280);
  const autoGap = gapX ?? (cols > maxAutoFit ? 12 : 16);

  /** Round labels (numbered by column index by default) */
  const defaultLabel = (a: RoundLabelFnArgs) => L.roundN(a.index + 1);
  const labelFor = (round: number, idx: number) => {
    const { matchesInRound, teamsInRound } = counts[idx] ?? { matchesInRound: 0, teamsInRound: 0 };
    const fn = roundLabelFn ?? defaultLabel;
    return fn({ round, index: idx, total: cols, matchesInRound, teamsInRound });
  };

  /** Lifecycle: measure & recompute */
  useEffect(() => {
    let raf1 = 0,
      raf2 = 0;
    setTransforms(new Map());
    raf1 = requestAnimationFrame(() => {
      measureBase();
      const abs = computeTransforms();
      setTransforms(abs);
      raf2 = requestAnimationFrame(() => computePaths());
    });

    const ro = new ResizeObserver(() => {
      measureBase();
      const abs = computeTransforms();
      setTransforms(abs);
      requestAnimationFrame(computePaths);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    nodeRefs.current.forEach((el) => ro.observe(el));

    const onReflow = () => requestAnimationFrame(computePaths);
    window.addEventListener("resize", onReflow, { passive: true });
    window.addEventListener("scroll", onReflow, { passive: true });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, cols, edgesKey, minCardHeight, minRowGap]);

  useEffect(() => {
    requestAnimationFrame(computePaths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transforms, edgesKey]);

  /** BYE badge helper */
  const hadBye = (roundIdx: number, teamId: number | null) => {
    if (teamId == null) return false;
    if (roundIdx === 0) return false;
    const prev = teamsPerRound[roundIdx - 1];
    return !prev?.has(teamId);
  };

  const titleText = lang === "el" && title === "Knockout Bracket" ? "Δέντρο Νοκ-άουτ" : title;

  /** ------------ First-round seeding helpers ------------ */
  const firstRound = rounds[0]?.list ?? [];

  const eligible: number[] = useMemo(() => {
    const ids =
      eligibleTeamIds && eligibleTeamIds.length
        ? eligibleTeamIds
        : Object.keys(teamsMap).map((x) => Number(x));
    return ids.filter((id) => teamsMap[id]?.seed != null);
  }, [eligibleTeamIds, teamsMap]);

  const assignedIdsFR = useMemo(() => {
    const ids = new Set<number>();
    firstRound.forEach((m) => {
      if (m.team_a_id != null) ids.add(m.team_a_id);
      if (m.team_b_id != null) ids.add(m.team_b_id);
    });
    return ids;
  }, [firstRound]);

  const usedSeedsFR = useMemo(() => {
    const used = new Set<number>();
    firstRound.forEach((m) => {
      const sa = m.team_a_id != null ? teamsMap[m.team_a_id]?.seed : null;
      const sb = m.team_b_id != null ? teamsMap[m.team_b_id]?.seed : null;
      if (sa != null) used.add(sa as number);
      if (sb != null) used.add(sb as number);
    });
    return used;
  }, [firstRound, teamsMap]);

  type Option = { id: number | null; label: string; disabled: boolean; reason?: string };
  const makeOptions = (currentTeamId: number | null): Option[] => {
    const currentSeed = currentTeamId != null ? (teamsMap[currentTeamId]?.seed ?? null) : null;
    const opts: Option[] = [
      { id: null, label: lang === "el" ? "— Κενό —" : "— Empty —", disabled: false },
      ...eligible
        .map((id) => {
          const t = teamsMap[id];
          const s = t?.seed ?? null;
          const takenByTeam = assignedIdsFR.has(id) && id !== currentTeamId;
          const duplicateSeed = s != null && usedSeedsFR.has(s as number) && s !== currentSeed;
          return {
            id,
            label: s != null ? `#${s} — ${t?.name ?? id}` : t?.name ?? String(id),
            disabled: takenByTeam || duplicateSeed,
            reason: takenByTeam ? "already in bracket" : duplicateSeed ? L.seedTaken : undefined,
          } as Option;
        })
        .sort((a: Option, b: Option) => {
          const sa = a.id != null ? (teamsMap[a.id]?.seed ?? 9999) : 9999;
          const sb = b.id != null ? (teamsMap[b.id]?.seed ?? 9999) : 9999;
          return sa - sb;
        }),
    ];
    return opts;
  };

  /** Combined auto-seed: call parent to assign seeds, then pair 1..N vs N..1 */
  const autoSeedAndPair = async () => {
    let orderedIds: number[] | null = null;
    if (onAutoAssignTeamSeeds) {
      try {
        const res = await Promise.resolve(onAutoAssignTeamSeeds());
        if (Array.isArray(res)) orderedIds = res;
      } catch {}
    }

    const pool: number[] =
      orderedIds ??
      eligible
        .map((id) => ({ id, seed: teamsMap[id]?.seed ?? Infinity }))
        .filter((x) => Number.isFinite(x.seed))
        .sort((a, b) => a.seed - b.seed)
        .map((x) => x.id);

    const S = firstRound.length * 2;
    const top = pool.slice(0, S);

    const rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }> =
      firstRound.map((m, i) => ({
        matchId: m.id,
        team_a_id: top[i] ?? null,
        team_b_id: top[S - 1 - i] ?? null,
      }));

    if (onBulkAssignFirstRound) onBulkAssignFirstRound(rows);
    else if (onAssignSlot) {
      rows.forEach((r) => {
        onAssignSlot(r.matchId, "A", r.team_a_id);
        onAssignSlot(r.matchId, "B", r.team_b_id);
      });
    }
  };

  /** ---------- render ---------- */
  return (
    <section className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{titleText}</h2>

        {editable && firstRound.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
              onClick={autoSeedAndPair}
              title={L.autoSeed}
            >
              {L.autoSeed}
            </button>
            <button
              className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
              onClick={onClearFirstRound}
              title={L.clearRound}
            >
              {L.clearRound}
            </button>
          </div>
        )}
      </div>

      <div className="relative overflow-x-auto">
        <div
          ref={containerRef}
          className="relative grid auto-rows-min sm:grid-flow-col gap-x-4"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(${autoCol}px, ${autoCol}px))`,
            columnGap: autoGap,
          }}
        >
          {/* SVG overlay */}
          <CanvasBacklight paths={paths} />

          {/* Columns */}
          {rounds.map(({ round, list }, roundIdx) => (
            <div key={round} className="relative z-[1] flex flex-col gap-6 py-2 overflow-visible">
              <div className="px-1 text-sm tracking-wide uppercase text-white/60">
                {labelFor(round, roundIdx)}
              </div>

              {list.map((m) => {
                const stub = isStubId(m.id);

                if (stub) {
                  return (
                    <div
                      key={m.id}
                      ref={setNodeRef(m.id)}
                      aria-hidden="true"
                      className="relative opacity-0 pointer-events-none select-none rounded-md border border-transparent bg-transparent text-transparent text-xs px-2 py-1 w-[160px] mx-1"
                      style={{ transform: `translateY(${transforms.get(m.id) ?? 0}px)` }}
                    >
                      BYE
                    </div>
                  );
                }

                // Detect if either slot is fed by a parent pointer of any shape
                const hasHomePtr =
                  !!(m as any).home_source_match_id ||
                  Number.isFinite((m as any).home_source_round) ||
                  Number.isFinite((m as any).home_source_match_idx);
                const hasAwayPtr =
                  !!(m as any).away_source_match_id ||
                  Number.isFinite((m as any).away_source_round) ||
                  Number.isFinite((m as any).away_source_match_idx);

                const disableA = !!hasHomePtr;
                const disableB = !!hasAwayPtr;

                const isEditableCard =
                  editable && !!onAssignSlot && (roundIdx === 0 || (!hasHomePtr && !hasAwayPtr));

                return (
                  <div
                    key={m.id}
                    ref={setNodeRef(m.id)}
                    onClick={!isEditableCard && onMatchClick ? () => onMatchClick(m) : undefined}
                    className="group relative rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/60 hover:border-white/25 hover:shadow-lg hover:shadow-emerald-500/10 transition-colors p-3 will-change-transform"
                    style={{
                      minHeight: minCardHeight,
                      transform: `translateY(${transforms.get(m.id) ?? 0}px)`,
                    }}
                  >
                    {isEditableCard ? (
                      <EditablePairCard
                        match={m}
                        teamsMap={teamsMap}
                        L={L}
                        onAssign={onAssignSlot!}
                        onSwap={onSwapPair}
                        makeOptions={makeOptions}
                        disableA={disableA}
                        disableB={disableB}
                      />
                    ) : (
                      (() => {
                        const eff = smartTeams.get(m.id);
                        const aId = eff?.a ?? m.team_a_id ?? null;
                        const bId = eff?.b ?? m.team_b_id ?? null;

                        return (
                          <>
                            <MatchRow
                              id={aId}
                              score={m.status === "finished" ? m.team_a_score : null}
                              teamsMap={teamsMap}
                              tbdText={L.tbd}
                              byeBadge={hadBye(roundIdx, aId) ? L.bye : null}
                            />
                            <div className="h-1" />
                            <MatchRow
                              id={bId}
                              score={m.status === "finished" ? m.team_b_score : null}
                              teamsMap={teamsMap}
                              tbdText={L.tbd}
                              byeBadge={hadBye(roundIdx, bId) ? L.bye : null}
                            />
                          </>
                        );
                      })()
                    )}
                  </div>
                );
              })}

              {list.length === 0 && <div className="text-white/50 text-sm italic">—</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
