// ===============================
// File: app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner/utils.ts
// ===============================
"use client";

import type { DraftMatch, TeamDraft } from "@/app/dashboard/components/TournamentCURD/TournamentWizard";

export function rowSignature(m: DraftMatch) {
  const parts = [
    m.stageIdx ?? "",
    // m.groupIdx — intentionally omitted
    m.matchday ?? "",
    m.round ?? "",
    m.bracket_pos ?? "",
    m.team_a_id ?? "",
    m.team_b_id ?? "",
    m.match_date ?? "",
  ];
  return parts.join("|");
}

export function pickLocalName(t: TeamDraft): string | null {
  return (t as any)?.name ? String((t as any).name) : null;
}

export function kindLabel(k?: string) {
  if (k === "groups") return "όμιλοι";
  if (k === "knockout") return "νοκ-άουτ";
  return k ?? "?";
}

export function initialStageIndex(payload: any, forced?: number | null) {
  if (typeof forced === "number") return forced;
  const nonKO = (payload.stages as any).findIndex((s: any) => s.kind !== "knockout");
  if (nonKO >= 0) return nonKO;
  return (payload.stages as any)[0] ? 0 : -1;
}

export function inferStatus(row: {
  status?: "scheduled" | "finished" | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
}): "scheduled" | "finished" {
  if (row?.status === "finished") return "finished";
  const scored =
    (typeof row.team_a_score === "number" && row.team_a_score >= 0) ||
    (typeof row.team_b_score === "number" && row.team_b_score >= 0);
  if (scored || row?.winner_team_id != null) return "finished";
  return "scheduled";
}

export function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso); // ISO assumed UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function localInputToISO(localStr?: string) {
  if (!localStr) return null;
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, yStr, moStr, dStr, hhStr, mmStr] = m;
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const utc = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0, 0));
  return utc.toISOString();
}