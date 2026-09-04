import { describe, it, expect } from "vitest";
import { seasonMoveLabels, teamSeasonMismatches } from "../seasonChecks";

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
