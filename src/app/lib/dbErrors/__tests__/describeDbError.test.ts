import { describe, expect, it } from "vitest";
import {
  IGNORED_RULE_PATTERNS,
  KNOWN_RULE_NAMES,
  RULES,
  describeDbError,
  parsePgError,
  type WriteContext,
} from "../describeDbError";

const redPulse = { id: 184, name: "RED PULSE", deleted_at: "2026-10-21T10:23:16.54+00:00" };
const walkers = { id: 166, name: "WALKERS", deleted_at: null };

const match2591: WriteContext = {
  entity: "matches",
  id: 2591,
  label: "2η αγωνιστική, WALKERS – RED PULSE",
  teams: { a: walkers, b: redPulse },
};

describe("parsePgError", () => {
  it("reads the constraint name and the key from a unique violation", () => {
    const p = parsePgError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "unique_ko_match"',
      details: "Key (stage_id, round, bracket_pos, leg)=(91, 2, 1, null) already exists.",
    });
    expect(p.kind).toBe("unique");
    expect(p.rule).toBe("unique_ko_match");
    expect(p.key).toEqual({ stage_id: "91", round: "2", bracket_pos: "1", leg: "null" });
  });

  it("reads the table from a foreign-key violation", () => {
    const p = parsePgError({
      code: "23503",
      message: 'insert or update on table "matches" violates foreign key constraint "matches_team_a_id_fkey"',
      details: "Key (team_a_id)=(999) is not present in table \"teams\".",
    });
    expect(p.kind).toBe("fk");
    expect(p.table).toBe("matches");
    expect(p.rule).toBe("matches_team_a_id_fkey");
  });

  it("treats P0001 as a trigger RAISE", () => {
    const p = parsePgError({ code: "P0001", message: "Cannot use archived (soft-deleted) team in matches" });
    expect(p.kind).toBe("trigger");
    expect(p.rule).toBeNull();
  });
});

describe("describeDbError — known rules", () => {
  it("names the archived team, since when, and how to fix it (T61 incident)", () => {
    const d = describeDbError(
      { code: "P0001", message: "Cannot use archived (soft-deleted) team in matches" },
      { ...match2591, unchanged: true, progress: { done: 7, remaining: 124 } },
    );
    expect(d.known).toBe(true);
    expect(d.rule).toBe("ensure_match_teams_active");
    expect(d.status).toBe(400);
    expect(d.message).toBe(
      "Αγώνας #2591 (2η αγωνιστική, WALKERS – RED PULSE): " +
        "Η ομάδα RED PULSE είναι αρχειοθετημένη από 21/10/2026 αλλά έχει ακόμη αγώνες σε αυτή τη διοργάνωση. " +
        "Επαναφέρετε την ομάδα (Ομάδες → Αρχειοθετημένες) ή αλλάξτε την σε όλους τους αγώνες της. " +
        "Δεν αλλάξατε κάτι σε αυτόν τον αγώνα — απορρίφθηκε όπως είναι ήδη αποθηκευμένος. " +
        "Αποθηκεύτηκαν 7 από 132 αγώνες πριν σταματήσει η αποθήκευση — διορθώστε το και πατήστε ξανά Save.",
    );
    expect(d.raw).toBe("Cannot use archived (soft-deleted) team in matches");
  });

  it("falls back to a generic archived message when team info is missing", () => {
    const d = describeDbError(
      { code: "P0001", message: "Cannot use archived (soft-deleted) team in matches" },
      { entity: "matches", id: 2591 },
    );
    expect(d.message).toMatch(/^Αγώνας #2591: Μία από τις ομάδες του αγώνα είναι αρχειοθετημένη/);
  });

  it("names the duplicate league pairing and matchday", () => {
    const d = describeDbError(
      {
        code: "23505",
        message: 'duplicate key value violates unique constraint "unique_league_match_idx"',
        details: "Key (stage_id, group_id, matchday, least, greatest)=(91, null, 5, 162, 184) already exists.",
      },
      { entity: "matches", id: 2610, label: "5η αγωνιστική, RED PULSE – FAM UNITED", teamNameById: { 162: "FAM UNITED", 184: "RED PULSE" } },
    );
    expect(d.status).toBe(409);
    expect(d.message).toBe(
      "Αγώνας #2610 (5η αγωνιστική, RED PULSE – FAM UNITED): Το ζευγάρι FAM UNITED – RED PULSE υπάρχει ήδη στην 5η αγωνιστική. " +
        "Κάθε ζευγάρι παίζει μία φορά ανά αγωνιστική — αλλάξτε αγωνιστική ή αντίπαλο.",
    );
  });

  it("names the bracket slot for a duplicate KO match on a batch insert", () => {
    const d = describeDbError(
      {
        code: "23505",
        message: 'duplicate key value violates unique constraint "unique_ko_match"',
        details: "Key (stage_id, round, bracket_pos, leg)=(92, 2, 1, 2) already exists.",
      },
      { entity: "matches", id: null },
    );
    expect(d.message).toBe(
      "Νέοι αγώνες: Υπάρχει ήδη αγώνας σε αυτή τη θέση του bracket (γύρος 2, θέση 1, 2ο σκέλος). Διαγράψτε τον διπλό ή αλλάξτε θέση.",
    );
  });

  it("names the team already in the tournament", () => {
    const d = describeDbError(
      {
        code: "23505",
        message: 'duplicate key value violates unique constraint "tournament_teams_tournament_id_team_id_stage_id_key"',
        details: "Key (tournament_id, team_id, stage_id)=(61, 209, null) already exists.",
      },
      { entity: "tournament_teams", teamNameById: { 209: "FADA" } },
    );
    expect(d.message).toBe(
      "Ομάδες διοργάνωσης: Η ομάδα FADA είναι ήδη δηλωμένη σε αυτή τη διοργάνωση. Αφαιρέστε τη διπλή εγγραφή.",
    );
  });

  it("infers the entity from the message when the caller gives none", () => {
    const d = describeDbError({
      code: "23514",
      message: 'new row for relation "matches" violates check constraint "matches_status_check"',
    });
    expect(d.message).toBe(
      "Αγώνας: Μη έγκυρη κατάσταση αγώνα — επιτρέπονται μόνο: προγραμματισμένος, ολοκληρωμένος, αναβληθείς.",
    );
    expect(d.status).toBe(400);
  });
});

describe("describeDbError — unmapped rules still name the row and quote the raw text", () => {
  it("unknown unique constraint", () => {
    const d = describeDbError(
      {
        code: "23505",
        message: 'duplicate key value violates unique constraint "something_new_uniq"',
        details: "Key (a, b)=(1, 2) already exists.",
      },
      match2591,
    );
    expect(d.known).toBe(false);
    expect(d.rule).toBe("something_new_uniq");
    expect(d.status).toBe(409);
    expect(d.message).toBe(
      "Αγώνας #2591 (2η αγωνιστική, WALKERS – RED PULSE): Διπλότυπη εγγραφή (a=1, b=2) — κανόνας something_new_uniq.",
    );
  });

  it("unknown trigger RAISE", () => {
    const d = describeDbError({ code: "P0001", message: "matchday must be positive" }, match2591);
    expect(d.known).toBe(false);
    expect(d.rule).toBeNull();
    expect(d.message).toBe(
      "Αγώνας #2591 (2η αγωνιστική, WALKERS – RED PULSE): Η βάση απέρριψε την αλλαγή: matchday must be positive",
    );
  });

  it("not-null names the column", () => {
    const d = describeDbError({
      code: "23502",
      message: 'null value in column "stage_id" of relation "matches" violates not-null constraint',
    });
    expect(d.message).toBe("Αγώνας: Λείπει υποχρεωτικό πεδίο: stage_id.");
  });

  it("RLS denial is a 403", () => {
    const d = describeDbError({ code: "42501", message: 'new row violates row-level security policy for table "matches"' });
    expect(d.status).toBe(403);
    expect(d.message).toBe("Αγώνας: Δεν έχετε δικαίωμα για αυτή την ενέργεια.");
  });

  it("anything else keeps the raw text and is a 500", () => {
    const d = describeDbError({ code: "XX000", message: "internal error" });
    expect(d.status).toBe(500);
    expect(d.message).toBe("Η αποθήκευση απέτυχε: internal error");
  });
});

describe("describeDbError — rules the live catalog flagged on 2026-10-22", () => {
  it("names the missing season", () => {
    const d = describeDbError({
      code: "23503",
      message: 'insert or update on table "tournaments" violates foreign key constraint "tournaments_season_fkey"',
      details: 'Key (season)=(2027-2028) is not present in table "seasons".',
    });
    expect(d.status).toBe(400);
    expect(d.message).toBe(
      "Διοργάνωση: Η σεζόν «2027-2028» δεν υπάρχει. Δημιουργήστε πρώτα τη σεζόν ή επιλέξτε υπάρχουσα.",
    );
  });

  it("names the taken group slot, 1-based", () => {
    const d = describeDbError(
      {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "intake_mappings_target_stage_id_group_idx_slot_idx_key"',
        details: "Key (target_stage_id, group_idx, slot_idx)=(92, 0, 2) already exists.",
      },
      { entity: "intake_mappings" },
    );
    expect(d.message).toBe(
      "Αντιστοιχίσεις πρόκρισης: Η θέση ομίλου (όμιλος 1, θέση 3) έχει ήδη πηγή πρόκρισης. Κάθε θέση δέχεται μία πηγή.",
    );
  });

  it("explains an invalid stage kind", () => {
    const d = describeDbError({
      code: "23514",
      message: 'new row for relation "tournament_stages" violates check constraint "tournament_stages_kind_check"',
    });
    expect(d.message).toBe(
      "Φάσεις: Μη έγκυρος τύπος φάσης — επιτρέπονται μόνο: πρωτάθλημα (league), όμιλοι (groups), νοκ-άουτ (knockout).",
    );
  });
});

describe("catalog contract", () => {
  it("rule names are unique and exported for the catalog check", () => {
    expect(new Set(KNOWN_RULE_NAMES).size).toBe(RULES.length);
    expect(KNOWN_RULE_NAMES).toContain("ensure_match_teams_active");
  });

  it("ignored patterns cover primary keys and bookkeeping triggers only", () => {
    const ignored = (n: string) => IGNORED_RULE_PATTERNS.some((re) => re.test(n));
    expect(ignored("matches_pkey")).toBe(true);
    expect(ignored("matches_id_key")).toBe(true);
    expect(ignored("audit_row_change")).toBe(true);
    expect(ignored("trigger_articles_updated_at")).toBe(true);
    expect(ignored("unique_league_match_idx")).toBe(false);
    expect(ignored("ensure_match_teams_active")).toBe(false);
  });
});
