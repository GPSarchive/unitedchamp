import { describe, expect, it } from "vitest";
import { actorLabel, formatValue, summarizeAuditRow, type AuditLogRow } from "../format";

const base: AuditLogRow = {
  id: 1,
  at: "2026-09-14T10:00:00Z",
  source: "db",
  op: "UPDATE",
  table_name: "matches",
  record_id: "2566",
  actor_id: "11111111-1111-1111-1111-111111111111",
  actor_email: "admin@example.com",
  db_role: "service_role",
  request_id: "req-1",
  route: "PATCH /api/matches/2566",
  summary: null,
  old_row: null,
  new_row: null,
  changed: null,
  meta: null,
};

describe("summarizeAuditRow", () => {
  it("lists changed columns as old → new for updates", () => {
    const row: AuditLogRow = {
      ...base,
      changed: {
        team_a_score: { from: 2, to: 3 },
        status: { from: "scheduled", to: "finished" },
      },
    };
    expect(summarizeAuditRow(row)).toBe("team_a_score: 2 → 3, status: scheduled → finished");
  });

  it("caps the number of changes shown and counts the rest", () => {
    const changed = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`c${i}`, { from: i, to: i + 1 }]),
    );
    const s = summarizeAuditRow({ ...base, changed }, 3);
    expect(s).toBe("c0: 0 → 1, c1: 1 → 2, c2: 2 → 3 (+6)");
  });

  it("uses identifying columns of the new row for inserts", () => {
    const row: AuditLogRow = {
      ...base,
      op: "INSERT",
      new_row: { id: 9, name: "ΑΕΚ", season_label: "2025-2026", logo: "x.png", colour: "#fff" },
    };
    expect(summarizeAuditRow(row)).toBe("name: ΑΕΚ, season_label: 2025-2026");
  });

  it("uses the old row for deletes and renders null as ∅", () => {
    const row: AuditLogRow = {
      ...base,
      op: "DELETE",
      old_row: { id: 5, title: "Draft", status: null, slug: "draft" },
    };
    expect(summarizeAuditRow(row)).toBe("title: Draft");
    expect(formatValue(null)).toBe("∅");
  });

  it("returns the summary for app events", () => {
    const row: AuditLogRow = { ...base, source: "app", op: "season.close", summary: "Έκλεισε η 2025-2026" };
    expect(summarizeAuditRow(row)).toBe("Έκλεισε η 2025-2026");
  });
});

describe("actorLabel", () => {
  it("prefers the email, then the id, then names the DB role", () => {
    expect(actorLabel(base)).toBe("admin@example.com");
    expect(actorLabel({ ...base, actor_email: null })).toBe(base.actor_id);
    expect(actorLabel({ actor_email: null, actor_id: null, db_role: "postgres" })).toBe(
      "SQL editor / Supabase Studio",
    );
    expect(actorLabel({ actor_email: null, actor_id: null, db_role: "service_role" })).toBe(
      "σύστημα (service role)",
    );
  });
});

describe("formatValue", () => {
  it("truncates long strings and stringifies objects", () => {
    expect(formatValue("a".repeat(80)).length).toBe(60);
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
    expect(formatValue(true)).toBe("true");
  });
});
