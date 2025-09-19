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

type Labels = {
  final: string;
  semifinals: string;
  quarterfinals: string;
  roundOf: (n: number) => string;
  roundN: (r: number) => string;
  bye: string;
  tbd: string;
  // NEW (small badges)
  pair: (a?: number | null, b?: number | null) => string;
  seedTaken: string;
  pickTeam: string;
  autoSeed: string;
  clearRound: string;
  swap: string;
};

const EN_LABELS: Labels = {
  final: "Final",
  semifinals: "Semi-finals",
  quarterfinals: "Quarter-finals",
  roundOf: (n) => `Round of ${n}`,
  roundN: (r) => `Round ${r}`,
  bye: "BYE",
  tbd: "TBD",
  pair: (a, b) => `Pair${a || b ? `: #${a ?? "?"} vs #${b ?? "?"}` : ""}`,
  seedTaken: "Seed already used",
  pickTeam: "Pick team…",
  autoSeed: "Auto-seed",
  clearRound: "Clear first round",
  swap: "Swap",
};

const EL_LABELS: Labels = {
  final: "Τελικός",
  semifinals: "Ημιτελικά",
  quarterfinals: "Προημιτελικά",
  roundOf: (n) => `Φάση των ${n}`,
  roundN: (r) => `Γύρος ${r}`,
  bye: "Πρόκριση",
  tbd: "Σε αναμονή",
  pair: (a, b) => `Ζευγάρι${a || b ? `: #${a ?? "?"} vs #${b ?? "?"}` : ""}`,
  seedTaken: "Ο αριθμός seed χρησιμοποιείται ήδη",
  pickTeam: "Επιλογή ομάδας…",
  autoSeed: "Αυτόματη κατάταξη",
  clearRound: "Καθαρισμός πρώτου γύρου",
  swap: "Αλλαγή θέσεων",
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

  /** NEW: turn on first-round seeding UI */
  editable?: boolean;
  /** NEW: limit which teams are eligible to be placed in this stage */
  eligibleTeamIds?: number[];
  /** NEW: assign a team to a slot (parent updates matches) */
  onAssignSlot?: (matchId: number, slot: "A" | "B", teamId: number | null) => void;
  /** NEW: swap A/B inside a match (optional shortcut) */
  onSwapPair?: (matchId: number) => void;
  /** NEW: bulk-assign for auto-seed; if not provided we’ll call onAssignSlot per slot */
  onBulkAssignFirstRound?: (rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>) => void;
  /** NEW: clear all first-round picks */
  onClearFirstRound?: () => void;
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
  minRowGap = 12,
  lang = "en",
  labels,
  editable = false,
  eligibleTeamIds,
  onAssignSlot,
  onSwapPair,
  onBulkAssignFirstRound,
  onClearFirstRound,
}: ModernKnockoutTreeProps) {
  /** Pick labels */
  const L: Labels = useMemo(() => {
    const base = lang === "el" ? EL_LABELS : EN_LABELS;
    return { ...base, ...(labels ?? {}) };
  }, [lang, labels]);

  /** Group by round & sort by bracket_pos */
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

  /** For round labels & BYE detection */
  const counts = useMemo(
    () =>
      rounds.map((col) => {
        const matchesInRound = col.list.length;
        const teamsInRound = matchesInRound > 1 ? matchesInRound * 2 : 2;
        return { round: col.round, matchesInRound, teamsInRound };
      }),
    [rounds]
  );

  /** Build set of team IDs that appeared in each round (for BYE badge detection) */
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

  /** Edges per adjacent pair (explicit first, else bucket mapping) */
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

      const M = prev.length;
      const N = curr.length || 1;
      const buckets: number[][] = Array.from({ length: N }, () => []);
      prev.forEach((p, i) => {
        const j = Math.floor((i * N) / Math.max(1, M)); // 0..N-1
        buckets[Math.min(N - 1, Math.max(0, j))].push(i);
      });

      curr.forEach((m, j) => {
        const ids = buckets[j];
        if (!ids || !ids.length) return;
        ids.forEach((i) => out.push({ fromId: prev[i].id, toId: m.id }));
      });
    }
    // dedupe
    const seen = new Set<string>();
    return out.filter((e) => {
      const k = `${e.fromId}->${e.toId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [rounds]);

  /** DOM refs, measuring & transforms (unchanged) */
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<number, HTMLDivElement>());
  const setNodeRef = (id: number) => (el: HTMLDivElement | null) => {
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

    const targets: number[][] = rounds.map((col, ri) =>
      col.list.map((_, idx) => base.get(keyRB(ri, idx)) ?? 0)
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
          const ids = (buckets[idx] ?? []);
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

  const cols = rounds.length || 1;
  const autoCol = colWidth ?? (cols > maxAutoFit ? 220 : 280);
  const autoGap = gapX ?? (cols > maxAutoFit ? 12 : 16);

  const defaultLabel = (a: RoundLabelFnArgs) => {
    const n = a.teamsInRound;
    if (n === 2) return L.final;
    if (n === 4) return L.semifinals;
    if (n === 8) return L.quarterfinals;
    if ([16, 32, 64, 128].includes(n)) return L.roundOf(n);
    return L.roundN(a.round);
  };
  const labelFor = (round: number, idx: number) => {
    const { matchesInRound, teamsInRound } = counts[idx] ?? { matchesInRound: 0, teamsInRound: 0 };
    const fn = roundLabelFn ?? defaultLabel;
    return fn({ round, index: idx, total: cols, matchesInRound, teamsInRound });
  };

  /** lifecycle */
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
  }, [matches, cols, edgesByPair.length]);

  /** Helper: should this slot show a BYE badge? */
  const hadBye = (roundIdx: number, teamId: number | null) => {
    if (teamId == null) return false;              // unknown team → can't claim bye
    if (roundIdx === 0) return false;              // first visible round → never a bye badge
    const prev = teamsPerRound[roundIdx - 1];
    return !prev?.has(teamId);                     // present this round, absent last round ⇒ bye
  };

  const titleText = lang === "el" && title === "Knockout Bracket" ? "Δέντρο Νοκ-άουτ" : title;

  /** ------------ NEW: First-round seeding state helpers ------------ */
  // First round list
  const firstRound = rounds[0]?.list ?? [];
  // Eligible team IDs
  const eligible = useMemo(() => {
    const ids = eligibleTeamIds && eligibleTeamIds.length
      ? eligibleTeamIds
      : Object.keys(teamsMap).map((x) => Number(x));
    // Filter out teams that have no seed (optional; keep them if you prefer)
    return ids.filter((id) => teamsMap[id]?.seed != null);
  }, [eligibleTeamIds, teamsMap]);

  // Assigned (first round) team ids & used seed numbers
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
      if (sa != null) used.add(sa);
      if (sb != null) used.add(sb);
    });
    return used;
  }, [firstRound, teamsMap]);

  const makeOptions = (currentTeamId: number | null) => {
    const currentSeed = currentTeamId != null ? teamsMap[currentTeamId]?.seed ?? null : null;
    return [
      { id: null as any, label: lang === "el" ? "— Κενό —" : "— Empty —", disabled: false },
      ...eligible
        .map((id) => {
          const t = teamsMap[id];
          const s = t?.seed ?? null;
          const takenByTeam = assignedIdsFR.has(id) && id !== currentTeamId;
          const duplicateSeed = s != null && usedSeedsFR.has(s) && s !== currentSeed;
          return {
            id,
            label: s != null ? `#${s} — ${t?.name ?? id}` : (t?.name ?? String(id)),
            disabled: takenByTeam || duplicateSeed,
            reason: takenByTeam ? "already in bracket" : duplicateSeed ? L.seedTaken : undefined,
          };
        })
        .sort((a, b) => {
          const sa = a.id ? teamsMap[a.id]?.seed ?? 9999 : 9999;
          const sb = b.id ? teamsMap[b.id]?.seed ?? 9999 : 9999;
          return sa - sb;
        }),
    ];
  };

  /** NEW: Auto-seed helper (1 vs N, 2 vs N-1 ...) */
  const autoSeedPairs = () => {
    // sort eligible by seed asc
    const withSeed = eligible
      .map((id) => ({ id, seed: teamsMap[id]?.seed ?? Infinity }))
      .filter((x) => Number.isFinite(x.seed))
      .sort((a, b) => a.seed - b.seed);

    const S = firstRound.length * 2;
    const top = withSeed.slice(0, S);
    const rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }> = [];

    // pair: 0 vs S-1, 1 vs S-2, ...
    for (let i = 0; i < firstRound.length; i++) {
      const a = top[i]?.id ?? null;
      const b = top[S - 1 - i]?.id ?? null;
      rows.push({ matchId: firstRound[i].id, team_a_id: a, team_b_id: b });
    }

    if (onBulkAssignFirstRound) onBulkAssignFirstRound(rows);
    else if (onAssignSlot) {
      rows.forEach((r) => {
        onAssignSlot(r.matchId, "A", r.team_a_id);
        onAssignSlot(r.matchId, "B", r.team_b_id);
      });
    }
  };

  return (
    <section className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{titleText}</h2>

        {/* NEW: small seeding toolbar (only when editable & first round exists) */}
        {editable && firstRound.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
              onClick={autoSeedPairs}
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
          {rounds.map(({ round, list }, roundIdx) => (
            <div key={round} className="flex flex-col gap-6 py-2 overflow-visible">
              <div className="px-1 text-sm tracking-wide uppercase text-white/60">
                {labelFor(round, roundIdx)}
              </div>

              {list.map((m) => {
                const isEditableCard = editable && roundIdx === 0 && !!onAssignSlot;
                return (
                  <div
                    key={m.id}
                    ref={setNodeRef(m.id)}
                    onClick={!isEditableCard && onMatchClick ? () => onMatchClick(m) : undefined}
                    className="
                      group relative rounded-xl border border-white/10
                      bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/60
                      hover:border-white/25 hover:shadow-lg hover:shadow-emerald-500/10
                      transition-colors p-3 will-change-transform
                    "
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

function MatchRow({
  id,
  score,
  teamsMap,
  tbdText,
  byeBadge,
}: {
  id: number | null;
  score: number | null;
  teamsMap: TeamsMap;
  /** NEW: localized TBD text */
  tbdText: string;
  /** NEW: if provided, renders a small badge (e.g., BYE / Πρόκριση) */
  byeBadge: string | null;
}) {
  const team = id ? teamsMap[id] : undefined;
  const seed = team?.seed;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {seed != null && (
          <span className="px-1.5 py-0.5 text-[10px] rounded-full border border-white/15 text-white/70 bg-white/5">
            #{seed}
          </span>
        )}
        <span className="truncate font-medium">{team?.name ?? tbdText}</span>
        {byeBadge && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded-md border border-cyan-400/30 text-cyan-200 bg-cyan-400/10"
            title={byeBadge === "BYE" ? "Advanced without playing previous round" : "Πέρασε χωρίς αγώνα"}
          >
            {byeBadge}
          </span>
        )}
      </div>
      <span className="text-sm tabular-nums">{score == null ? "–" : score}</span>
    </div>
  );
}

/** ---------------- NEW: Editable first-round pair card ---------------- */
function EditablePairCard({
  match,
  teamsMap,
  L,
  makeOptions,
  onAssign,
  onSwap,
}: {
  match: Match;
  teamsMap: TeamsMap;
  L: Labels;
  makeOptions: (currentTeamId: number | null) => Array<{ id: number | null; label: string; disabled: boolean; reason?: string }>;
  onAssign: (matchId: number, slot: "A" | "B", id: number | null) => void;
  onSwap?: (matchId: number) => void;
}) {
  const teamA = match.team_a_id ? teamsMap[match.team_a_id] : undefined;
  const teamB = match.team_b_id ? teamsMap[match.team_b_id] : undefined;

  const optsA = makeOptions(match.team_a_id);
  const optsB = makeOptions(match.team_b_id);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>{L.pair(teamA?.seed ?? null, teamB?.seed ?? null)}</span>
        {onSwap && (
          <button
            onClick={() => onSwap(match.id)}
            className="px-1.5 py-0.5 rounded border border-white/10 hover:border-white/25 text-white/70 hover:text-white"
            title={L.swap}
          >
            ↔
          </button>
        )}
      </div>

      <SelectRow
        value={match.team_a_id}
        options={optsA}
        placeholder={L.pickTeam}
        onChange={(val) => onAssign(match.id, "A", val)}
      />

      <SelectRow
        value={match.team_b_id}
        options={optsB}
        placeholder={L.pickTeam}
        onChange={(val) => onAssign(match.id, "B", val)}
      />
    </div>
  );
}

function SelectRow({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: number | null;
  options: Array<{ id: number | null; label: string; disabled: boolean; reason?: string }>;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        className="flex-1 bg-slate-950 border border-white/15 rounded-md px-2 py-1.5 text-sm text-white/90 disabled:opacity-50"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          onChange(v);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={String(o.id ?? "null")} value={o.id ?? ""} disabled={o.disabled} title={o.reason}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Tiny seed chip preview */}
      <span className="px-1.5 py-0.5 text-[10px] rounded-full border border-white/10 text-white/70 bg-white/5 min-w-[2.25rem] text-center">
        {value != null ? `#${options.find((x) => x.id === value)?.label.split(" — ")[0].replace("#", "")}` : "—"}
      </span>
    </div>
  );
}
