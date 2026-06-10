// Helpers for safely embedding user input in PostgREST filter strings.
//
// supabase-js builds `.or()` filters as a comma/paren-delimited mini-language,
// so `,`, `(`, `)` and `"` in an interpolated value are parsed as filter
// syntax — a crafted search term could inject additional clauses.

/** Strip PostgREST filter metacharacters from a user-supplied search term. */
export function sanitizeFilterTerm(input: string): string {
  return input.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Strict ISO-8601 timestamp check (no PostgREST metacharacters can pass). */
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/;

export function isIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_RE.test(value) && Number.isFinite(Date.parse(value));
}
