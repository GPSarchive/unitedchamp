// Builder 2.0 edit route — data loading mirrors src/app/dashboard/tournaments/page.tsx
// (getTournamentForEditAction + team coercion), mounting BuilderShell instead.
import { Suspense } from "react";
import { getTournamentForEditAction } from "@/app/dashboard/tournaments/TournamentCURD/actions";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import BuilderShell from "../builder/BuilderShell";

export const dynamic = "force-dynamic";

export default async function TournamentBuilderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isFinite(tid)) throw new Error(`Invalid tournament id: ${id}`);

  const res = await getTournamentForEditAction(tid);
  if (!res.ok) throw new Error(res.error);

  const { payload, teams, draftMatches, meta } = res.data as any;

  // Coerce TeamDraftServer -> TeamDraft (string index -> number, undefined -> null)
  const clientTeams: TeamDraft[] = (teams ?? []).map((t: any): TeamDraft => {
    const gbs = t.groupsByStage;
    let groupsByStage: Record<number, number | null> | undefined = undefined;
    if (gbs && typeof gbs === "object") {
      groupsByStage = Object.fromEntries(
        Object.entries(gbs).map(([k, v]) => [Number(k), v == null ? null : Number(v)])
      ) as Record<number, number | null>;
    }
    return { id: Number(t.id), seed: t.seed ?? null, groupsByStage };
  });

  return (
    <Suspense>
      <BuilderShell
        mode="edit"
        meta={meta}
        initialPayload={payload}
        initialTeams={clientTeams}
        initialDraftMatches={draftMatches ?? []}
      />
    </Suspense>
  );
}
