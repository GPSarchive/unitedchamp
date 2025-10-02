// KnockoutTree/hooks/useBracketData.ts
import { useMemo } from "react";
import type { BracketMatch as Match } from "@/app/lib/types";
import type { Edge } from "../oldknockout/types";

export function useBracketData(matches: Match[]) {
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
   * Insert lightweight "BYE stubs" into the previous round at the expected parent
   * slots that do not exist. Those stubs are later aligned to their child’s Y.
   */
  const { rounds, stubIds } = useMemo(() => {
    // clone
    const cloned = baseRounds.map((c) => ({ round: c.round, list: c.list.slice() as Match[] }));
    const byKey: Map<string, Match> = new Map();
    cloned.forEach(({ round, list }) =>
      list.forEach((m) => byKey.set(`${round}:${m.bracket_pos ?? 0}`, m))
    );

    const stubs = new Set<number>();
    let stubSeq = 1;
    const makeStub = (round: number, bracket_pos: number): Match => {
      const id = -100000 - stubSeq++;
      stubs.add(id);
      return {
        id,
        round,
        bracket_pos,
        team_a_id: null,
        team_b_id: null,
        team_a_score: null,
        team_b_score: null,
        status: "scheduled" as any,
      } as unknown as Match;
    };

    // for each column starting from second, backfill previous column with stubs if needed
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
    if (Number.isInteger(m.home_source_match_id)) {
      const x = matches.find((mm) => mm.id === m.home_source_match_id);
      add(x);
    }
    if (Number.isInteger(m.away_source_match_id)) {
      const x = matches.find((mm) => mm.id === m.away_source_match_id);
      add(x);
    }

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
  const edgesByPair: Edge[] = useMemo(() => {
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
  }, [rounds, byRoundPos, matches]); // resolveParents uses these

  const edgesKey = useMemo(
    () => edgesByPair.map((e) => `${e.fromId}->${e.toId}`).sort().join(","),
    [edgesByPair]
  );

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

  return {
    rounds,
    counts,
    teamsPerRound,
    isStubId,
    expectedParents,
    resolveParents,
    edgesByPair,
    edgesKey,
  };
}
