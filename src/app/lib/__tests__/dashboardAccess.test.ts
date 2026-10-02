import { describe, expect, it } from "vitest";
import { editorMayOpen } from "../dashboardAccess";

describe("editorMayOpen", () => {
  it("lets editors open the home and the four editor sections", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/articles",
      "/dashboard/articles/new",
      "/dashboard/announcements/12/edit",
      "/dashboard/players",
      "/dashboard/teams/7",
    ]) {
      expect(editorMayOpen(p), p).toBe(true);
    }
  });

  it("refuses every other dashboard section", () => {
    for (const p of [
      "/dashboard/users",
      "/dashboard/matches",
      "/dashboard/tournaments",
      "/dashboard/seasons",
      "/dashboard/audit",
      "/dashboard/geniki-katataxi",
      "/dashboard/fix-stats",
      "/preview/tournament-builder",
    ]) {
      expect(editorMayOpen(p), p).toBe(false);
    }
  });

  it("matches whole path segments, not string prefixes", () => {
    expect(editorMayOpen("/dashboard/teamsX")).toBe(false);
    expect(editorMayOpen("/dashboard/players-import")).toBe(false);
  });
});
