import type { Labels } from "@/app/lib/types";

export const EN_LABELS: Labels = {
  final: "Final",
  semifinals: "Semi-finals",
  quarterfinals: "Quarter-finals",
  roundOf: (n) => `Round of ${n}`,
  roundN: (r) => `Round ${r}`,
  bye: "BYE",
  tbd: "TBD",
  pair: (a, b) => `Pair${a || b ? `: #${a ?? "?"} vs #${b ?? "?"}` : ""}`,
  seedTaken: "Seed already used",
  pickTeam: "Pick team…",
  autoSeed: "Auto-seed",
  clearRound: "Clear first round",
  swap: "Swap",
};

export const EL_LABELS: Labels = {
  final: "Τελικός",
  semifinals: "Ημιτελικά",
  quarterfinals: "Προημιτελικά",
  roundOf: (n) => `Φάση των ${n}`,
  roundN: (r) => `Γύρος ${r}`,
  bye: "Πρόκριση",
  tbd: "Σε αναμονή",
  pair: (a, b) => `Ζευγάρι${a || b ? `: #${a ?? "?"} vs #${b ?? "?"}` : ""}`,
  seedTaken: "Ο αριθμός seed χρησιμοποιείται ήδη",
  pickTeam: "Επιλογή ομάδας…",
  autoSeed: "Αυτόματη κατάταξη",
  clearRound: "Καθαρισμός πρώτου γύρου",
  swap: "Αλλαγή θέσεων",
};

export function getLabels(lang: "en" | "el", overrides?: Partial<Labels>): Labels {
  const base = lang === "el" ? EL_LABELS : EN_LABELS;
  return { ...base, ...(overrides ?? {}) };
}
