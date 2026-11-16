import { describe, expect, it } from "vitest";
import type { StatTuple } from "@/app/preview/paiktes-v2/model";
import type { DirectoryV3 } from "./data";
import { focusSeason, profileFor } from "./profile";

const t = (matches: number, goals: number): StatTuple => [matches, 0, goals, 0, 0, 0, 0, 0, 0];

const data: DirectoryV3 = {
  seasonLabel: "2025/26",
  teams: [
    { id: 1, name: "Άλφα", logo: "/a.png" },
    { id: 2, name: "Βήτα", logo: null },
  ],
  tournaments: [
    { id: 10, name: "Πρωτάθλημα" },
    { id: 11, name: "Κύπελλο" },
    { id: 12, name: "Super Cup" },
  ],
  players: [
    {
      id: 100,
      first: "Νίκος",
      last: "Παππάς",
      photo: null,
      position: "",
      teamIds: [2, 1, 99],
      season: t(9, 7),
      byTournament: { 12: t(1, 1), 10: t(8, 6) },
    },
    { id: 101, first: "Γιώργος", last: "Λάμπρου", photo: null, position: "", teamIds: [1], season: t(5, 9), byTournament: {} },
    { id: 102, first: "Κώστας", last: "Ζήσης", photo: null, position: "", teamIds: [1], season: null, byTournament: {} },
  ],
  extras: {
    100: {
      age: 31,
      heightCm: null,
      history: [],
      teams: [
        { teamId: 2, stats: t(6, 5) },
        { teamId: 7, stats: t(3, 2) },
      ],
    },
  },
  extraTeams: [{ id: 7, name: "Παλιά ομάδα", logo: "/old.png" }],
};

describe("profileFor", () => {
  it("is null for a player who is not in the directory", () => {
    expect(profileFor(data, 999)).toBeNull();
  });

  it("keeps the player's team order and drops teams the directory does not list", () => {
    const p = profileFor(data, 100)!;
    expect(p.teams.map((team) => team.id)).toEqual([2, 1]);
  });

  it("names team lines, linking only teams still in the directory", () => {
    const p = profileFor(data, 100)!;
    expect(p.teamLines).toEqual([
      { key: "team-2", label: "Βήτα", href: "/OMADA/2", logo: null, stats: t(6, 5) },
      { key: "team-7", label: "Παλιά ομάδα", href: null, logo: "/old.png", stats: t(3, 2) },
    ]);
  });

  it("keeps only the tournaments the player has numbers in, in the directory's order", () => {
    const p = profileFor(data, 100)!;
    expect(p.tournaments.map((x) => x.id)).toEqual([10, 12]);
  });

  it("ranks the player among everyone in the directory", () => {
    const p = profileFor(data, 100)!;
    expect(p.standing?.players).toBe(3);
    expect(p.standing?.goals.rank).toBe(2);
    expect(p.standing?.goals.best).toBe(9);
  });

  it("works for a player with no extras and no appearances", () => {
    const p = profileFor(data, 102)!;
    expect(p.extra).toBeNull();
    expect(p.teamLines).toEqual([]);
    expect(p.tournaments).toEqual([]);
    expect(p.standing?.goals.rank).toBeNull();
    expect(p.seasonLabel).toBe("2025/26");
  });
});

describe("focusSeason", () => {
  const row = (label: string, matches: number) => ({ label, primaryTeamId: null, stats: t(matches, 0) });

  it("is the current season when the player has played in it (left mid-season)", () => {
    expect(focusSeason([row("2025-2026", 20), row("2026-2027", 3)], "2026-2027")).toBe("2026-2027");
  });

  it("is the last season played otherwise", () => {
    expect(focusSeason([row("2023-2024", 9), row("2025-2026", 14), row("2024-2025", 0)], "2026-2027")).toBe(
      "2025-2026",
    );
  });

  it("skips seasons with a row but no matches", () => {
    expect(focusSeason([row("2025-2026", 4), row("2026-2027", 0)], "2026-2027")).toBe("2025-2026");
  });

  it("falls back to the current season when the player never played", () => {
    expect(focusSeason([], "2026-2027")).toBe("2026-2027");
    expect(focusSeason([row("2025-2026", 0)], "2026-2027")).toBe("2026-2027");
  });
});
