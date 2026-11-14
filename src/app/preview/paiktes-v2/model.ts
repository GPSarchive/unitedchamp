// Pure model for the players directory: search folding, filtering, sorting,
// ranking and URL state. No React, no I/O — unit-tested in model.test.ts.
// The whole active season ships to the browser once (a few hundred players),
// so everything here runs client-side on every keystroke.

// ───────────────────────────────────────────────────────────────────────
// Data shapes (server → client payload, kept compact)
// ───────────────────────────────────────────────────────────────────────

/** [matches, wins, goals, assists, mvp, best_gk, yellow, red, blue] */
export type StatTuple = [number, number, number, number, number, number, number, number, number];

export const ZERO_STATS: StatTuple = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export type StatKey = "matches" | "wins" | "goals" | "assists" | "mvp" | "best_gk";

/** Column order of the stat table; index = position in StatTuple. */
export const STAT_KEYS: readonly StatKey[] = ["matches", "wins", "goals", "assists", "mvp", "best_gk"];

const STAT_INDEX: Record<StatKey, number> = {
  matches: 0,
  wins: 1,
  goals: 2,
  assists: 3,
  mvp: 4,
  best_gk: 5,
};

export const STAT_LABELS: Record<StatKey, { full: string; short: string; title: string }> = {
  matches: { full: "Αγώνες", short: "Αγ.", title: "Αγώνες" },
  wins: { full: "Νίκες", short: "Ν.", title: "Νίκες" },
  goals: { full: "Γκολ", short: "Γκ.", title: "Γκολ" },
  assists: { full: "Ασίστ", short: "Ασ.", title: "Ασίστ" },
  mvp: { full: "MVP", short: "MVP", title: "Βραβεία MVP" },
  best_gk: { full: "Τερμ.", short: "Τερμ.", title: "Βραβεία καλύτερου τερματοφύλακα" },
};

export type DirectoryTeam = { id: number; name: string; logo: string | null };
export type DirectoryTournament = { id: number; name: string };

export type DirectoryPlayer = {
  id: number;
  first: string;
  last: string;
  photo: string | null;
  position: string;
  /** Active-season teams, main team first (max 3). */
  teamIds: number[];
  /** Active-season totals; null = no appearances yet. */
  season: StatTuple | null;
  /** Per-tournament totals, keyed by tournament id (active season only). */
  byTournament: Record<number, StatTuple>;
};

export type DirectoryData = {
  /** What the UI prints for the active season, e.g. "2026/27"; null if none. */
  seasonLabel: string | null;
  teams: DirectoryTeam[];
  tournaments: DirectoryTournament[];
  players: DirectoryPlayer[];
};

// ───────────────────────────────────────────────────────────────────────
// Search folding — Greek, Latin and greeklish
// ───────────────────────────────────────────────────────────────────────

/** Lowercase, strip accents/dialytika, unify final sigma, collapse spaces. */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

const GREEK_TO_LATIN: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

/** Letter-by-letter transliteration of already-folded text ("γιαννησ" → "giannis"). */
export function toLatin(folded: string): string {
  const pre = folded.replace(/ου/g, "ou").replace(/αυ/g, "av").replace(/ευ/g, "ev");
  let out = "";
  for (const ch of pre) out += GREEK_TO_LATIN[ch] ?? ch;
  return out;
}

/**
 * Collapses the common greeklish spellings onto one key, so "giannhs",
 * "gianis" and "Γιάννης" meet, and "xristos" meets "Χρήστος". Applied to BOTH
 * the haystack and the query, so the rules only have to be consistent.
 */
export function loosen(latin: string): string {
  return latin
    .replace(/ch/g, "x")
    .replace(/ph/g, "f")
    .replace(/ou/g, "u")
    .replace(/ei|oi/g, "i")
    .replace(/ai/g, "e")
    .replace(/[yh]/g, "i")
    .replace(/w/g, "o")
    .replace(/mp/g, "b")
    .replace(/nt/g, "d")
    .replace(/gk|gg/g, "g")
    .replace(/(.)\1+/g, "$1");
}

export type SearchKeys = { plain: string; latin: string; loose: string };

export function searchKeys(text: string): SearchKeys {
  const plain = foldText(text);
  const latin = toLatin(plain);
  return { plain, latin, loose: loosen(latin) };
}

/** One entry per typed word; every word must match (in any order). */
export function queryTokens(q: string): SearchKeys[] {
  return foldText(q)
    .split(" ")
    .filter(Boolean)
    .map((word) => searchKeys(word));
}

/**
 * A word matches when it is a substring under any of the three keys. `plain`
 * and `latin` keep prefix-typing exact ("αν", "an", "ant" all find Αντώνης);
 * `loose` adds the greeklish spellings — only from three letters on, because
 * a shorter loose key ("zzz" → "z", "nt" → "d") would match almost anyone.
 */
export function matchesTokens(hay: SearchKeys, tokens: SearchKeys[]): boolean {
  for (const t of tokens) {
    if (hay.plain.includes(t.plain)) continue;
    if (hay.latin.includes(t.latin)) continue;
    if (t.loose.length >= 3 && hay.loose.includes(t.loose)) continue;
    return false;
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────
// Query (filter + sort) state and its URL form
// ───────────────────────────────────────────────────────────────────────

export type SortKey = "name" | StatKey;
export type SortDir = "asc" | "desc";

export type DirectoryQuery = {
  q: string;
  tournamentId: number | null;
  teamId: number | null;
  /** Folded position value ("" = any). */
  position: string;
  sort: SortKey;
  dir: SortDir;
};

export const DEFAULT_QUERY: DirectoryQuery = {
  q: "",
  tournamentId: null,
  teamId: null,
  position: "",
  sort: "goals",
  dir: "desc",
};

export function defaultDir(sort: SortKey): SortDir {
  return sort === "name" ? "asc" : "desc";
}

function isSortKey(v: string): v is SortKey {
  return v === "name" || (STAT_KEYS as readonly string[]).includes(v);
}

function positiveInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Read the query from a URL search string. Unknown or malformed values fall
 * back to the default. Also accepts the old /paiktes names (`sort=alpha`,
 * `sort=tournament_goals`, `sort=bestgk`) so existing links keep working.
 */
export function parseQuery(search: string): DirectoryQuery {
  const sp = new URLSearchParams(search);
  const rawSort = (sp.get("sort") ?? "").toLowerCase();
  const legacy: Record<string, SortKey> = { alpha: "name", tournament_goals: "goals", bestgk: "best_gk" };
  const sortCandidate = legacy[rawSort] ?? rawSort;
  const sort: SortKey = isSortKey(sortCandidate) ? sortCandidate : DEFAULT_QUERY.sort;
  const rawDir = sp.get("dir");
  const dir: SortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir(sort);
  return {
    q: (sp.get("q") ?? "").slice(0, 80),
    tournamentId: positiveInt(sp.get("tournament_id")),
    teamId: positiveInt(sp.get("team")),
    position: foldText(sp.get("pos") ?? ""),
    sort,
    dir,
  };
}

/** URL search string for a query, without "?" — defaults are omitted. */
export function serializeQuery(query: DirectoryQuery): string {
  const sp = new URLSearchParams();
  const q = query.q.trim();
  if (q) sp.set("q", q);
  if (query.tournamentId != null) sp.set("tournament_id", String(query.tournamentId));
  if (query.teamId != null) sp.set("team", String(query.teamId));
  if (query.position) sp.set("pos", query.position);
  if (query.sort !== DEFAULT_QUERY.sort) sp.set("sort", query.sort);
  if (query.dir !== defaultDir(query.sort)) sp.set("dir", query.dir);
  return sp.toString();
}

/** Number of dropdown filters in use (search text and sort are not counted). */
export function activeFilterCount(query: DirectoryQuery): number {
  return (query.tournamentId != null ? 1 : 0) + (query.teamId != null ? 1 : 0) + (query.position ? 1 : 0);
}

// ───────────────────────────────────────────────────────────────────────
// Prepared directory + selection
// ───────────────────────────────────────────────────────────────────────

export type PositionOption = { value: string; label: string; count: number };

export type PreparedPlayer = {
  player: DirectoryPlayer;
  keys: SearchKeys;
  /** Folded position, for the position filter. */
  position: string;
  /** Main team (first of teamIds), if it resolved. */
  team: DirectoryTeam | null;
  /** Number of further active-season teams beyond the main one. */
  extraTeams: number;
};

export type PreparedDirectory = {
  players: PreparedPlayer[];
  teamsById: Map<number, DirectoryTeam>;
  /** Teams sorted by name, for the dropdown. */
  teamOptions: DirectoryTeam[];
  /**
   * Tournaments that have at least one player line. One that has not kicked
   * off yet would only ever produce an empty list, so it is not offered.
   */
  tournamentOptions: DirectoryTournament[];
  positionOptions: PositionOption[];
};

const collator = new Intl.Collator("el", { sensitivity: "base", numeric: true });

/** Surname first, as printed in the list. */
export function compareByName(a: DirectoryPlayer, b: DirectoryPlayer): number {
  return (
    collator.compare(a.last || a.first, b.last || b.first) ||
    collator.compare(a.first, b.first) ||
    a.id - b.id
  );
}

export function prepareDirectory(data: DirectoryData): PreparedDirectory {
  const teamsById = new Map(data.teams.map((t) => [t.id, t] as const));

  const positionCounts = new Map<string, Map<string, number>>();
  const players: PreparedPlayer[] = data.players.map((player) => {
    const teams = player.teamIds
      .map((id) => teamsById.get(id))
      .filter((t): t is DirectoryTeam => t !== undefined);
    const position = foldText(player.position);
    if (position) {
      const labels = positionCounts.get(position) ?? new Map<string, number>();
      const label = player.position.trim();
      labels.set(label, (labels.get(label) ?? 0) + 1);
      positionCounts.set(position, labels);
    }
    return {
      player,
      keys: searchKeys(
        [player.first, player.last, ...teams.map((t) => t.name), player.position].join(" "),
      ),
      position,
      team: teams[0] ?? null,
      extraTeams: Math.max(0, teams.length - 1),
    };
  });

  // One option per folded position; the label is its most common spelling.
  const positionOptions: PositionOption[] = [...positionCounts.entries()]
    .map(([value, labels]) => {
      let label = value;
      let best = -1;
      let count = 0;
      for (const [candidate, n] of labels) {
        count += n;
        if (n > best) {
          best = n;
          label = candidate;
        }
      }
      return { value, label, count };
    })
    .sort((a, b) => collator.compare(a.label, b.label));

  return {
    players,
    teamsById,
    teamOptions: [...data.teams].sort((a, b) => collator.compare(a.name, b.name)),
    tournamentOptions: data.tournaments.filter((t) =>
      data.players.some((p) => p.byTournament[t.id] !== undefined),
    ),
    positionOptions,
  };
}

/** The stat line a row shows: the tournament's when one is selected, else the season's. */
export function statsFor(player: DirectoryPlayer, tournamentId: number | null): StatTuple {
  if (tournamentId != null) return player.byTournament[tournamentId] ?? ZERO_STATS;
  return player.season ?? ZERO_STATS;
}

export function statValue(stats: StatTuple, key: StatKey): number {
  return stats[STAT_INDEX[key]];
}

export type DirectoryRow = {
  entry: PreparedPlayer;
  stats: StatTuple;
  /**
   * Position in the ranking for the sorted stat (1 = best; equal values share
   * a rank, the next one skips). null when sorting by name, or when the value
   * is 0 — a player with no goals is not "148th scorer".
   */
  rank: number | null;
};

export function selectRows(directory: PreparedDirectory, query: DirectoryQuery): DirectoryRow[] {
  const tokens = queryTokens(query.q);
  const { tournamentId, teamId, position, sort, dir } = query;

  const rows: DirectoryRow[] = [];
  for (const entry of directory.players) {
    const { player } = entry;
    // A selected tournament lists only the players who have a line in it.
    if (tournamentId != null && !player.byTournament[tournamentId]) continue;
    if (teamId != null && !player.teamIds.includes(teamId)) continue;
    if (position && entry.position !== position) continue;
    if (tokens.length > 0 && !matchesTokens(entry.keys, tokens)) continue;
    rows.push({ entry, stats: statsFor(player, tournamentId), rank: null });
  }

  if (sort === "name") {
    rows.sort((a, b) => compareByName(a.entry.player, b.entry.player));
    if (dir === "desc") rows.reverse();
    return rows;
  }

  // Best first, ties in name order; ranks are assigned on that order and
  // travel with the row if the user flips the direction.
  rows.sort(
    (a, b) =>
      statValue(b.stats, sort) - statValue(a.stats, sort) ||
      compareByName(a.entry.player, b.entry.player),
  );
  let previous = Number.NaN;
  let rank = 0;
  rows.forEach((row, i) => {
    const value = statValue(row.stats, sort);
    if (value !== previous) {
      rank = i + 1;
      previous = value;
    }
    row.rank = value > 0 ? rank : null;
  });
  if (dir === "asc") rows.reverse();
  return rows;
}

/** «1 παίκτης» / «27 παίκτες». */
export function playersLabel(n: number): string {
  return n === 1 ? "1 παίκτης" : `${n} παίκτες`;
}
