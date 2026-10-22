// src/app/lib/dbErrors/describeDbError.ts
//
// Turns a Postgres/PostgREST error from an admin write into one Greek sentence
// that names the row and the rule — for save-all and the matches dashboard.
//
// The set of rules is finite: the constraints, UNIQUE indexes and triggers on
// the tables those routes write. Some live only in the database (no migration
// in the repo: unique_league_match_idx, ensure_match_teams_active), so the
// mapping is checked against the live catalog by scripts/check-error-catalog.ts
// (needs migrations/add-list-write-rules-fn.sql). A rule that is not in RULES
// still gets a message that names the row and quotes the raw error — nothing
// is less readable than the raw text was.
//
// Pure: no DB access, so it is unit-tested. Row context (team names, matchday,
// archived-since) is loaded by matchContext.ts and passed in.

import { formatInstant } from "@/app/lib/datetime";

export type PgErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type WriteEntity =
  | "matches"
  | "tournament_teams"
  | "tournament_stages"
  | "tournament_groups"
  | "tournaments"
  | "stage_slots"
  | "intake_mappings";

export type TeamRef = { id: number | null; name?: string | null; deleted_at?: string | null };

export type WriteContext = {
  entity?: WriteEntity | null;
  /** DB id of the failing row, when a single row was being written. */
  id?: number | null;
  /** e.g. "2η αγωνιστική, WALKERS – RED PULSE". */
  label?: string | null;
  teams?: { a?: TeamRef | null; b?: TeamRef | null } | null;
  /** Names for team ids that may appear in the error's `Key (…)=(…)` details. */
  teamNameById?: Record<number, string> | null;
  /** One-by-one writes: rows already written before this one / never sent. */
  progress?: { done: number; remaining: number } | null;
  /** The sent row equals the stored row — the admin did not change it. */
  unchanged?: boolean | null;
};

export type DescribedError = {
  /** Greek, for the admin. Always set. */
  message: string;
  /** Constraint / index / trigger-function name that was hit; null if unmapped. */
  rule: string | null;
  /** The raw Postgres text, for support and the audit log. */
  raw: string;
  /** HTTP status to answer with. */
  status: number;
  /** false when the generic fallback was used. */
  known: boolean;
};

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export type PgErrorKind =
  | "unique"
  | "fk"
  | "check"
  | "not_null"
  | "exclusion"
  | "trigger"
  | "rls"
  | "format"
  | "other";

export type ParsedPgError = {
  code: string;
  kind: PgErrorKind;
  /** Constraint/index name; the column for not_null; null for triggers. */
  rule: string | null;
  /** Table named in the message, when Postgres includes one. */
  table: string | null;
  /** `Key (a, b)=(1, 2)` from details, split into columns → values. */
  key: Record<string, string> | null;
  raw: string;
};

export function parsePgError(err: PgErrorLike): ParsedPgError {
  const code = String(err.code ?? "");
  const message = String(err.message ?? "");
  const details = String(err.details ?? "");
  const raw = [message, details, err.hint].filter(Boolean).join(" — ");

  const table = /(?:relation|table) "([^"]+)"/.exec(message)?.[1] ?? null;
  const key = parseKey(details);

  let m: RegExpExecArray | null;
  if ((m = /violates unique constraint "([^"]+)"/.exec(message)))
    return { code, kind: "unique", rule: m[1], table, key, raw };
  if ((m = /violates foreign key constraint "([^"]+)"/.exec(message)))
    return { code, kind: "fk", rule: m[1], table, key, raw };
  if ((m = /violates check constraint "([^"]+)"/.exec(message)))
    return { code, kind: "check", rule: m[1], table, key, raw };
  if ((m = /violates exclusion constraint "([^"]+)"/.exec(message)))
    return { code, kind: "exclusion", rule: m[1], table, key, raw };
  if ((m = /null value in column "([^"]+)"/.exec(message)))
    return { code, kind: "not_null", rule: m[1], table, key, raw };

  if (code === "P0001" || code.startsWith("P0")) return { code, kind: "trigger", rule: null, table, key, raw };
  if (code === "42501") return { code, kind: "rls", rule: null, table, key, raw };
  if (code === "22P02" || code.startsWith("22")) return { code, kind: "format", rule: null, table, key, raw };
  // SQLSTATE class fallbacks when the message shape is unexpected.
  if (code === "23505") return { code, kind: "unique", rule: null, table, key, raw };
  if (code === "23503") return { code, kind: "fk", rule: null, table, key, raw };
  if (code === "23514") return { code, kind: "check", rule: null, table, key, raw };
  if (code === "23502") return { code, kind: "not_null", rule: null, table, key, raw };
  return { code, kind: "other", rule: null, table, key, raw };
}

function parseKey(details: string): Record<string, string> | null {
  const m = /Key \(([^)]+)\)=\((.*)\)/.exec(details);
  if (!m) return null;
  const cols = m[1].split(",").map((s) => s.trim());
  const vals = m[2].split(",").map((s) => s.trim());
  if (cols.length !== vals.length) return null;
  const out: Record<string, string> = {};
  cols.forEach((c, i) => (out[c] = vals[i]));
  return out;
}

/* ------------------------------------------------------------------ */
/* Rules → Greek                                                       */
/* ------------------------------------------------------------------ */

type RuleText = (p: ParsedPgError, ctx: WriteContext) => string;

type Rule = {
  /** Constraint / index name, or the trigger (function) name for triggers. */
  name: string;
  /** For triggers: the RAISE text to recognise (triggers have no constraint name). */
  trigger?: RegExp;
  status?: number;
  text: RuleText;
};

const DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

const ordinalMatchday = (n: number | string) => `${n}η αγωνιστική`;

function teamName(ctx: WriteContext, id: number | string | null | undefined): string {
  if (id == null || id === "null" || id === "") return "άγνωστη ομάδα";
  const n = Number(id);
  if (ctx.teams?.a?.id === n && ctx.teams.a.name) return ctx.teams.a.name;
  if (ctx.teams?.b?.id === n && ctx.teams.b.name) return ctx.teams.b.name;
  const fromMap = ctx.teamNameById?.[n];
  return fromMap ? fromMap : `#${n}`;
}

/** The pair named by the error key if present, else the row's teams. */
function pairText(p: ParsedPgError, ctx: WriteContext): string {
  const k = p.key ?? {};
  const a = k.team_a_id ?? k.least ?? ctx.teams?.a?.id ?? null;
  const b = k.team_b_id ?? k.greatest ?? ctx.teams?.b?.id ?? null;
  if (a == null && b == null) return "αυτό το ζευγάρι";
  return `${teamName(ctx, a)} – ${teamName(ctx, b)}`;
}

const archivedTeamsText: RuleText = (_p, ctx) => {
  const archived = [ctx.teams?.a, ctx.teams?.b].filter(
    (t): t is TeamRef => !!t && !!t.deleted_at,
  );
  const since = (t: TeamRef) => (t.deleted_at ? ` από ${formatInstant(t.deleted_at, DATE)}` : "");
  const fix =
    "Επαναφέρετε την ομάδα (Ομάδες → Αρχειοθετημένες) ή αλλάξτε την σε όλους τους αγώνες της.";
  if (archived.length === 1) {
    return `Η ομάδα ${archived[0].name ?? `#${archived[0].id}`} είναι αρχειοθετημένη${since(archived[0])} αλλά έχει ακόμη αγώνες σε αυτή τη διοργάνωση. ${fix}`;
  }
  if (archived.length === 2) {
    return `Οι ομάδες ${archived.map((t) => t.name ?? `#${t.id}`).join(" και ")} είναι αρχειοθετημένες αλλά έχουν ακόμη αγώνες σε αυτή τη διοργάνωση. ${fix}`;
  }
  return `Μία από τις ομάδες του αγώνα είναι αρχειοθετημένη αλλά έχει ακόμη αγώνες σε αυτή τη διοργάνωση. ${fix}`;
};

const leagueDuplicateText: RuleText = (p, ctx) => {
  const md = p.key?.matchday;
  const where = md && md !== "null" ? `στην ${ordinalMatchday(md)}` : "σε αυτή την αγωνιστική";
  return `Το ζευγάρι ${pairText(p, ctx)} υπάρχει ήδη ${where}. Κάθε ζευγάρι παίζει μία φορά ανά αγωνιστική — αλλάξτε αγωνιστική ή αντίπαλο.`;
};

const koDuplicateText: RuleText = (p) => {
  const k = p.key ?? {};
  const slot = [
    k.round && k.round !== "null" ? `γύρος ${k.round}` : null,
    k.bracket_pos && k.bracket_pos !== "null" ? `θέση ${k.bracket_pos}` : null,
    k.leg && k.leg !== "null" ? `${k.leg}ο σκέλος` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `Υπάρχει ήδη αγώνας σε αυτή τη θέση του bracket${slot ? ` (${slot})` : ""}. Διαγράψτε τον διπλό ή αλλάξτε θέση.`;
};

const teamGoneText: RuleText = (p, ctx) => {
  const id = p.key?.team_a_id ?? p.key?.team_b_id ?? p.key?.winner_team_id ?? p.key?.team_id ?? null;
  return `Η ομάδα ${teamName(ctx, id)} δεν υπάρχει πια στη βάση (διαγράφηκε οριστικά). Επιλέξτε άλλη ομάδα.`;
};

const reloadText = (what: string): RuleText => () =>
  `${what} δεν υπάρχει πια. Φορτώστε ξανά τη σελίδα.`;

const teamAlreadyInTournamentText: RuleText = (p, ctx) => {
  const id = p.key?.team_id ?? null;
  const stage = p.key?.stage_id && p.key.stage_id !== "null" ? " στην ίδια φάση" : "";
  return `Η ομάδα ${teamName(ctx, id)} είναι ήδη δηλωμένη σε αυτή τη διοργάνωση${stage}. Αφαιρέστε τη διπλή εγγραφή.`;
};

/**
 * One entry per rule. `name` is what scripts/check-error-catalog.ts compares
 * against the live catalog, so keep it identical to the DB object's name.
 */
export const RULES: Rule[] = [
  // ---- matches: triggers ------------------------------------------------
  {
    name: "ensure_match_teams_active",
    trigger: /archived \(soft-deleted\) team/i,
    status: 400,
    text: archivedTeamsText,
  },
  // ---- matches: uniqueness ----------------------------------------------
  { name: "unique_league_match_idx", status: 409, text: leagueDuplicateText },
  { name: "unique_league_match", status: 409, text: leagueDuplicateText },
  { name: "unique_ko_match", status: 409, text: koDuplicateText },
  // ---- matches: checks --------------------------------------------------
  {
    name: "matches_status_check",
    text: () =>
      "Μη έγκυρη κατάσταση αγώνα — επιτρέπονται μόνο: προγραμματισμένος, ολοκληρωμένος, αναβληθείς.",
  },
  { name: "matches_leg_check", text: () => "Μη έγκυρο σκέλος (leg) — επιτρέπονται μόνο 1 ή 2." },
  // ---- matches: foreign keys -------------------------------------------
  { name: "matches_team_a_id_fkey", text: teamGoneText },
  { name: "matches_team_b_id_fkey", text: teamGoneText },
  { name: "matches_winner_team_id_fkey", text: teamGoneText },
  { name: "matches_tie_leg1_match_id_fkey", text: reloadText("Ο αγώνας του 1ου σκέλους") },
  { name: "matches_stage_id_fkey", text: reloadText("Η φάση του αγώνα") },
  { name: "matches_group_id_fkey", text: reloadText("Ο όμιλος του αγώνα") },
  { name: "matches_tournament_id_fkey", text: reloadText("Η διοργάνωση") },
  { name: "matches_postponed_by_fkey", text: reloadText("Ο χρήστης που καταχώρησε την αναβολή") },
  // ---- tournament_teams -------------------------------------------------
  { name: "tournament_teams_tournament_id_team_id_stage_id_key", status: 409, text: teamAlreadyInTournamentText },
  { name: "tournament_teams_tournament_id_team_id_key", status: 409, text: teamAlreadyInTournamentText },
  { name: "tournament_teams_tournament_id_team_id_unique", status: 409, text: teamAlreadyInTournamentText },
  { name: "tournament_teams_team_id_fkey", text: teamGoneText },
  { name: "tournament_teams_tournament_id_fkey", text: reloadText("Η διοργάνωση") },
  { name: "tournament_teams_stage_id_fkey", text: reloadText("Η φάση") },
  { name: "tournament_teams_group_id_fkey", text: reloadText("Ο όμιλος") },
  // ---- intake_mappings --------------------------------------------------
  {
    name: "intake_mappings_from_edge_uniq",
    status: 409,
    text: () =>
      "Η ίδια πηγή (γύρος/θέση/έκβαση) έχει ήδη αντιστοιχιστεί σε θέση ομίλου. Κάθε πηγή οδηγεί σε μία θέση.",
  },
];

/** Names scripts/check-error-catalog.ts expects to find in the live catalog. */
export const KNOWN_RULE_NAMES: readonly string[] = RULES.map((r) => r.name);

/**
 * Live rules that need no message: primary keys (ids come from identity
 * columns, never from the admin) and bookkeeping triggers that never RAISE.
 */
export const IGNORED_RULE_PATTERNS: readonly RegExp[] = [
  /_pkey$/,
  /^audit_row_change$/,
  /updated_at/i,
  /_stamp$/,
];

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

const ENTITY_PREFIX: Record<WriteEntity, string> = {
  matches: "Αγώνας",
  tournament_teams: "Ομάδες διοργάνωσης",
  tournament_stages: "Φάσεις",
  tournament_groups: "Όμιλοι",
  tournaments: "Διοργάνωση",
  stage_slots: "Θέσεις φάσης",
  intake_mappings: "Αντιστοιχίσεις πρόκρισης",
};

const TABLE_TO_ENTITY: Record<string, WriteEntity> = {
  matches: "matches",
  tournament_teams: "tournament_teams",
  tournament_stages: "tournament_stages",
  tournament_groups: "tournament_groups",
  tournaments: "tournaments",
  stage_slots: "stage_slots",
  intake_mappings: "intake_mappings",
};

function prefixFor(p: ParsedPgError, ctx: WriteContext): string {
  const entity = ctx.entity ?? (p.table ? TABLE_TO_ENTITY[p.table] : undefined) ?? null;
  if (!entity) return "";
  if (entity === "matches") {
    if (ctx.id != null) return `Αγώνας #${ctx.id}${ctx.label ? ` (${ctx.label})` : ""}: `;
    // Only a caller that says "matches" with no id is inserting new rows; an
    // entity inferred from the message is just some match.
    return ctx.entity === "matches" ? "Νέοι αγώνες: " : "Αγώνας: ";
  }
  return `${ENTITY_PREFIX[entity]}: `;
}

function keyText(p: ParsedPgError): string {
  if (!p.key) return "";
  return ` (${Object.entries(p.key)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")})`;
}

function genericText(p: ParsedPgError): { text: string; status: number } {
  switch (p.kind) {
    case "unique":
    case "exclusion":
      return { text: `Διπλότυπη εγγραφή${keyText(p)}${p.rule ? ` — κανόνας ${p.rule}` : ""}.`, status: 409 };
    case "fk":
      return {
        text: `Αναφορά σε εγγραφή που δεν υπάρχει πια${keyText(p)}${p.rule ? ` — κανόνας ${p.rule}` : ""}. Φορτώστε ξανά τη σελίδα.`,
        status: 409,
      };
    case "check":
      return { text: `Μη έγκυρη τιμή — παραβιάζει τον κανόνα ${p.rule ?? "της βάσης"}.`, status: 400 };
    case "not_null":
      return { text: `Λείπει υποχρεωτικό πεδίο: ${p.rule ?? "άγνωστο"}.`, status: 400 };
    case "trigger":
      return { text: `Η βάση απέρριψε την αλλαγή: ${p.raw}`, status: 400 };
    case "rls":
      return { text: "Δεν έχετε δικαίωμα για αυτή την ενέργεια.", status: 403 };
    case "format":
      return { text: `Μη έγκυρη μορφή τιμής σε κάποιο πεδίο: ${p.raw}`, status: 400 };
    default:
      return { text: `Η αποθήκευση απέτυχε: ${p.raw}`, status: 500 };
  }
}

function findRule(p: ParsedPgError): Rule | null {
  if (p.kind === "trigger") {
    return RULES.find((r) => r.trigger && r.trigger.test(p.raw)) ?? null;
  }
  if (!p.rule) return null;
  return RULES.find((r) => !r.trigger && r.name === p.rule) ?? null;
}

function defaultStatus(kind: PgErrorKind): number {
  switch (kind) {
    case "unique":
    case "exclusion":
    case "fk":
      return 409;
    case "rls":
      return 403;
    case "other":
      return 500;
    default:
      return 400;
  }
}

export function describeDbError(err: PgErrorLike, ctx: WriteContext = {}): DescribedError {
  const p = parsePgError(err);
  const rule = findRule(p);

  let body: string;
  let status: number;
  if (rule) {
    body = rule.text(p, ctx);
    status = rule.status ?? defaultStatus(p.kind);
  } else {
    const g = genericText(p);
    body = g.text;
    status = g.status;
  }

  const parts = [prefixFor(p, ctx) + body];

  if (ctx.unchanged) {
    parts.push(
      (ctx.entity ?? TABLE_TO_ENTITY[p.table ?? ""]) === "matches"
        ? "Δεν αλλάξατε κάτι σε αυτόν τον αγώνα — απορρίφθηκε όπως είναι ήδη αποθηκευμένος."
        : "Δεν αλλάξατε κάτι σε αυτή την εγγραφή — απορρίφθηκε όπως είναι ήδη αποθηκευμένη.",
    );
  }

  if (ctx.progress) {
    const total = ctx.progress.done + ctx.progress.remaining + 1;
    parts.push(
      `Αποθηκεύτηκαν ${ctx.progress.done} από ${total} αγώνες πριν σταματήσει η αποθήκευση — διορθώστε το και πατήστε ξανά Save.`,
    );
  }

  return {
    message: parts.join(" "),
    rule: rule?.name ?? p.rule,
    raw: p.raw,
    status,
    known: !!rule,
  };
}
