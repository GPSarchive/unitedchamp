// app/components/DashboardPageComponents/TournamentCURD/ModernKnockoutTree.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";
import { getLabels } from "./KnockoutTreeComponents/labels";
import MatchRow from "./KnockoutTreeComponents/MatchRow";
import EditablePairCard from "./KnockoutTreeComponents/EditablePairCard";

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

  /** Autoseed is now opt-in via this toggle; default = false (hidden) */
  showAutoSeedButton?: boolean;
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
};

type Edge = { fromId: number; toId: number };
type Option = { id: number | null; label: string; disabled: boolean; reason?: string };

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
  /** NEW: default hidden so planner stays the source of truth */
  showAutoSeedButton = false,
  onAutoAssignTeamSeeds,
}: ModernKnockoutTreeProps) {
  const L: Labels = useMemo(() => getLabels(lang, labels), [lang, labels]);

  /** Group by round & sort by bracket_pos */
  const rounds = useMemo(() => {
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

  /** Teams seen per round (BYE badge) */
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

  /** Edges across rounds: explicit OR fallback */
  const edgesByPair = useMemo(() => {
    const out: Edge[] = [];
    for (let ri = 1; ri < rounds.length; ri++) {
      const prev = rounds[ri - 1].list;
      const curr = rounds[ri].list;

      const seen = new Set<string>();
      const incoming = new Map<number, number>();

      curr.forEach((m) => {
        if (m.home_source_match_id) {
          const k = `${m.home_source_match_id}->${m.id}`;
          if (!seen.has(k)) {
            out.push({ fromId: m.home_source_match_id, toId: m.id });
            seen.add(k);
            incoming.set(m.id, (incoming.get(m.id) ?? 0) + 1);
          }
        }
        if (m.away_source_match_id) {
          const k = `${m.away_source_match_id}->${m.id}`;
          if (!seen.has(k)) {
            out.push({ fromId: m.away_source_match_id, toId: m.id });
            seen.add(k);
            incoming.set(m.id, (incoming.get(m.id) ?? 0) + 1);
          }
        }
      });

      const M = prev.length;
      const N = curr.length || 1;
      const buckets: number[][] = Array.from({ length: N }, () => []);
      prev.forEach((_p, i) => {
        const j = Math.floor((i * N) / Math.max(1, M));
        buckets[Math.min(N - 1, Math.max(0, j))].push(i);
      });

      curr.forEach((m, j) => {
        if ((incoming.get(m.id) ?? 0) > 0) return;
        const ids = buckets[j];
        if (!ids?.length) return;
        ids.forEach((i) => {
          const k = `${prev[i].id}->${m.id}`;
          if (!seen.has(k)) {
            out.push({ fromId: prev[i].id, toId: m.id });
            seen.add(k);
          }
        });
      });
    }
    const uniq = new Set<string>();
    return out.filter((e) => {
      const k = `${e.fromId}->${e.toId}`;
      if (uniq.has(k)) return false;
      uniq.add(k);
      return true;
    });
  }, [rounds]);

  const edgesKey = useMemo(
    () => edgesByPair.map((e) => `${e.fromId}->${e.toId}`).sort().join(","),
    [edgesByPair]
  );

  /** DOM + layout refs */
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const setNodeRef = (id: number) => (el: HTMLDivElement | null) => {
    if (!el) nodeRefs.current.delete(id);
    else nodeRefs.current.set(id, el);
  };

  const baseCenters = useRef<Map<string, number>>(new Map());
  const keyRB = (ri: number, idxInRound: number) => `${ri}:${idxInRound}`;

  const [transforms, setTransforms] = useState<Map<number, number>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);
  const [canvasHeight, setCanvasHeight] = useState<number | undefined>(undefined);

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
    const map = new Map<string, number>();
    rounds.forEach((col, ri) => {
      col.list.forEach((m, idx) => {
        const el = nodeRefs.current.get(m.id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ty = getTranslateY(el);
        const center = rect.top + rect.height / 2 - cbox.top - ty;
        map.set(keyRB(ri, idx), center);
      });
    });
    baseCenters.current = map;
  };

  const computeTransforms = () => {
    const base = baseCenters.current;
    if (!base.size) return new Map<number, number>();

    const targets: number[][] = rounds.map((_col, ri) =>
      rounds[ri].list.map((_m, idx) => base.get(keyRB(ri, idx)) ?? 0)
    );

    const indexOf = new Map<number, { ri: number; idx: number }>();
    rounds.forEach((col, ri) => col.list.forEach((m, idx) => indexOf.set(m.id, { ri, idx })));

    const adjFromPrev: Map<string, number[]> = new Map();
    edgesByPair.forEach(({ fromId, toId }) => {
      const src = indexOf.get(fromId);
      const dst = indexOf.get(toId);
      if (!src || !dst) return;
      if (dst.ri !== src.ri + 1) return;
      const k = keyRB(dst.ri, dst.idx);
      const arr = adjFromPrev.get(k) ?? [];
      arr.push(src.idx);
      adjFromPrev.set(k, arr);
    });

    for (let ri = 1; ri < rounds.length; ri++) {
      const prevCount = rounds[ri - 1].list.length;
      const currCount = rounds[ri].list.length;

      const buckets: number[][] = (() => {
        const B: number[][] = Array.from({ length: Math.max(1, currCount) }, () => []);
        for (let i = 0; i < prevCount; i++) {
          const j = Math.floor((i * Math.max(1, currCount)) / Math.max(1, prevCount));
          B[Math.min(currCount - 1, Math.max(0, j))].push(i);
        }
        return B;
      })();

      for (let idx = 0; idx < currCount; idx++) {
        const k = keyRB(ri, idx);
        const explicit = adjFromPrev.get(k);
        const prevTargets = targets[ri - 1];
        let desired: number | null = null;

        if (explicit?.length) {
          const ys = explicit.map((pi) => prevTargets[pi]).filter((n) => Number.isFinite(n));
          if (ys.length) desired = ys.reduce((a, b) => a + b, 0) / ys.length;
        }
        if (desired == null) {
          const ids = buckets[idx] ?? [];
          const ys = ids.map((pi) => prevTargets[pi]).filter((n) => Number.isFinite(n));
          if (ys.length) desired = ys.reduce((a, b) => a + b, 0) / ys.length;
        }
        targets[ri][idx] = desired ?? targets[ri][idx];
      }

      const minCenterGap = minCardHeight + minRowGap;
      for (let i = 1; i < currCount; i++) {
        if (targets[ri][i] < targets[ri][i - 1] + minCenterGap) {
          targets[ri][i] = targets[ri][i - 1] + minCenterGap;
        }
      }
      for (let i = currCount - 2; i >= 0; i--) {
        if (targets[ri][i] > targets[ri][i + 1] - minCenterGap) {
          targets[ri][i] = Math.min(targets[ri][i + 1] - minCenterGap, targets[ri][i]);
        }
      }
    }

    const next = new Map<number, number>();
    rounds.forEach((col, ri) => {
      col.list.forEach((m, idx) => {
        const baseY = base.get(keyRB(ri, idx)) ?? 0;
        const tgtY = targets[ri][idx] ?? baseY;
        next.set(m.id, tgtY - baseY);
      });
    });
    return next;
  };

  const computePaths = () => {
    const cont = containerRef.current;
    if (!cont) return;
    const cbox = cont.getBoundingClientRect();

    const centerRight = (id: number) => {
      const el = nodeRefs.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.right - cbox.left, y: r.top + r.height / 2 - cbox.top };
    };
    const centerLeft = (id: number) => {
      const el = nodeRefs.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - cbox.left, y: r.top + r.height / 2 - cbox.top };
    };

    // ensure SVG canvas covers translated cards
    let maxY = 0;
    nodeRefs.current.forEach((el) => {
      const r = el.getBoundingClientRect();
      const height = r.bottom - cbox.top;
      if (height > maxY) maxY = height;
    });
    if (maxY > 0) setCanvasHeight(Math.ceil(maxY + 16));

    const ds: string[] = [];
    edgesByPair.forEach(({ fromId, toId }) => {
      const a = centerRight(fromId);
      const b = centerLeft(toId);
      if (!a || !b) return;
      const midX = (a.x + b.x) / 2;
      ds.push(
        `M ${a.x} ${a.y}
         L ${midX - 8} ${a.y}
         Q ${midX} ${a.y} ${midX} ${(a.y + b.y) / 2}
         T ${midX} ${b.y}
         L ${b.x} ${b.y}`
      );
    });
    setPaths(ds);
  };

  const cols = rounds.length || 1;
  const autoCol = colWidth ?? (cols > maxAutoFit ? 220 : 280);
  const autoGap = gapX ?? (cols > maxAutoFit ? 12 : 16);

  const defaultLabel = (a: RoundLabelFnArgs) => L.roundN(a.index + 1);
  const labelFor = (round: number, idx: number) => {
    const { matchesInRound, teamsInRound } = counts[idx] ?? { matchesInRound: 0, teamsInRound: 0 };
    const fn = roundLabelFn ?? defaultLabel;
    return fn({ round, index: idx, total: cols, matchesInRound, teamsInRound });
  };

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

  const hadBye = (roundIdx: number, teamId: number | null) => {
    if (teamId == null) return false;
    if (roundIdx === 0) return false;
    const prev = teamsPerRound[roundIdx - 1];
    return !prev?.has(teamId);
  };

  const titleText = lang === "el" && title === "Knockout Bracket" ? "Δέντρο Νοκ-άουτ" : title;

  /** ---------- Options (global duplicate guards) ---------- */
  const eligible: number[] = useMemo(() => {
    const ids =
      eligibleTeamIds && eligibleTeamIds.length
        ? eligibleTeamIds
        : Object.keys(teamsMap).map((x) => Number(x));
    return ids.filter((id) => teamsMap[id]?.seed != null);
  }, [eligibleTeamIds, teamsMap]);

  const assignedIdsGlobal = useMemo(() => {
    const ids = new Set<number>();
    matches.forEach((m) => {
      if (m.team_a_id != null) ids.add(m.team_a_id);
      if (m.team_b_id != null) ids.add(m.team_b_id);
    });
    return ids;
  }, [matches]);

  const usedSeedsGlobal = useMemo(() => {
    const used = new Set<number>();
    assignedIdsGlobal.forEach((id) => {
      const s = teamsMap[id]?.seed;
      if (s != null) used.add(s);
    });
    return used;
  }, [assignedIdsGlobal, teamsMap]);

  const makeOptions = (currentTeamId: number | null): Option[] => {
    const currentSeed = currentTeamId != null ? teamsMap[currentTeamId]?.seed ?? null : null;
    return [
      { id: null, label: lang === "el" ? "— Κενό —" : "— Empty —", disabled: false },
      ...eligible
        .map((id) => {
          const t = teamsMap[id];
          const s = t?.seed ?? null;
          const takenByTeam = assignedIdsGlobal.has(id) && id !== currentTeamId;
          const duplicateSeed = s != null && usedSeedsGlobal.has(s) && s !== currentSeed;
          return {
            id,
            label: s != null ? `#${s} — ${t?.name ?? id}` : t?.name ?? String(id),
            disabled: takenByTeam || duplicateSeed,
            reason: takenByTeam ? "already in bracket" : duplicateSeed ? L.seedTaken : undefined,
          };
        })
        .sort((a, b) => {
          const sa = a.id != null ? (teamsMap[a.id!]?.seed ?? 9999) : 9999;
          const sb = b.id != null ? (teamsMap[b.id!]?.seed ?? 9999) : 9999;
          return sa - sb;
        }),
    ];
  };

  /** Keep auto-seed behavior but hide the button unless explicitly asked for */
  const firstRound = rounds[0]?.list ?? [];
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

    const total = pool.length;
    const S = firstRound.length * 2;
    const playInCount = Math.min(S, total);
    const byeCount = Math.max(0, total - playInCount);

    const r1Seeds = pool.slice(byeCount);
    const rows = firstRound.map((m, i) => ({
      matchId: m.id,
      team_a_id: r1Seeds[i] ?? null,
      team_b_id: r1Seeds[r1Seeds.length - 1 - i] ?? null,
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

        {editable && (
          <div className="flex items-center gap-2">
            {showAutoSeedButton && firstRound.length > 0 && (
              <button
                className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
                onClick={autoSeedAndPair}
                title={L.autoSeed}
              >
                {L.autoSeed}
              </button>
            )}
            {onClearFirstRound && (
              <button
                className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
                onClick={onClearFirstRound}
                title={L.clearRound}
              >
                {L.clearRound}
              </button>
            )}
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
            minHeight: canvasHeight,
          }}
        >
          {/* SVG overlay */}
          <svg className="pointer-events-none absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="brkt" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.65" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="url(#brkt)"
                strokeWidth={2}
                filter="url(#glow)"
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/* Columns */}
          {rounds.map(({ round, list }, roundIdx) => (
            <div key={round} className="flex flex-col gap-6 py-2 overflow-visible">
              <div className="px-1 text-sm tracking-wide uppercase text-white/60">
                {labelFor(round, roundIdx)}
              </div>

              {list.map((m) => {
                /** per-slot locks: parented slots are read-only, BYE slots are editable */
                const isEditableCard = editable && !!onAssignSlot;
                const disableA = !!m.home_source_match_id; // slot A comes from a previous match
                const disableB = !!m.away_source_match_id; // slot B comes from a previous match

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
                      <>
                        <MatchRow
                          id={m.team_a_id}
                          score={m.status === "finished" ? m.team_a_score : null}
                          teamsMap={teamsMap}
                          tbdText={L.tbd}
                          byeBadge={hadBye(roundIdx, m.team_a_id) ? L.bye : null}
                        />
                        <div className="h-1" />
                        <MatchRow
                          id={m.team_b_id}
                          score={m.status === "finished" ? m.team_b_score : null}
                          teamsMap={teamsMap}
                          tbdText={L.tbd}
                          byeBadge={hadBye(roundIdx, m.team_b_id) ? L.bye : null}
                        />
                      </>
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
