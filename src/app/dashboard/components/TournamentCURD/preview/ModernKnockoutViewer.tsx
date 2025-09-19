// app/tournoua/[slug]/components/teams/ModernKnockoutViewer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";
import { getLabels } from "@/app/tournoua/[slug]/components/teams/Knockout/labels";
import MatchRow from "@/app/dashboard/components/TournamentCURD/stages/KnockoutTree/MatchRow";

/** Public prop types (same label args you already use) */
export type RoundLabelFnArgs = {
  round: number;
  index: number;
  total: number;
  matchesInRound: number;
  teamsInRound: number;
};

export type ModernKnockoutViewerProps = {
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
  /** show "BYE" badges for teams that appear for the first time after round 1 */
  showByeBadges?: boolean;
};

type Edge = { fromId: number; toId: number };

export default function ModernKnockoutViewer({
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
  showByeBadges = true,
}: ModernKnockoutViewerProps) {
  /** Labels */
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

  /** Edges between rounds */
  const edgesByPair = useMemo(() => {
    const out: Edge[] = [];
    for (let ri = 1; ri < rounds.length; ri++) {
      const prev = rounds[ri - 1].list;
      const curr = rounds[ri].list;

      const explicit: Edge[] = [];
      curr.forEach((m) => {
        if (m.home_source_match_id) explicit.push({ fromId: m.home_source_match_id, toId: m.id });
        if (m.away_source_match_id) explicit.push({ fromId: m.away_source_match_id, toId: m.id });
      });

      if (explicit.length) {
        out.push(...explicit);
        continue;
      }

      // fallback: bucket mapping
      const M = prev.length;
      const N = curr.length || 1;
      const buckets: number[][] = Array.from({ length: N }, () => []);
      prev.forEach((_p, i) => {
        const j = Math.floor((i * N) / Math.max(1, M));
        buckets[Math.min(N - 1, Math.max(0, j))].push(i);
      });

      curr.forEach((m, j) => {
        const ids = buckets[j];
        if (!ids || !ids.length) return;
        ids.forEach((i) => out.push({ fromId: prev[i].id, toId: m.id }));
      });
    }
    const seen = new Set<string>();
    return out.filter((e) => {
      const k = `${e.fromId}->${e.toId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [rounds]);

  /** DOM refs, measuring & paths */
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const setNodeRef = (id: number) => (el: HTMLDivElement | null): void => {
    if (!el) nodeRefs.current.delete(id);
    else nodeRefs.current.set(id, el);
  };

  const baseCenters = useRef<Map<string, number>>(new Map());
  const keyRB = (ri: number, idxInRound: number) => `${ri}:${idxInRound}`;

  const [transforms, setTransforms] = useState<Map<number, number>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);

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
        const explicitSrcIdxs = adjFromPrev.get(k);
        const prevTargets = targets[ri - 1];

        let desired: number | null = null;

        if (explicitSrcIdxs && explicitSrcIdxs.length) {
          const ys = explicitSrcIdxs.map((pi) => prevTargets[pi]).filter((n) => Number.isFinite(n));
          if (ys.length) desired = ys.reduce((a, b) => a + b, 0) / ys.length;
        }
        if (desired == null) {
          const ids = buckets[idx] ?? [];
          const ys = ids.map((pi) => prevTargets[pi]).filter((n) => Number.isFinite(n));
          if (ys.length) desired = ys.reduce((a, b) => a + b, 0) / ys.length;
        }
        if (desired == null) {
          desired = targets[ri][idx];
        }
        targets[ri][idx] = desired!;
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

  /** Layout columns & gaps */
  const cols = rounds.length || 1;
  const autoCol = colWidth ?? (cols > maxAutoFit ? 220 : 280);
  const autoGap = gapX ?? (cols > maxAutoFit ? 12 : 16);

  /** Round labels — always “Round {index+1}” (or “Γύρος {index+1}”) */
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
  }, [matches, cols, edgesByPair.length, minCardHeight, minRowGap]);

  /** BYE badge helper */
  const hadBye = (roundIdx: number, teamId: number | null) => {
    if (!showByeBadges) return false;
    if (teamId == null) return false;
    if (roundIdx === 0) return false;
    const prev = teamsPerRound[roundIdx - 1];
    return !prev?.has(teamId);
  };

  const titleText = lang === "el" && title === "Knockout Bracket" ? "Δέντρο Νοκ-άουτ" : title;

  const statusText = (s?: string) => {
    switch ((s || "").toLowerCase()) {
      case "finished":
        return lang === "el" ? "Ολοκληρώθηκε" : "Finished";
      case "live":
        return lang === "el" ? "Σε εξέλιξη" : "Live";
      default:
        return lang === "el" ? "Προγραμματισμένο" : "Scheduled";
    }
  };

  const statusClasses = (s?: string) => {
    const v = (s || "").toLowerCase();
    if (v === "finished")
      return {
        chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/40",
        card: "border-emerald-400/40 shadow-emerald-400/10",
      };
    if (v === "live")
      return {
        chip: "bg-sky-500/10 text-sky-300 ring-sky-400/40",
        card: "border-sky-400/40 shadow-sky-400/10",
      };
    return { chip: "bg-amber-400/10 text-amber-200 ring-amber-300/40", card: "border-white/10" };
  };

  /** ---------- render ---------- */
  return (
    <section className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{titleText}</h2>
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
                const s = statusClasses(m.status as string);
                const isFinished = (m.status as string) === "finished";
                return (
                  <div
                    key={m.id}
                    ref={setNodeRef(m.id)}
                    onClick={onMatchClick ? () => onMatchClick(m) : undefined}
                    className={[
                      "group relative rounded-xl border bg-gradient-to-br",
                      "from-slate-900/80 via-slate-900/60 to-slate-800/60",
                      "hover:border-white/25 hover:shadow-lg transition-colors p-3 will-change-transform",
                      s.card,
                    ].join(" ")}
                    style={{
                      minHeight: minCardHeight,
                      transform: `translateY(${transforms.get(m.id) ?? 0}px)`,
                    }}
                  >
                    {/* Status chip */}
                    <span
                      className={[
                        "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                        s.chip,
                      ].join(" ")}
                      title={statusText(m.status as string)}
                    >
                      {statusText(m.status as string)}
                    </span>

                    <MatchRow
                      id={m.team_a_id}
                      score={isFinished ? m.team_a_score : null}
                      teamsMap={teamsMap}
                      tbdText={L.tbd}
                      byeBadge={hadBye(roundIdx, m.team_a_id) ? L.bye : null}
                    />
                    <div className="h-1" />
                    <MatchRow
                      id={m.team_b_id}
                      score={isFinished ? m.team_b_score : null}
                      teamsMap={teamsMap}
                      tbdText={L.tbd}
                      byeBadge={hadBye(roundIdx, m.team_b_id) ? L.bye : null}
                    />
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
