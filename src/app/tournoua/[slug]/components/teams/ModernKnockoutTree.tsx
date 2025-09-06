// app/tournoua/[slug]/components/teams/ModernKnockoutTree.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Match = {
  id: number;
  round: number | null;
  bracket_pos: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: "scheduled" | "live" | "finished" | string;
  home_source_match_id?: number | null;
  away_source_match_id?: number | null;
};

type TeamsMap = Record<number, { name: string; logo?: string | null; seed?: number | null }>;
type Edge = { fromId: number; toId: number };

type RoundLabelFnArgs = {
  round: number;
  index: number;
  total: number;
  matchesInRound: number;
  teamsInRound: number;
};

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
}: {
  title?: string;
  matches: Match[];
  teamsMap: TeamsMap;
  onMatchClick?: (m: Match) => void;
  roundLabelFn?: (a: RoundLabelFnArgs) => string;
  colWidth?: number;
  minCardHeight?: number;
  gapX?: number;
  maxAutoFit?: number;
}) {
  /** group by round & sort by bracket_pos */
  const rounds = useMemo(() => {
    const m = new Map<number, Match[]>();
    matches.forEach((x) => {
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

  const counts = useMemo(
    () =>
      rounds.map((col) => {
        const matchesInRound = col.list.length;
        const teamsInRound = matchesInRound > 1 ? matchesInRound * 2 : 2;
        return { round: col.round, matchesInRound, teamsInRound };
      }),
    [rounds]
  );

  /** build edge list (explicit first, else infer 2k−1/2k) */
  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    const byRound = new Map<number, Match[]>();
    rounds.forEach((c) => byRound.set(c.round, c.list));

    matches.forEach((m) => {
      if (m.home_source_match_id) out.push({ fromId: m.home_source_match_id, toId: m.id });
      if (m.away_source_match_id) out.push({ fromId: m.away_source_match_id, toId: m.id });
    });

    if (!out.length) {
      const rkeys = rounds.map((r) => r.round);
      for (let i = 1; i < rkeys.length; i++) {
        const prev = (byRound.get(rkeys[i - 1]) ?? []).slice().sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0));
        const curr = (byRound.get(rkeys[i]) ?? []).slice().sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0));
        curr.forEach((m, idx) => {
          const a = prev[2 * idx];
          const b = prev[2 * idx + 1];
          if (a) out.push({ fromId: a.id, toId: m.id });
          if (b) out.push({ fromId: b.id, toId: m.id });
        });
      }
    }
    const seen = new Set<string>();
    return out.filter((e) => {
      const k = `${e.fromId}->${e.toId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [matches, rounds]);

  /** refs & state */
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<number, HTMLDivElement>());
  const setNodeRef = (id: number) => (el: HTMLDivElement | null) => {
    if (!el) nodeRefs.current.delete(id);
    else nodeRefs.current.set(id, el);
  };

  // untransformed centers per (roundIndex, bracket_pos) measured from DOM
  const baseCenters = useRef<Map<string, number>>(new Map());
  const [transforms, setTransforms] = useState<Map<number, number>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);

  const roundIndexByRound = useMemo(() => {
    const map = new Map<number, number>();
    rounds.forEach((c, i) => map.set(c.round, i));
    return map;
  }, [rounds]);

  const listByRoundIndex = useMemo(() => rounds.map((c) => c.list), [rounds]);

  const keyRB = (ri: number, bp: number | null | undefined) => `${ri}:${bp ?? 0}`;

  /** measure current base centers (subtract current transform) for all nodes */
  const measureBase = () => {
    const cont = containerRef.current;
    if (!cont) return;
    const cbox = cont.getBoundingClientRect();
    const map = new Map<string, number>();

    rounds.forEach((col, ri) => {
      col.list.forEach((m) => {
        const el = nodeRefs.current.get(m.id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ty = getTranslateY(el);
        const center = rect.top + rect.height / 2 - cbox.top - ty; // base center
        map.set(keyRB(ri, m.bracket_pos), center);
      });
    });

    baseCenters.current = map;
  };

  const getTranslateY = (el: Element) => {
    const t = window.getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    if (t.startsWith("matrix3d(")) {
      const v = t.slice(9, -1).split(",").map((x) => parseFloat(x.trim()));
      return Number.isFinite(v[13]) ? v[13] : 0;
    }
    if (t.startsWith("matrix(")) {
      const v = t.slice(7, -1).split(",").map((x) => parseFloat(x.trim()));
      return Number.isFinite(v[5]) ? v[5] : 0;
    }
    return 0;
  };

  /** compute canonical targets for every round/slot, then absolute transforms */
  const computeTransforms = () => {
    const base = baseCenters.current;
    if (!base.size) return new Map<number, number>();

    // 1) start with leftmost round centers as-is
    const targets: Map<string, number> = new Map(base);

    // helper to read a base/target center
    const read = (ri: number, bp?: number | null) => targets.get(keyRB(ri, bp ?? 0));

    // 2) propagate right: compute target center for each slot using previous round slots
    for (let ri = 1; ri < rounds.length; ri++) {
      const prevCount = listByRoundIndex[ri - 1]?.length ?? 0;
      const currCount = listByRoundIndex[ri]?.length ?? 0;

      const sameCountPlayIn = prevCount === currCount && prevCount > 0; // 24-team R24->R16
      const halving = prevCount === currCount * 2;                      // normal 32→16, 16→8...

      rounds[ri].list.forEach((m) => {
        const bp = m.bracket_pos ?? 0;

        // derive which prev bracket_pos feed this match
        const prevPoses: number[] = [];
        edges.forEach(({ fromId, toId }) => {
          if (toId !== m.id) return;
          const src = rounds[ri - 1].list.find((x) => x.id === fromId);
          if (src?.bracket_pos != null) prevPoses.push(src.bracket_pos);
        });

        let aPos: number | undefined;
        let bPos: number | undefined;

        if (halving) {
          // standard: (2p-1, 2p)
          aPos = 2 * bp - 1;
          bPos = 2 * bp;
        } else if (sameCountPlayIn) {
          // play-in with byes: mirror pair within 1..Nprev  (e.g., 1↔N, 2↔N-1)
          // if we have one real source pos, mirror it; otherwise mirror the theoretical slot from bracket_pos
          const N = prevCount;
          if (prevPoses.length === 1) {
            aPos = prevPoses[0];
            bPos = N + 1 - aPos;
          } else {
            // fallback: mirror based on nearest theoretical pairing to keep grid tidy
            // use a symmetric mapping that spreads evenly across the column
            // map bp in 1..N to (bp, N+1-bp)
            aPos = Math.max(1, Math.min(N, bp));
            bPos = N + 1 - aPos;
          }
        } else {
          // unknown ratio; try adjacency as a reasonable default
          aPos = 2 * bp - 1;
          bPos = 2 * bp;
        }

        const aY = read(ri - 1, aPos);
        const bY = read(ri - 1, bPos);
        const desired =
          aY != null && bY != null
            ? (aY + bY) / 2
            : aY != null
            ? aY
            : bY != null
            ? bY
            : base.get(keyRB(ri, bp)); // last resort: stay

        if (desired != null) targets.set(keyRB(ri, bp), desired);
      });
    }

    // 3) absolute transform per node = target - base
    const next = new Map<number, number>();
    rounds.forEach((col, ri) => {
      col.list.forEach((m) => {
        const baseY = base.get(keyRB(ri, m.bracket_pos ?? 0));
        const tgtY = targets.get(keyRB(ri, m.bracket_pos ?? 0));
        if (baseY != null && tgtY != null) next.set(m.id, tgtY - baseY);
      });
    });
    return next;
  };

  /** connectors after transforms applied */
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
    const ds: string[] = [];
    edges.forEach(({ fromId, toId }) => {
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

  // layout sizing
  const cols = rounds.length || 1;
  const autoCol = colWidth ?? (cols > maxAutoFit ? 220 : 280);
  const autoGap = gapX ?? (cols > maxAutoFit ? 12 : 16);

  const defaultLabel = (a: RoundLabelFnArgs) => {
    const n = a.teamsInRound;
    if (n === 2) return "Final";
    if (n === 4) return "Semi-finals";
    if (n === 8) return "Quarter-finals";
    if ([16, 32, 64, 128].includes(n)) return `Round of ${n}`;
    return `Round ${a.round}`;
  };
  const labelFor = (round: number, idx: number) => {
    const { matchesInRound, teamsInRound } = counts[idx] ?? { matchesInRound: 0, teamsInRound: 0 };
    const fn = roundLabelFn ?? defaultLabel;
    return fn({ round, index: idx, total: cols, matchesInRound, teamsInRound });
  };

  /** lifecycle: measure → compute transforms → draw; re-run on resize/data */
  useEffect(() => {
    let raf1 = 0, raf2 = 0;
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
  }, [matches, cols, edges.length]);

  return (
    <section className="relative">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

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
              <path key={i} d={d} fill="none" stroke="url(#brkt)" strokeWidth={2} filter="url(#glow)" strokeLinecap="round" />
            ))}
          </svg>

          {/* columns */}
          {rounds.map(({ round, list }, idx) => (
            <div key={round} className="flex flex-col gap-6 py-2 overflow-visible">
              <div className="px-1 text-sm tracking-wide uppercase text-white/60">
                {labelFor(round, idx)}
              </div>

              {list.map((m) => (
                <div
                  key={m.id}
                  ref={setNodeRef(m.id)}
                  onClick={onMatchClick ? () => onMatchClick(m) : undefined}
                  className="group relative rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/60 hover:border-white/25 hover:shadow-lg hover:shadow-emerald-500/10 transition-colors p-3 will-change-transform"
                  style={{
                    minHeight: minCardHeight,
                    transform: `translateY(${transforms.get(m.id) ?? 0}px)`,
                  }}
                >
                  <MatchRow id={m.team_a_id} score={m.status === "finished" ? m.team_a_score : null} teamsMap={teamsMap} />
                  <div className="h-1" />
                  <MatchRow id={m.team_b_id} score={m.status === "finished" ? m.team_b_score : null} teamsMap={teamsMap} />
                </div>
              ))}

              {list.length === 0 && <div className="text-white/50 text-sm italic">—</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MatchRow({ id, score, teamsMap }: { id: number | null; score: number | null; teamsMap: TeamsMap }) {
  const team = id ? teamsMap[id] : undefined;
  const seed = team?.seed;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {seed != null && <span className="px-1.5 py-0.5 text-[10px] rounded-full border border-white/15 text-white/70 bg-white/5">#{seed}</span>}
        <span className="truncate font-medium">{team?.name ?? "TBD"}</span>
      </div>
      <span className="text-sm tabular-nums">{score == null ? "–" : score}</span>
    </div>
  );
}
