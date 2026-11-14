// Where a player stands among everyone in the directory this season, for the
// stats where more is simply better. Pure — the whole season is already in
// the browser, so this costs nothing to ask when a profile opens.
import { statValue, ZERO_STATS, type DirectoryPlayer, type StatKey } from "../paiktes-v2/model";

export const RANKED_KEYS = ["goals", "assists", "mvp", "best_gk"] as const satisfies readonly StatKey[];
export type RankedKey = (typeof RANKED_KEYS)[number];

export type Standing = {
  value: number;
  /**
   * 1 = best. Equal values share a rank and the next one skips, the same rule
   * as the list. null when the value is 0: nobody is "148th scorer" with none.
   */
  rank: number | null;
  /** The season's highest value for this stat (0 if nobody has any). */
  best: number;
  /** Someone else has exactly the same (non-zero) value, so the place is shared. */
  shared: boolean;
  /**
   * The next step up: the nearest higher value anyone has, and the place that
   * value holds. Reaching it means sharing that place. null at the top.
   */
  next: { value: number; rank: number } | null;
};

export type SeasonStanding = {
  /** How many players the ranks are out of. */
  players: number;
} & Record<RankedKey, Standing>;

/** null when the player is not in the list. */
export function seasonStanding(players: DirectoryPlayer[], playerId: number): SeasonStanding | null {
  const me = players.find((p) => p.id === playerId);
  if (!me) return null;
  const mine = me.season ?? ZERO_STATS;
  const rank = (key: RankedKey): Standing => {
    const value = statValue(mine, key);
    const values = players.map((p) => statValue(p.season ?? ZERO_STATS, key));
    let best = 0;
    let ahead = 0;
    let same = 0; // includes the player themself
    let nextUp = Number.POSITIVE_INFINITY;
    for (const theirs of values) {
      if (theirs > best) best = theirs;
      if (theirs > value) {
        ahead++;
        if (theirs < nextUp) nextUp = theirs;
      } else if (theirs === value) {
        same++;
      }
    }
    let next: Standing["next"] = null;
    if (Number.isFinite(nextUp)) {
      const aheadOfNext = values.filter((theirs) => theirs > nextUp).length;
      next = { value: nextUp, rank: aheadOfNext + 1 };
    }
    return { value, rank: value > 0 ? ahead + 1 : null, best, shared: value > 0 && same > 1, next };
  };
  return {
    players: players.length,
    goals: rank("goals"),
    assists: rank("assists"),
    mvp: rank("mvp"),
    best_gk: rank("best_gk"),
  };
}

/**
 * «1ος», «5ος», «20ός», «100ός» — or, for a feminine noun such as «θέση»,
 * «1η», «20ή». The ending takes an accent where the spoken word is stressed
 * on it (εικοστός, εκατοστή; but δέκατος, εκατοστός δέκατος).
 */
export function ordinal(n: number, gender: "m" | "f" = "m"): string {
  const stressed = n % 10 === 0 && n % 100 !== 10;
  if (gender === "f") return `${n}${stressed ? "ή" : "η"}`;
  return `${n}${stressed ? "ός" : "ος"}`;
}
