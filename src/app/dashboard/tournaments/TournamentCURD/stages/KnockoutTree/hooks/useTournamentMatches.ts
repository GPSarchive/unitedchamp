// app/components/DashboardPageComponents/TournamentCURD/stages/hooks/useTournamentMatches.ts
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());

export function useTournamentMatches(tournamentId: number) {
  const { data, isLoading, mutate } = useSWR(
    tournamentId ? `/api/tournaments/${tournamentId}/matches` : null,
    fetcher
  );

  const matches = data?.matches ?? [];

  // helper to finish a match, then refetch
  async function finishMatch(matchId: number, {
    team_a_score,
    team_b_score,
    winner_team_id,
  }: { team_a_score: number; team_b_score: number; winner_team_id: number }) {
    const res = await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "finished",
        team_a_score,
        team_b_score,
        winner_team_id,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || "Failed to finish match");
    }
    // progression has run server-side; pull fresh data
    await mutate();
  }

  return { matches, isLoading, refetch: mutate, finishMatch };
}
