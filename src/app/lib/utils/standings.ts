// utils/standings.ts

export type StandingRow = {
    team_id: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    points: number;
    // optional discipline for fair play
    yellow_cards?: number;
    red_cards?: number;
    blue_cards?: number;
  };
  
  export type Tiebreaker =
    | 'points'
    | 'goal_diff'
    | 'goals_for'
    | 'h2h_points'
    | 'h2h_goal_diff'
    | 'fair_play';
  
  export type StageConfig = {
    tiebreakers?: Tiebreaker[];
  };
  
  export type MatchLite = {
    team_a_id: number;
    team_b_id: number;
    team_a_score: number;
    team_b_score: number;
    status: string; // 'finished'
  };
  
  /**
   * Build head-to-head aggregates between team pairs from the finished matches you pass.
   * You should pass only matches that belong to the same tournament scope (same stage/group).
   */
  export function buildHeadToHead(matches: MatchLite[]) {
    type Key = `${number}-${number}`;
    const key = (a: number, b: number): Key => (a < b ? `${a}-${b}` : `${b}-${a}`);
  
    const h2h = new Map<Key, { a: number; b: number; aPts: number; bPts: number; aGD: number; bGD: number }>();
  
    matches.forEach((m) => {
      if (m.status !== 'finished') return;
      const k = key(m.team_a_id, m.team_b_id);
      const cur = h2h.get(k) ?? { a: 0, b: 0, aPts: 0, bPts: 0, aGD: 0, bGD: 0 };
      // a vs b relative to team_a_id as 'a' in the key orientation
      const aIsA = m.team_a_id < m.team_b_id;
      const aGoals = aIsA ? m.team_a_score : m.team_b_score;
      const bGoals = aIsA ? m.team_b_score : m.team_a_score;
  
      cur.a += aGoals;
      cur.b += bGoals;
      cur.aGD += aGoals - bGoals;
      cur.bGD += bGoals - aGoals;
  
      if (aGoals > bGoals) cur.aPts += 3;
      else if (aGoals < bGoals) cur.bPts += 3;
      else {
        cur.aPts += 1;
        cur.bPts += 1;
      }
  
      h2h.set(k, cur);
    });
  
    return {
      /** returns [aPts,bPts,aGD,bGD] for the ordered pair (x,y) */
      get: (x: number, y: number) => {
        const k = key(x, y);
        const v = h2h.get(k);
        if (!v) return [0, 0, 0, 0] as const;
        const xIsA = x < y;
        return xIsA ? [v.aPts, v.bPts, v.aGD, v.bGD] : [v.bPts, v.aPts, v.bGD, v.aGD];
      },
    };
  }
  
  /** Negative points (smaller is better) for fair-play comparison. */
  export function fairPlayScore(r: StandingRow) {
    const y = r.yellow_cards ?? 0;
    const rds = r.red_cards ?? 0;
    const b = r.blue_cards ?? 0;
    // Typical scales: Yellow=1, Red=3, (Blue optional=2)
    return y * 1 + rds * 3 + b * 2;
  }
  
  /**
   * Sort standings rows according to stage.config.tiebreakers. Defaults:
   * ['points','goal_diff','goals_for','h2h_points','h2h_goal_diff','fair_play']
   */
  export function sortStandings(
    rows: StandingRow[],
    config?: StageConfig,
    h2hMatches?: MatchLite[]
  ) {
    const order: Tiebreaker[] =
      config?.tiebreakers && config.tiebreakers.length
        ? config.tiebreakers
        : ['points', 'goal_diff', 'goals_for', 'h2h_points', 'h2h_goal_diff', 'fair_play'];
  
    const h2h = h2hMatches && h2hMatches.length ? buildHeadToHead(h2hMatches) : null;
  
    const cmp = (a: StandingRow, b: StandingRow) => {
      for (const tb of order) {
        switch (tb) {
          case 'points': {
            if (a.points !== b.points) return b.points - a.points;
            break;
          }
          case 'goal_diff': {
            if (a.goal_diff !== b.goal_diff) return b.goal_diff - a.goal_diff;
            break;
          }
          case 'goals_for': {
            if (a.goals_for !== b.goals_for) return b.goals_for - a.goals_for;
            break;
          }
          case 'h2h_points': {
            if (h2h) {
              const [ap, bp] = h2h.get(a.team_id, b.team_id);
              if (ap !== bp) return bp - ap;
            }
            break;
          }
          case 'h2h_goal_diff': {
            if (h2h) {
              const [, , agd, bgd] = h2h.get(a.team_id, b.team_id);
              if (agd !== bgd) return bgd - agd;
            }
            break;
          }
          case 'fair_play': {
            const af = fairPlayScore(a);
            const bf = fairPlayScore(b);
            if (af !== bf) return af - bf; // lower = better
            break;
          }
        }
      }
      // stable fallback (team id ascending)
      return a.team_id - b.team_id;
    };
  
    return [...rows].sort(cmp);
  }
  