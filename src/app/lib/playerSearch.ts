// Pure ranking for the admin "find an existing player" boxes. Greek names are
// typed with or without tonos, in either word order, often half-finished
// ("γιαν παπ"), so matching folds accents/case/final sigma on BOTH sides and
// treats every query token as a word prefix. Postgres `ilike` alone can't do
// this without the unaccent extension, so the API routes fold in JS over the
// (small) active player list instead. Unit-tested in __tests__/playerSearch.test.ts.

export type SearchablePlayer = {
  id: number;
  first_name: string;
  last_name: string;
  player_number?: number | null;
};

/** Lower-case, accent-stripped, final-sigma-normalised, single-spaced. */
export function foldName(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(q: string): string[] {
  return foldName(q).split(" ").filter(Boolean);
}

/** True when `tokens` are prefixes of consecutive words of `words`, in order. */
function orderedWordPrefix(words: string[], tokens: string[]): boolean {
  if (tokens.length === 0 || tokens.length > words.length) return false;
  for (let k = 0; k + tokens.length <= words.length; k++) {
    if (tokens.every((t, i) => words[k + i].startsWith(t))) return true;
  }
  return false;
}

/**
 * 0 = the tokens are, in order, prefixes of consecutive name words
 *     ("γιαν παπ" → Γιάννης Παπαδόπουλος; last-name-first also counts),
 * 1 = every token is a prefix of some word (any order),
 * 2 = every token appears somewhere in the name,
 * null = no match.
 */
export function matchScore(p: SearchablePlayer, tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  const firstWords = foldName(p.first_name).split(" ").filter(Boolean);
  const lastWords = foldName(p.last_name).split(" ").filter(Boolean);
  const words = [...firstWords, ...lastWords];
  const full = words.join(" ");

  if (orderedWordPrefix(words, tokens) || orderedWordPrefix([...lastWords, ...firstWords], tokens)) return 0;
  if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return 1;
  if (tokens.every((t) => full.includes(t))) return 2;
  return null;
}

/** "#12" / "12" → 12; anything else → null. */
export function numericQuery(q: string): number | null {
  const m = /^#?(\d{1,9})$/.exec(q.trim());
  return m ? Number(m[1]) : null;
}

/**
 * Filter + rank. A purely numeric query matches the player id or shirt
 * number instead of the name. Ties break on last name, first name, id so the
 * order is stable between keystrokes.
 */
export function rankPlayers<T extends SearchablePlayer>(rows: T[], q: string, limit = 30): T[] {
  const n = numericQuery(q);
  const tokens = tokenize(q);
  if (n === null && tokens.length === 0) return [];

  const scored: { row: T; score: number }[] = [];
  for (const row of rows) {
    if (n !== null) {
      if (row.id === n) scored.push({ row, score: 0 });
      else if (row.player_number != null && row.player_number === n) scored.push({ row, score: 1 });
      continue;
    }
    const s = matchScore(row, tokens);
    if (s !== null) scored.push({ row, score: s });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const ln = foldName(a.row.last_name).localeCompare(foldName(b.row.last_name), "el");
    if (ln !== 0) return ln;
    const fn = foldName(a.row.first_name).localeCompare(foldName(b.row.first_name), "el");
    if (fn !== 0) return fn;
    return a.row.id - b.row.id;
  });

  return scored.slice(0, Math.max(0, limit)).map((s) => s.row);
}
