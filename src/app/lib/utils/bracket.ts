// utils/bracket.ts

export type KnockoutMatch = {
    id: number;
    round: number | null;
    bracket_pos: number | null;
    team_a_id: number | null;
    team_b_id: number | null;
    team_a_score: number | null;
    team_b_score: number | null;
    status: string; // 'scheduled' | 'live' | 'finished' | ...
    home_source_match_id?: number | null;
    home_source_outcome?: 'W' | 'L' | null;
    away_source_match_id?: number | null;
    away_source_outcome?: 'W' | 'L' | null;
  };
  
  export function groupMatchesByRound<T extends KnockoutMatch>(matches: T[]) {
    const byRound = new Map<number, T[]>();
    matches.forEach((m) => {
      const r = m.round ?? 0;
      byRound.set(r, [...(byRound.get(r) ?? []), m]);
    });
    return Array.from(byRound.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({
        round,
        matches: list.sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)),
      }));
  }
  
  export function computeWinnerTeamId(m: KnockoutMatch): number | null {
    if (m.status !== 'finished') return null;
    if (m.team_a_score == null || m.team_b_score == null) return null;
    if (m.team_a_score > m.team_b_score) return m.team_a_id ?? null;
    if (m.team_b_score > m.team_a_score) return m.team_b_id ?? null;
    return null; // draw handling isn’t defined here (extra time/penalties)
  }
  
  export function computeLoserTeamId(m: KnockoutMatch): number | null {
    if (m.status !== 'finished') return null;
    if (m.team_a_score == null || m.team_b_score == null) return null;
    if (m.team_a_score < m.team_b_score) return m.team_a_id ?? null;
    if (m.team_b_score < m.team_a_score) return m.team_b_id ?? null;
    return null;
  }
  
  // Build graph: which next matches depend on a source match
  export function buildAdvancementGraph<T extends KnockoutMatch>(matches: T[]) {
    const deps = new Map<number, { nextId: number; side: 'A' | 'B'; outcome: 'W' | 'L' }[]>();
    matches.forEach((m) => {
      if (m.home_source_match_id) {
        const arr = deps.get(m.home_source_match_id) ?? [];
        arr.push({ nextId: m.id, side: 'A', outcome: (m.home_source_outcome ?? 'W') as 'W' | 'L' });
        deps.set(m.home_source_match_id, arr);
      }
      if (m.away_source_match_id) {
        const arr = deps.get(m.away_source_match_id) ?? [];
        arr.push({ nextId: m.id, side: 'B', outcome: (m.away_source_outcome ?? 'W') as 'W' | 'L' });
        deps.set(m.away_source_match_id, arr);
      }
    });
    return deps;
  }
  
  /**
   * Given finished matches, compute the updates you should apply to “next” matches
   * to advance winners/losers. Use this inside a server action to update the DB.
   */
  export function computeNextMatchUpdates<T extends KnockoutMatch>(matches: T[]) {
    const byId = new Map(matches.map((m) => [m.id, m]));
    const deps = buildAdvancementGraph(matches);
  
    type Update = { match_id: number; set_team_a_id?: number | null; set_team_b_id?: number | null };
    const updates: Update[] = [];
  
    deps.forEach((edges, sourceId) => {
      const src = byId.get(sourceId);
      if (!src) return;
  
      const winner = computeWinnerTeamId(src);
      const loser = computeLoserTeamId(src);
      if (winner == null && loser == null) return;
  
      edges.forEach(({ nextId, side, outcome }) => {
        const target = byId.get(nextId);
        if (!target) return;
  
        const teamId = outcome === 'W' ? winner : loser;
        if (teamId == null) return;
  
        updates.push({
          match_id: nextId,
          ...(side === 'A' ? { set_team_a_id: teamId } : { set_team_b_id: teamId }),
        });
      });
    });
  
    return updates;
  }
  
  /**
   * Build a tree from finals upwards using source pointers. Useful for a pure tree visual.
   */
  export function buildBracketTree<T extends KnockoutMatch>(matches: T[]) {
    const byId = new Map(matches.map((m) => [m.id, m]));
    // finals are matches that are not referenced as a source by any other match
    const referenced = new Set<number>();
    matches.forEach((m) => {
      if (m.home_source_match_id) referenced.add(m.home_source_match_id);
      if (m.away_source_match_id) referenced.add(m.away_source_match_id);
    });
    const roots = matches.filter((m) => !referenced.has(m.id));
  
    type Node = {
      match: T;
      left?: Node;
      right?: Node;
    };
  
    const makeNode = (m: T): Node => {
      const left = m.home_source_match_id ? byId.get(m.home_source_match_id) : undefined;
      const right = m.away_source_match_id ? byId.get(m.away_source_match_id) : undefined;
      return {
        match: m,
        left: left ? makeNode(left as T) : undefined,
        right: right ? makeNode(right as T) : undefined,
      };
    };
  
    return roots.map(makeNode);
  }
  