// app/dashboard/tournaments/TournamentCURD/submit/loadSnapshotClient.ts
"use client";
import { useTournamentStore } from "./tournamentStore";
import type { FullTournamentSnapshot } from "./tournamentStore";

export async function loadTournamentIntoStore(
  tournamentId: number,
  opts?: { signal?: AbortSignal }
) {
  // 1) Fetch fresh snapshot from the dynamic API route
  const res = await fetch(`/api/tournaments/${tournamentId}/snapshot`, {
    credentials: "include",
    cache: "no-store",            // <— ensure fresh reads in the editor
    headers: { Accept: "application/json" },
    signal: opts?.signal,
  });

  if (!res.ok) {
    let msg = "";
    try { msg = await res.text(); } catch {}
    throw new Error(`Failed to load snapshot: ${res.status} ${msg}`);
  }

  // 2) Parse & hydrate the store
  const snap: FullTournamentSnapshot = await res.json();
  useTournamentStore.getState().hydrateFromSnapshot(snap);

  return snap; // handy to inspect from callers if needed
}