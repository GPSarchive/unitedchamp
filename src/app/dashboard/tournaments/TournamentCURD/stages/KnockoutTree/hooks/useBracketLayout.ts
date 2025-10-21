// app/components/DashboardPageComponents/TournamentCURD/stages/ModernKnockoutTree/hooks/useBracketLayout.ts
import { useEffect, useRef, useState } from "react";
import type { BracketMatch as Match } from "@/app/lib/types";
import type { Edge } from "../newknockout/types";

type Col = { round: number; list: Match[] };

export function useBracketLayout({
  rounds,
  edgesByPair,
  isStubId,
  minCardHeight,
  minRowGap,
  deps,
}: {
  rounds: Col[];
  edgesByPair: Edge[];
  isStubId: (id: number) => boolean;
  minCardHeight: number;
  minRowGap: number;
  deps: any[]; // external deps to re-measure (matches, cols, edgesKey, etc.)
}) {
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

        // Stubs should keep their tiny height (don’t floor to minCardHeight)
        const isStub = isStubId(m.id);
        const h = isStub ? rect.height : Math.max(minCardHeight, rect.height);
        heights.set(keyRB(ri, idx), h);
      });
    });

    baseCenters.current = centers;
    baseHeights.current = heights;
  };

  const computeTransforms = () => {
    const centers = baseCenters.current;
    if (!centers.size) return new Map<number, number>();

    const heightsMap = baseHeights.current;

    // index in (round, list)
    const indexOf: Map<number, { ri: number; idx: number }> = new Map();
    rounds.forEach((col, ri) => col.list.forEach((m, idx) => indexOf.set(m.id, { ri, idx })));

    // start from measured centers & heights
    const targets: number[][] = rounds.map((_col, ri) =>
      rounds[ri].list.map((_m, idx) => centers.get(keyRB(ri, idx)) ?? 0)
    );
    const heights: number[][] = rounds.map((_col, ri) =>
      rounds[ri].list.map((_m, idx) => heightsMap.get(keyRB(ri, idx)) ?? minCardHeight)
    );

    const expectedParents = (m: Match): Match[] => {
      if (!Number.isFinite(m.round) || !Number.isFinite(m.bracket_pos) || (m.round ?? 0) <= 1) return [];
      const r = m.round as number;
      const p = m.bracket_pos as number;
      const a = rounds[r - 1]?.list?.[2 * p - 2] as Match | undefined;
      const b = rounds[r - 1]?.list?.[2 * p - 1] as Match | undefined;
      return [a, b].filter(Boolean) as Match[];
    };

    // 1) place child based on *real* parents only (ignore stubs here)
    for (let ri = 1; ri < rounds.length; ri++) {
      const curr = rounds[ri].list;

      curr.forEach((m, idx) => {
        const expAll = expectedParents(m);
        const yExp = expAll
          .filter((p) => !isStubId(p.id))
          .map((p) => {
            const pos = indexOf.get(p.id);
            return pos ? targets[pos.ri][pos.idx] : null;
          })
          .filter((n): n is number => Number.isFinite(n));

        if (yExp.length >= 1) {
          const avg = yExp.reduce((a, b) => a + b, 0) / yExp.length;
          targets[ri][idx] = avg;
        }
      });

      // 2) ALIGN stubs (if any) to their child's final target
      curr.forEach((m, idx) => {
        const expAll = expectedParents(m);
        expAll.forEach((p) => {
          if (!isStubId(p.id)) return;
          const pos = indexOf.get(p.id);
          if (pos) targets[pos.ri][pos.idx] = targets[ri][idx];
        });
      });

      // 3) enforce **measured** minimal spacing in the CURRENT round only
      for (let i = 1; i < curr.length; i++) {
        const required =
          (heights[ri][i - 1] + heights[ri][i]) / 2 + Math.max(0, minRowGap);
        if (targets[ri][i] < targets[ri][i - 1] + required) {
          targets[ri][i] = targets[ri][i - 1] + required;
        }
      }
      for (let i = curr.length - 2; i >= 0; i--) {
        const required =
          (heights[ri][i + 1] + heights[ri][i]) / 2 + Math.max(0, minRowGap);
        if (targets[ri][i] > targets[ri][i + 1] - required) {
          targets[ri][i] = Math.min(targets[ri][i + 1] - required, targets[ri][i]);
        }
      }
    }

    // convert to translateY deltas
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

    const centerRight = (id: number) => {
      const el = nodeRefs.current.get(id);
      const pos = indexOf.get(id);
      if (!el || !pos) return null;
      const r = el.getBoundingClientRect();
      const baseY = baseCenters.current.get(keyRB(pos.ri, pos.idx)) ?? 0;
      const ty = transforms.get(id) ?? 0;
      return { x: r.right - cbox.left, y: baseY + ty };
    };
    const centerLeft = (id: number) => {
      const el = nodeRefs.current.get(id);
      const pos = indexOf.get(id);
      if (!el || !pos) return null;
      const r = el.getBoundingClientRect();
      const baseY = baseCenters.current.get(keyRB(pos.ri, pos.idx)) ?? 0;
      const ty = transforms.get(id) ?? 0;
      return { x: r.left - cbox.left, y: baseY + ty };
    };

    // --- CUBIC S-CURVE GEOMETRY ---
    const ds: string[] = [];
    edgesByPair.forEach(({ fromId, toId }) => {
      const a = centerRight(fromId);
      const b = centerLeft(toId);
      if (!a || !b) return;

      const t = 0.35;                // curvature intensity (0..1)
      const dx = b.x - a.x;
      const cx1 = a.x + t * dx;      // first handle x
      const cx2 = b.x - t * dx;      // second handle x

      ds.push(
        `M ${a.x} ${a.y} C ${cx1} ${a.y} ${cx2} ${b.y} ${b.x} ${b.y}`
      );
    });
    setPaths(ds);
  };

  // Lifecycle: measure & recompute
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
  }, deps);

  // Recompute paths when transforms change (cards settle)
  useEffect(() => {
    requestAnimationFrame(computePaths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transforms, edgesByPair]);

  return { containerRef, setNodeRef, transforms, paths };
}
