import { describe, expect, it } from "vitest";
import { foldName, matchScore, numericQuery, rankPlayers, tokenize } from "../playerSearch";

const P = (id: number, first_name: string, last_name: string, player_number: number | null = null) => ({
  id,
  first_name,
  last_name,
  player_number,
});

const roster = [
  P(1, "Γιάννης", "Παπαδόπουλος", 10),
  P(2, "Γιώργος", "Παπαδάκης", 7),
  P(3, "Νίκος", "Γιαννόπουλος", 10),
  P(4, "Ηλίας", "Μαΐδης"),
  P(5, "John", "Smith", 12),
];

describe("foldName", () => {
  it("strips tonos, dialytika and case, and normalises final sigma", () => {
    expect(foldName("Γιάννης")).toBe("γιαννησ");
    expect(foldName("ΜΑΪΔΗΣ")).toBe("μαιδησ");
    expect(foldName("  Παπα   Δόπουλος ")).toBe("παπα δοπουλοσ");
  });
});

describe("tokenize / numericQuery", () => {
  it("splits on whitespace after folding", () => {
    expect(tokenize(" Γιάν  Παπ ")).toEqual(["γιαν", "παπ"]);
  });
  it("reads '#12' and '12' as numbers, nothing else", () => {
    expect(numericQuery("#12")).toBe(12);
    expect(numericQuery("12")).toBe(12);
    expect(numericQuery("12a")).toBeNull();
    expect(numericQuery("")).toBeNull();
  });
});

describe("matchScore", () => {
  it("scores ordered prefix < any-order word prefix < substring < miss", () => {
    const p = roster[0];
    expect(matchScore(p, ["γιαν", "παπ"])).toBe(0);
    expect(matchScore(p, ["παπ", "γιαν"])).toBe(0); // last-name-first also 0
    expect(matchScore(p, ["παπ", "νησ"])).toBe(2); // "νησ" is not a word prefix
    expect(matchScore(p, ["δοπ"])).toBe(2);
    expect(matchScore(p, ["ξ"])).toBeNull();
    expect(matchScore(p, [])).toBeNull();
    // Two-word first name: tokens must be consecutive words for score 0.
    const dbl = P(9, "Μαρία Ελένη", "Κώστα");
    expect(matchScore(dbl, ["ελ", "κω"])).toBe(0);
    expect(matchScore(dbl, ["μαρ", "κω"])).toBe(1);
  });
});

describe("rankPlayers", () => {
  it("is accent- and case-insensitive and accepts either word order", () => {
    expect(rankPlayers(roster, "γιαννησ παπαδοπ").map((p) => p.id)).toEqual([1]);
    expect(rankPlayers(roster, "ΠΑΠΑΔΟΠΟΥΛΟΣ Γιάννης").map((p) => p.id)).toEqual([1]);
  });

  it("puts ordered-prefix hits before any-order hits, then sorts by name", () => {
    // "γιαν": Γιάννης Παπαδόπουλος (full starts with it) and Νίκος Γιαννόπουλος
    // (reversed "γιαννοπουλοσ νικοσ" also starts with it) both score 0.
    expect(rankPlayers(roster, "γιαν").map((p) => p.id)).toEqual([3, 1]);
    // "παπ γ": ordered full-name prefix only for nobody; both Παπα* players via word prefixes.
    expect(rankPlayers(roster, "παπ γ").map((p) => p.id)).toEqual([2, 1]);
  });

  it("matches shirt number or id on a numeric query, id hits first", () => {
    // nobody has id 10; two players wear 10 → name order
    expect(rankPlayers(roster, "10").map((p) => p.id)).toEqual([3, 1]);
    // id 7 is nobody, number 7 is Παπαδάκης
    expect(rankPlayers(roster, "#7").map((p) => p.id)).toEqual([2]);
    // id 1 first, then nobody wears 1
    expect(rankPlayers(roster, "1").map((p) => p.id)).toEqual([1]);
  });

  it("returns nothing for an empty query and honours the limit", () => {
    expect(rankPlayers(roster, "   ")).toEqual([]);
    expect(rankPlayers(roster, "π", 1)).toHaveLength(1);
  });
});
