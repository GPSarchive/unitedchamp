import { describe, it, expect } from "vitest";
import {
  calendarDateIn,
  isOpenTournamentStatus,
  seasonMoveLabels,
  teamSeasonMismatches,
  unfinishedMatchBuckets,
} from "../seasonChecks";

describe("teamSeasonMismatches", () => {
  const rows = [
    { id: 1, season_label: "2025-2026" },
    { id: 2, season_label: "2025-2026" },
    { id: 3, season_label: "2024-2025" },
    { id: 4, season_label: null },
  ];

  it("accepts teams of the requested season", () => {
    expect(teamSeasonMismatches([1, 2], rows, "2025-2026")).toEqual([]);
  });

  it("flags other-season, unstamped and unknown teams, once each", () => {
    expect(teamSeasonMismatches([1, 3, 4, 99, 3], rows, "2025-2026")).toEqual([3, 4, 99]);
  });

  it("ignores nulls, undefined and non-positive ids (TBD slots)", () => {
    expect(teamSeasonMismatches([null, undefined, 0, -5, 2], rows, "2025-2026")).toEqual([]);
  });
});

describe("seasonMoveLabels", () => {
  it("is empty when the season did not change", () => {
    expect(seasonMoveLabels("2025-2026", "2025-2026")).toEqual([]);
    expect(seasonMoveLabels(" 2025-2026 ", "2025-2026")).toEqual([]);
  });

  it("returns both sides of a move", () => {
    expect(seasonMoveLabels("2025-2026", "2026-2027")).toEqual(["2025-2026", "2026-2027"]);
  });

  it("returns only the new side when the tournament had no season", () => {
    expect(seasonMoveLabels(null, "2026-2027")).toEqual(["2026-2027"]);
    expect(seasonMoveLabels("", "2026-2027")).toEqual(["2026-2027"]);
  });

  it("never asks for a snapshot of an empty label", () => {
    expect(seasonMoveLabels("2025-2026", null)).toEqual([]);
  });
});

describe("unfinishedMatchBuckets", () => {
  const today = "2026-09-05";
  const rows = [
    { id: 1, status: "finished", match_date: "2026-09-01T21:00:00" },
    { id: 2, status: "scheduled", match_date: "2026-09-04T21:00:00" },
    { id: 3, status: "postponed", match_date: "2026-08-30T20:00:00" },
    { id: 4, status: "scheduled", match_date: "2026-09-05T18:00:00" },
    { id: 5, status: "scheduled", match_date: "2026-10-02T21:00:00" },
    { id: 6, status: "postponed", match_date: null },
  ];
  const ids = (xs: { id: number }[]) => xs.map((x) => x.id);

  it("blocks on unfinished matches dated strictly before today, whatever their status", () => {
    const { past } = unfinishedMatchBuckets(rows, today);
    expect(ids(past)).toEqual([2, 3]);
  });

  it("only warns for today, future and undated matches", () => {
    const { future } = unfinishedMatchBuckets(rows, today);
    expect(ids(future)).toEqual([4, 5, 6]);
  });

  it("never lists finished matches", () => {
    const { past, future } = unfinishedMatchBuckets(rows, today);
    expect([...ids(past), ...ids(future)]).not.toContain(1);
  });

  it("compares the date part only (no time-zone shift)", () => {
    const { past } = unfinishedMatchBuckets(
      [{ id: 7, status: "scheduled", match_date: "2026-09-04T23:59:59" }],
      "2026-09-05",
    );
    expect(ids(past)).toEqual([7]);
  });
});

describe("isOpenTournamentStatus", () => {
  it("treats completed and archived as closed, everything else as open", () => {
    expect(isOpenTournamentStatus("completed")).toBe(false);
    expect(isOpenTournamentStatus("archived")).toBe(false);
    expect(isOpenTournamentStatus("scheduled")).toBe(true);
    expect(isOpenTournamentStatus("running")).toBe(true);
    expect(isOpenTournamentStatus(null)).toBe(true);
  });
});

describe("calendarDateIn", () => {
  it("returns the calendar date of the zone, not UTC", () => {
    // 2026-09-04T22:30Z is already 2026-09-05 01:30 in Athens (UTC+3).
    const at = new Date("2026-09-04T22:30:00Z");
    expect(calendarDateIn("UTC", at)).toBe("2026-09-04");
    expect(calendarDateIn("Europe/Athens", at)).toBe("2026-09-05");
  });
});
