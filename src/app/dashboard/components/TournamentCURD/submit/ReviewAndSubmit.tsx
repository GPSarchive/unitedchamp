"use client";

import { useTransition, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";
import { createTournamentAction, updateTournamentAction } from "../actions";

export default function ReviewAndSubmit({
  mode = "create",
  meta,
  payload,
  teams,
  draftMatches,
  onBack,
}: {
  mode?: "create" | "edit";
  meta?: { id: number; slug: string | null; updated_at: string; created_at: string };
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onBack: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const fd = new FormData();
    // Safely stringify large objects
    fd.set("payload", JSON.stringify(payload ?? {}));
    fd.set("teams", JSON.stringify(teams ?? []));
    fd.set("draftMatches", JSON.stringify(draftMatches ?? []));

    start(async () => {
      try {
        let res: any;
        if (mode === "edit" && meta?.id) {
          fd.set("tournament_id", String(meta.id));
          res = await updateTournamentAction(fd);
        } else {
          res = await createTournamentAction(fd);
        }
        if (res && res.ok === false) setError(res.error || "Unknown error");
      } catch (e: any) {
        setError(e?.message || "Unexpected error");
      }
    });
  };

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-4 space-y-4">
      <h3 className="text-xl font-semibold text-cyan-200">Review</h3>
      <ul className="list-disc pl-5 text-sm text-white/85">
        <li>Name: {payload.tournament.name}</li>
        <li>Format: {payload.tournament.format}</li>
        <li>Stages: {payload.stages.length}</li>
        <li>Teams: {teams.length}</li>
        <li>Preview/Live matches in state: {draftMatches.length}</li>
      </ul>

      {error && <p className="text-rose-300">⚠ {error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-md border border-white/10 bg-slate-900/40 text-white/90 hover:bg-cyan-500/5 hover:border-cyan-400/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          Back
        </button>
        <button
          onClick={submit}
          disabled={pending}
          aria-busy={pending}
          className="px-3 py-2 rounded-md border border-emerald-400/40 text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {pending ? (mode === "edit" ? "Saving…" : "Creating…") : (mode === "edit" ? "Save Changes" : "Create Tournament")}
        </button>
      </div>
    </div>
  );
}
