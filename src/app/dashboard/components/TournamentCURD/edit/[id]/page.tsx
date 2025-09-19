// app/components/DashboardPageComponents/TournamentCURD/edit/[id]/page.tsx
import { getTournamentForEditAction } from '@/app/dashboard/components/TournamentCURD/actions';
import TournamentWizard from "@/app/dashboard/components/TournamentCURD/TournamentWizard";
import type { TeamDraft, DraftMatch } from "@/app/dashboard/components/TournamentCURD/TournamentWizard";

export default async function EditTournamentPage({
  params,
}: {
  // Next.js 15: params is a Promise
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await getTournamentForEditAction(Number(id));
  if (!res.ok) throw new Error(res.error);

  const { payload, teams, draftMatches, meta } = res.data;

  // Coerce TeamDraftServer -> TeamDraft (string index -> number, undefined -> null)
  const clientTeams: TeamDraft[] = teams.map((t): TeamDraft => ({
    id: t.id,
    seed: t.seed ?? undefined,
    groupsByStage: (Object.fromEntries(
      Object.entries(t.groupsByStage ?? {}).map(([k, v]) => [
        Number(k), v == null ? null : Number(v),
      ])
    ) as Record<number, number | null>),
  }));

  // Coerce DraftMatchServer -> DraftMatch (null outcomes -> undefined)
  const clientDraftMatches: DraftMatch[] = draftMatches.map((m) => ({
    stageIdx: m.stageIdx,
    groupIdx: m.groupIdx ?? null,
    bracket_pos: m.bracket_pos ?? null,
    matchday: m.matchday ?? null,
    match_date: m.match_date ?? null,
    team_a_id: m.team_a_id ?? null,
    team_b_id: m.team_b_id ?? null,
    round: m.round ?? null,
    home_source_match_idx: m.home_source_match_idx ?? null,
    away_source_match_idx: m.away_source_match_idx ?? null,
    home_source_outcome: m.home_source_outcome ?? undefined,
    away_source_outcome: m.away_source_outcome ?? undefined,
  }));

  return (
    <TournamentWizard
      mode="edit"
      initialPayload={payload}
      initialTeams={clientTeams}
      initialDraftMatches={clientDraftMatches}
      meta={meta}
    />
  );
}
