// app/dashboard/tournaments/TournamentCURD/util/groupsSignature.ts
export function computeGroupsSignature(groups: Array<{ name: string }>): string {
  // normalize names (trim/lower) and keep order
  const norm = groups.map(g => (g?.name ?? "").trim().toLowerCase());
  return `v1:${norm.length}:${norm.join("|")}`;
}
