"use client";

// Line-for-line port of the state logic in
// src/app/dashboard/tournaments/TournamentCURD/TournamentWizard.tsx.
// Any deviation here changes what saveAll() sends — keep in sync with that file.

import { useEffect, useMemo, useRef, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  TeamDraft,
  DraftMatch,
  WizardMode,
  WizardMeta,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { loadTournamentIntoStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/loadSnapshotClient";

const empty: NewTournamentPayload = {
  tournament: {
    name: "",
    slug: null,
    logo: null,
    season: null,
    status: "scheduled",
    format: "mixed",
    start_date: null,
    end_date: null,
    winner_team_id: null,
  },
  stages: [],
  tournament_team_ids: [],
};

export function useBuilderState({
  mode = "create",
  meta = null,
  initialPayload = null,
  initialTeams = [],
  initialDraftMatches = [],
}: {
  mode?: WizardMode;
  meta?: WizardMeta | null;
  initialPayload?: NewTournamentPayload | null;
  initialTeams?: TeamDraft[];
  initialDraftMatches?: DraftMatch[];
}) {
  const [payload, setPayload] = useState<NewTournamentPayload>(initialPayload ?? empty);
  const [teams, setTeams] = useState<TeamDraft[]>(initialTeams ?? []);

  const prevStagesRef = useRef<Array<any>>(payload.stages ?? []);

  const storeDraftMatches = useTournamentStore((s) => s.draftMatches);
  const seedFromWizard = useTournamentStore((s) => s.seedFromWizard);

  const upsertStage = useTournamentStore((s) => s.upsertStage);
  const removeStage = useTournamentStore((s) => s.removeStage);
  const upsertGroup = useTournamentStore((s) => s.upsertGroup);
  const removeGroup = useTournamentStore((s) => s.removeGroup);
  const setTournamentTeamIdsFromPicker = useTournamentStore(
    (s) => s.setTournamentTeamIdsFromPicker
  );

  // hydrate the store once from incoming props (skip in edit mode — snapshot load handles it)
  useEffect(() => {
    if (mode === "edit") return;
    seedFromWizard(payload, teams, initialDraftMatches ?? []);
    useTournamentStore.setState({ payload });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // keep store payload in sync if user edits basics/stages here
  useEffect(() => {
    useTournamentStore.setState({ payload });
  }, [payload]);

  // EDIT MODE: load full snapshot (standings, maps, etc.) into the store
  useEffect(() => {
    if (mode !== "edit" || !meta?.id) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        await loadTournamentIntoStore(meta.id, { signal: ctrl.signal });
      } catch (err) {
        console.error("[BuilderShell] snapshot load failed:", err);
      }
    })();
    return () => ctrl.abort();
  }, [mode, meta?.id]);

  // team-to-group assignment (per-stage)
  const handleTeamGroupChange = (teamId: number, stageIdx: number, groupIdx: number | null) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              groupsByStage: {
                ...(t.groupsByStage ?? {}),
                [stageIdx]: groupIdx,
              },
            }
          : t
      )
    );
  };

  // advisory validation (does not block saving)
  const errors = useMemo(() => {
    const out: string[] = [];
    if (!payload.tournament.name || !payload.tournament.name.trim()) {
      out.push("Συμπλήρωσε όνομα διοργάνωσης.");
    }
    if (teams.length < 2) {
      out.push("Πρόσθεσε τουλάχιστον 2 ομάδες.");
    }
    if (payload.stages.length === 0) {
      out.push("Χρειάζεσαι τουλάχιστον 1 στάδιο.");
    }
    payload.stages.forEach((s, i) => {
      if (s.kind === "groups") {
        const names = (s.groups ?? []).map((g: any) => String(g.name || "").trim()).filter(Boolean);
        if (names.length === 0) {
          out.push(`Το στάδιο «${s.name || `#${i + 1}`}» χρειάζεται τουλάχιστον 1 όμιλο.`);
        }
      }
    });
    return out;
  }, [payload.tournament.name, payload.stages, teams.length]);

  // apply Stage & Group changes down into the store (best-effort diff)
  const syncStagesIntoStore = (prevStages: any[], nextStages: any[]) => {
    nextStages.forEach((s, i) => {
      upsertStage(i, { name: s.name, kind: s.kind, config: s.config ?? null });
      const groups: any[] = Array.isArray(s.groups) ? s.groups : [];
      groups.forEach((g, gi) => {
        upsertGroup(i, gi, { name: g?.name ?? `Group ${gi + 1}`, ordering: gi });
      });

      const prevGroupCount = Array.isArray(prevStages[i]?.groups) ? prevStages[i].groups.length : 0;
      for (let gi = prevGroupCount - 1; gi >= groups.length; gi--) {
        removeGroup(i, gi);
      }
    });

    for (let si = prevStages.length - 1; si >= nextStages.length; si--) {
      removeStage(si);
    }
  };

  const onStagesChange = (nextStages: NewTournamentPayload["stages"]) => {
    const prevStages = prevStagesRef.current;
    setPayload((p) => ({ ...p, stages: nextStages }));
    syncStagesIntoStore(prevStages, nextStages);
    prevStagesRef.current = nextStages;
  };

  const onTeamsChange = (t: TeamDraft[]) => {
    setTeams(t);
    setPayload((p) => ({ ...p, tournament_team_ids: t.map((x) => x.id) }));
    if (mode === "edit") {
      setTournamentTeamIdsFromPicker(t.map((x) => x.id));
    }
  };

  return {
    payload,
    setPayload,
    teams,
    storeDraftMatches,
    errors,
    onStagesChange,
    onTeamsChange,
    handleTeamGroupChange,
  };
}
