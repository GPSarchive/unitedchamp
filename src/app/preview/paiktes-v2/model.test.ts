import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  foldText,
  loosen,
  matchesTokens,
  parseQuery,
  prepareDirectory,
  queryTokens,
  searchKeys,
  selectRows,
  serializeQuery,
  toLatin,
  type DirectoryData,
  type DirectoryPlayer,
  type DirectoryQuery,
  type StatTuple,
} from "./model";

const stats = (matches: number, wins: number, goals: number, assists = 0): StatTuple => [
  matches, wins, goals, assists, 0, 0, 0, 0, 0,
];

const player = (
  id: number,
  first: string,
  last: string,
  over: Partial<DirectoryPlayer> = {},
): DirectoryPlayer => ({
  id,
  first,
  last,
  photo: null,
  position: "",
  teamIds: [],
  season: null,
  byTournament: {},
  ...over,
});

const DATA: DirectoryData = {
  seasonLabel: "2026/27",
  teams: [
    { id: 1, name: "RAKOUN ZERO", logo: null },
    { id: 2, name: "Λόφος Αξιωματικών", logo: null },
  ],
  tournaments: [
    { id: 61, name: "ULTRA LEAGUE" },
    { id: 67, name: "Δεν έχει ξεκινήσει" },
  ],
  players: [
    player(1, "ADAM", "ABAZE", { teamIds: [1], season: stats(3, 2, 7, 1), position: "Επιθετικός" }),
    player(2, "ΓΙΑΝΝΗΣ", "BARTOC", { teamIds: [2], season: stats(5, 1, 7), position: "ΕΠΙΘΕΤΙΚΟΣ" }),
    player(3, "Αντώνης", "Χρήστου", {
      teamIds: [2, 1],
      season: stats(9, 9, 20, 4),
      byTournament: { 61: stats(4, 4, 2) },
      position: "Τερματοφύλακας",
    }),
    player(4, "Mohammed", "Dia", { teamIds: [1] }),
    player(5, "Δημήτρης", "Άγγελος", { season: stats(2, 0, 0, 3) }),
  ],
};

const directory = prepareDirectory(DATA);
const run = (over: Partial<DirectoryQuery>) => selectRows(directory, { ...DEFAULT_QUERY, ...over });
const ids = (over: Partial<DirectoryQuery>) => run(over).map((r) => r.entry.player.id);

describe("search folding", () => {
  it("ignores case, accents and final sigma", () => {
    expect(foldText("  ΓΙΆΝΝΗΣ  ")).toBe("γιαννησ");
    expect(foldText("Γιάννης")).toBe(foldText("γιαννης"));
    expect(foldText("Προϊόν")).toBe("προιον");
  });

  it("transliterates letter by letter", () => {
    expect(toLatin(foldText("Γιάννης"))).toBe("giannis");
    expect(toLatin(foldText("Χρήστου"))).toBe("christou");
    expect(toLatin(foldText("Αντώνης"))).toBe("antonis");
  });

  it("collapses greeklish spellings onto one key", () => {
    const key = searchKeys("Γιάννης").loose;
    expect(loosen("giannhs")).toBe(key);
    expect(loosen("gianis")).toBe(key);
    expect(loosen("xristou")).toBe(searchKeys("Χρήστου").loose);
    expect(loosen("dhmhtrhs")).toBe(searchKeys("Δημήτρης").loose);
  });

  it("matches while a name is still being typed, in either script", () => {
    const hay = searchKeys("Αντώνης Χρήστου");
    for (const typed of ["α", "αν", "αντ", "a", "an", "ant", "anto", "adonis", "antonhs"]) {
      expect(matchesTokens(hay, queryTokens(typed)), typed).toBe(true);
    }
    expect(matchesTokens(hay, queryTokens("γιαν"))).toBe(false);
  });
});

describe("selectRows — search", () => {
  it("finds a full name in either order", () => {
    expect(ids({ q: "ADAM ABAZE" })).toEqual([1]);
    expect(ids({ q: "abaze adam" })).toEqual([1]);
  });

  it("finds players by team name, including multi-word teams", () => {
    expect(ids({ q: "rakoun", sort: "name", dir: "asc" })).toEqual([3, 1, 4]);
    expect(ids({ q: "rakoun zero adam" })).toEqual([1]);
    expect(ids({ q: "λοφος" }).sort()).toEqual([2, 3]);
  });

  it("finds Greek names typed in Latin letters", () => {
    expect(ids({ q: "giannis" })).toEqual([2]);
    expect(ids({ q: "giannhs" })).toEqual([2]);
    expect(ids({ q: "antonis xristou" })).toEqual([3]);
    expect(ids({ q: "dimitris" })).toEqual([5]);
  });

  it("returns nothing when one word matches no one", () => {
    expect(ids({ q: "adam zzz" })).toEqual([]);
    expect(ids({ q: "adam nt" })).toEqual([]);
  });

  it("treats PostgREST-special characters as plain text", () => {
    expect(ids({ q: "a,b" })).toEqual([]);
    expect(ids({ q: "(adam)" })).toEqual([]);
  });
});

describe("selectRows — filters", () => {
  it("filters by team across all of a player's teams", () => {
    expect(ids({ teamId: 1, sort: "name", dir: "asc" })).toEqual([3, 1, 4]);
  });

  it("groups positions that differ only in case or accents", () => {
    expect(directory.positionOptions.map((o) => [o.value, o.count])).toEqual([
      ["επιθετικοσ", 2],
      ["τερματοφυλακασ", 1],
    ]);
    expect(ids({ position: "επιθετικοσ" }).sort()).toEqual([1, 2]);
  });

  it("offers only tournaments that have player lines", () => {
    expect(directory.tournamentOptions.map((t) => t.id)).toEqual([61]);
  });

  it("scopes players and numbers to the selected tournament", () => {
    const rows = run({ tournamentId: 61 });
    expect(rows.map((r) => r.entry.player.id)).toEqual([3]);
    expect(rows[0].stats[2]).toBe(2); // tournament goals, not the season's 20
  });
});

describe("selectRows — sort and rank", () => {
  it("ranks by the sorted stat, sharing a rank on ties and leaving zero unranked", () => {
    const rows = run({ sort: "goals" });
    expect(rows.map((r) => [r.entry.player.id, r.rank])).toEqual([
      [3, 1],
      [1, 2],
      [2, 2],
      [5, null],
      [4, null],
    ]);
  });

  it("keeps each player's rank when the direction is flipped", () => {
    const rows = run({ sort: "goals", dir: "asc" });
    expect(rows[rows.length - 1].rank).toBe(1);
    expect(rows[rows.length - 1].entry.player.id).toBe(3);
  });

  it("sorts names by surname with Greek collation and no rank", () => {
    const rows = run({ sort: "name", dir: "asc" });
    expect(rows.map((r) => r.entry.player.last)).toEqual(["Άγγελος", "Χρήστου", "ABAZE", "BARTOC", "Dia"]);
    expect(rows.every((r) => r.rank === null)).toBe(true);
  });
});

describe("URL state", () => {
  it("omits defaults", () => {
    expect(serializeQuery(DEFAULT_QUERY)).toBe("");
  });

  it("round-trips a full query", () => {
    const query: DirectoryQuery = {
      q: "Γιάννης",
      tournamentId: 61,
      teamId: 2,
      position: "επιθετικοσ",
      sort: "assists",
      dir: "asc",
    };
    expect(parseQuery(serializeQuery(query))).toEqual(query);
  });

  it("accepts the old /paiktes parameter names", () => {
    expect(parseQuery("?sort=alpha")).toMatchObject({ sort: "name", dir: "asc" });
    expect(parseQuery("?sort=tournament_goals&tournament_id=61")).toMatchObject({
      sort: "goals",
      dir: "desc",
      tournamentId: 61,
    });
    expect(parseQuery("?sort=bestgk")).toMatchObject({ sort: "best_gk" });
  });

  it("falls back to defaults on junk", () => {
    expect(parseQuery("?sort=nope&tournament_id=abc&team=-3&dir=sideways")).toEqual(DEFAULT_QUERY);
  });
});
