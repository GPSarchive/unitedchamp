// src/app/lib/audit/format.ts
// Pure presentation helpers for audit_log rows (no I/O; unit-tested).

export type AuditLogRow = {
  id: number;
  at: string;
  source: "db" | "app";
  op: string;
  table_name: string | null;
  record_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  db_role: string | null;
  request_id: string | null;
  route: string | null;
  summary: string | null;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  changed: Record<string, { from: unknown; to: unknown }> | null;
  meta: Record<string, unknown> | null;
};

/** Greek labels for the audited tables (fallback: the raw name). */
export const TABLE_LABELS: Record<string, string> = {
  matches: "Αγώνες",
  match_player_stats: "Στατιστικά αγώνα",
  match_participants: "Συμμετοχές αγώνα",
  tournament_awards: "Βραβεία",
  disciplinary_actions: "Πειθαρχικά",
  tournaments: "Διοργανώσεις",
  tournament_stages: "Φάσεις",
  tournament_groups: "Όμιλοι",
  tournament_teams: "Ομάδες διοργάνωσης",
  stage_slots: "Θέσεις φάσης",
  intake_mappings: "Προκρίσεις (intake)",
  teams: "Ομάδες",
  player: "Παίκτες",
  player_teams: "Ρόστερ",
  articles: "Άρθρα",
  announcements: "Ανακοινώσεις",
  seasons: "Σεζόν",
  season_team_adjustments: "Προσαρμογές Γενικής",
  "auth.users": "Λογαριασμοί",
  storage: "Αρχεία",
};

export const OP_LABELS: Record<string, string> = {
  INSERT: "Δημιουργία",
  UPDATE: "Αλλαγή",
  DELETE: "Διαγραφή",
};

export function tableLabel(table: string | null | undefined): string {
  if (!table) return "—";
  return TABLE_LABELS[table] ?? table;
}

export function opLabel(op: string): string {
  return OP_LABELS[op] ?? op;
}

/** Who did it, for a list cell. Unattributed writes name the DB role instead. */
export function actorLabel(row: Pick<AuditLogRow, "actor_email" | "actor_id" | "db_role">): string {
  if (row.actor_email) return row.actor_email;
  if (row.actor_id) return row.actor_id;
  switch (row.db_role) {
    case "service_role":
      return "σύστημα (service role)";
    case "postgres":
      return "SQL editor / Supabase Studio";
    case "supabase_auth_admin":
      return "Supabase Auth";
    case "authenticated":
      return "συνδεδεμένος χρήστης";
    case "anon":
      return "ανώνυμος";
    default:
      return row.db_role ? `ρόλος ${row.db_role}` : "άγνωστος";
  }
}

const MAX_VALUE = 60;

/** Compact, single-line rendering of one cell value. */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "string") return truncate(v, MAX_VALUE);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return truncate(JSON.stringify(v), MAX_VALUE);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Columns that best identify a row when it was created or deleted. */
const IDENTIFYING_KEYS = [
  "name",
  "title",
  "label",
  "display_label",
  "first_name",
  "last_name",
  "email",
  "status",
  "kind",
  "match_date",
  "team_a_id",
  "team_b_id",
  "team_a_score",
  "team_b_score",
  "player_id",
  "team_id",
  "tournament_id",
  "stage_id",
  "points",
  "goals",
  "assists",
  "reason",
  "season",
  "season_label",
  "roles",
];

/** "col: old → new, …" for updates; the identifying columns otherwise. */
export function summarizeAuditRow(row: AuditLogRow, maxItems = 6): string {
  if (row.source === "app") return row.summary ?? row.op;

  if (row.op === "UPDATE" && row.changed) {
    const entries = Object.entries(row.changed);
    const shown = entries
      .slice(0, maxItems)
      .map(([k, c]) => `${k}: ${formatValue(c.from)} → ${formatValue(c.to)}`);
    const rest = entries.length - shown.length;
    return shown.join(", ") + (rest > 0 ? ` (+${rest})` : "");
  }

  const snapshot = row.op === "DELETE" ? row.old_row : row.new_row;
  if (!snapshot) return row.summary ?? "";
  const parts: string[] = [];
  for (const k of IDENTIFYING_KEYS) {
    if (k in snapshot && snapshot[k] !== null && snapshot[k] !== undefined) {
      parts.push(`${k}: ${formatValue(snapshot[k])}`);
      if (parts.length >= maxItems) break;
    }
  }
  return parts.join(", ");
}
