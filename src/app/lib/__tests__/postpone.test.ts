import { describe, it, expect } from "vitest";
import {
  buildPostponeAnnouncement,
  planPostpone,
  postponeAnnouncementTitles,
  statusForDate,
  type PostponeCurrent,
} from "../postpone";
import { nowWallClockIso } from "../datetime";

describe("statusForDate", () => {
  it("puts a postponed match with a date back on the schedule", () => {
    expect(statusForDate("postponed", "2026-11-20T21:00:00.000Z")).toBe("scheduled");
  });

  it("keeps a postponed match without a date postponed", () => {
    expect(statusForDate("postponed", null)).toBe("postponed");
    expect(statusForDate("postponed", undefined)).toBe("postponed");
  });

  it("passes other statuses through", () => {
    expect(statusForDate("scheduled", "2026-11-20T21:00:00.000Z")).toBe("scheduled");
    expect(statusForDate("finished", "2026-11-20T21:00:00.000Z")).toBe("finished");
    expect(statusForDate("scheduled", null)).toBe("scheduled");
  });
});

describe("nowWallClockIso", () => {
  it("renders the Athens wall clock in match-date shape", () => {
    // 2026-11-14 22:30 UTC = 2026-11-15 00:30 in Athens (UTC+2 in winter)
    expect(nowWallClockIso("Europe/Athens", new Date("2026-11-14T22:30:00Z"))).toBe(
      "2026-11-15T00:30:00"
    );
    // summer time (UTC+3), and midnight is 00 not 24
    expect(nowWallClockIso("Europe/Athens", new Date("2026-07-01T21:00:05Z"))).toBe(
      "2026-07-02T00:00:05"
    );
  });
});

const base = {
  reason: null,
  userId: "user-1",
  nowInstant: "2026-11-14T10:00:00.000Z",
  nowWall: "2026-11-14T12:00:00",
};

const scheduled: PostponeCurrent = {
  status: "scheduled",
  match_date: "2026-11-16T21:00:00+00:00",
  original_match_date: null,
  postponement_reason: null,
};

const postponedNoDate: PostponeCurrent = {
  status: "postponed",
  match_date: null,
  original_match_date: "2026-10-28T22:00:00+00:00",
  postponement_reason: "Αίτημα ομάδας",
};

describe("planPostpone — postponed match gets its new date", () => {
  it("accepts the date although the match has none (the reported bug)", () => {
    const plan = planPostpone({
      ...base,
      current: postponedNoDate,
      newDateISO: "2026-11-25T21:00:00.000Z",
    });
    expect(plan).toEqual({
      ok: true,
      mode: "reschedule",
      update: {
        status: "scheduled",
        match_date: "2026-11-25T21:00:00.000Z",
        original_match_date: "2026-10-28T22:00:00+00:00",
        postponement_reason: "Αίτημα ομάδας",
      },
      previousDate: "2026-10-28T22:00:00+00:00",
    });
  });

  it("does not overwrite who/when postponed it", () => {
    const plan = planPostpone({ ...base, current: postponedNoDate, newDateISO: "2026-11-25T21:00:00.000Z" });
    expect(plan.ok && "postponed_at" in plan.update).toBe(false);
    expect(plan.ok && "postponed_by" in plan.update).toBe(false);
  });

  it("requires the date", () => {
    const plan = planPostpone({ ...base, current: postponedNoDate, newDateISO: null });
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.status).toBe(400);
  });

  it("allows a past date (filling in a match already played)", () => {
    const plan = planPostpone({ ...base, current: postponedNoDate, newDateISO: "2026-11-01T21:00:00.000Z" });
    expect(plan.ok).toBe(true);
  });

  it("keeps the first original date for a legacy postponed row that had a date", () => {
    const plan = planPostpone({
      ...base,
      current: { ...postponedNoDate, match_date: "2026-11-20T21:00:00+00:00", original_match_date: null },
      newDateISO: "2026-11-27T21:00:00.000Z",
    });
    expect(plan.ok && plan.update.original_match_date).toBe("2026-11-20T21:00:00+00:00");
    expect(plan.ok && plan.update.status).toBe("scheduled");
  });
});

describe("planPostpone — postponing a scheduled match", () => {
  it("without a date: postponed, date cleared, original kept", () => {
    const plan = planPostpone({ ...base, current: scheduled, newDateISO: null, reason: "Έλλειψη γηπέδου" });
    expect(plan).toEqual({
      ok: true,
      mode: "postpone",
      update: {
        status: "postponed",
        match_date: null,
        original_match_date: "2026-11-16T21:00:00+00:00",
        postponement_reason: "Έλλειψη γηπέδου",
        postponed_at: "2026-11-14T10:00:00.000Z",
        postponed_by: "user-1",
      },
      previousDate: "2026-11-16T21:00:00+00:00",
    });
  });

  it("with a date: stays scheduled at the new date", () => {
    const plan = planPostpone({ ...base, current: scheduled, newDateISO: "2026-11-30T21:00:00.000Z" });
    expect(plan.ok && plan.update.status).toBe("scheduled");
    expect(plan.ok && plan.update.match_date).toBe("2026-11-30T21:00:00.000Z");
    expect(plan.ok && plan.update.original_match_date).toBe("2026-11-16T21:00:00+00:00");
  });

  it("keeps the very first original date on a second postponement", () => {
    const plan = planPostpone({
      ...base,
      current: { ...scheduled, original_match_date: "2026-10-28T22:00:00+00:00" },
      newDateISO: null,
    });
    expect(plan.ok && plan.update.original_match_date).toBe("2026-10-28T22:00:00+00:00");
  });

  it("compares the new date to the Athens wall clock, not UTC", () => {
    // nowWall is 12:00 Athens. 11:30 wall-clock is past, 12:30 is later today.
    expect(planPostpone({ ...base, current: scheduled, newDateISO: "2026-11-14T11:30:00.000Z" }).ok).toBe(false);
    expect(planPostpone({ ...base, current: scheduled, newDateISO: "2026-11-14T12:30:00.000Z" }).ok).toBe(true);
  });

  it("rejects a scheduled match that has no date", () => {
    const plan = planPostpone({ ...base, current: { ...scheduled, match_date: null }, newDateISO: null });
    expect(!plan.ok && plan.status).toBe(400);
  });

  it("rejects a finished match", () => {
    const plan = planPostpone({ ...base, current: { ...scheduled, status: "finished" }, newDateISO: null });
    expect(!plan.ok && plan.status).toBe(409);
  });
});

describe("buildPostponeAnnouncement", () => {
  const now = new Date("2026-11-14T10:00:00.000Z");

  it("new-date notice for a postponed match", () => {
    const a = buildPostponeAnnouncement({
      mode: "reschedule",
      teamAName: "Α.Π.Μ.",
      teamBName: "CONSTRUCTION FC",
      previousDate: "2026-10-28T22:00:00+00:00",
      newDateISO: "2026-11-25T21:00:00.000Z",
      reason: null,
      now,
    });
    expect(a.title).toBe(postponeAnnouncementTitles("Α.Π.Μ.", "CONSTRUCTION FC").reschedule);
    expect(a.body).toContain("που είχε αναβληθεί, θα διεξαχθεί");
    expect(a.body).toContain("21:00");
    expect(a.body).toContain("**Αρχική ημερομηνία**");
    expect(a.end_at).toBe("2026-11-26T21:00:00.000Z");
  });

  it("date-TBD postponement notice stays up 30 days", () => {
    const a = buildPostponeAnnouncement({
      mode: "postpone",
      teamAName: "A",
      teamBName: "B",
      previousDate: "2026-11-16T21:00:00+00:00",
      newDateISO: null,
      reason: "Αίτημα ομάδας",
      now,
    });
    expect(a.title).toBe("Αναβολή Αγώνα: A - B");
    expect(a.body).toContain("Θα ανακοινωθεί σύντομα");
    expect(a.body).toContain("**Λόγος**: Αίτημα ομάδας");
    expect(a.end_at).toBe("2026-12-14T10:00:00.000Z");
  });
});
