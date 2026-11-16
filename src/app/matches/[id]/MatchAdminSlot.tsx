// The staff's part of the match page: postpone / new date, the stats editor
// with its «Save all» form, and the match video. Rendered by page.tsx only for
// admins and editors (canEditContent), under the public content.
//
// Moved here unchanged from the previous match page (the one built on
// MatchV2Client): same queries, same components with the same props, same
// server actions, same order. The form's field names and ids are what
// StatsDraftAutosave's localStorage draft is keyed on — do not change them.
import {
  fetchMatch,
  fetchPlayersForTeam,
  fetchMatchStatsMap,
  fetchParticipantsMap,
  fetchLegOneScores,
} from "./queries";
import { saveAllStatsAction } from "./actions";
import StatsEditor, { MatchAwardsProvider } from "./StatsEditor";
import TwoLeggedPenaltyPanel from "./TwoLeggedPenaltyPanel";
import StatsDraftAutosave from "./StatsDraftAutosave";
import { JerseyTagsProvider } from "./JerseyTags";
import MatchVideoAdminForm from "./MatchVideoAdminForm";
import MatchAdminActions from "./MatchAdminActions";
import RefereeNoteField from "./RefereeNoteField";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";
import type { Id, PlayerAssociation } from "@/app/lib/types";

function errMsg(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as any;
  return anyE?.message || anyE?.error?.message || JSON.stringify(anyE);
}

export default async function MatchAdminSlot({
  matchId,
  saved,
}: {
  matchId: Id;
  /** The page was reached through saveAllStatsAction's redirect (?saved=1). */
  saved: boolean;
}) {
  const supabase = await createSupabaseRSCClient();
  // Referee notes: admins and editors (RLS too — see
  // migrations/editor-referee-notes-rls.sql). This slot is only rendered for
  // them, so the note is always read here.
  const canSeeRefereeNote = true;

  const match = await fetchMatch(matchId);
  if (!match) return null;

  const [aRes, bRes, statsRes, partsRes, noteRes] = await Promise.allSettled([
    fetchPlayersForTeam(match.team_a.id),
    fetchPlayersForTeam(match.team_b.id),
    fetchMatchStatsMap(match.id),
    fetchParticipantsMap(match.id),
    canSeeRefereeNote
      ? supabase
          .from("match_referee_notes")
          .select("note")
          .eq("match_id", match.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error;
            return (data?.note as string | undefined) ?? "";
          })
      : Promise.resolve(""),
  ]);

  const teamAPlayers: PlayerAssociation[] =
    aRes.status === "fulfilled" ? (aRes.value as PlayerAssociation[]) : [];
  const teamBPlayers: PlayerAssociation[] =
    bRes.status === "fulfilled" ? (bRes.value as PlayerAssociation[]) : [];
  const existingStats =
    statsRes.status === "fulfilled" ? statsRes.value : new Map();
  const participants =
    partsRes.status === "fulfilled" ? partsRes.value : new Map();

  // Detect players who appear on both rosters (admin warning).
  const teamAPlayerIds = new Set(teamAPlayers.map((p) => p.player.id));
  const teamBPlayerIds = new Set(teamBPlayers.map((p) => p.player.id));
  const duplicatePlayerIds = new Set<number>();
  for (const playerId of teamAPlayerIds) {
    if (teamBPlayerIds.has(playerId)) {
      duplicatePlayerIds.add(playerId);
    }
  }

  const dataLoadErrors: string[] = [];
  if (aRes.status === "rejected")
    dataLoadErrors.push(`Team A players: ${errMsg(aRes.reason)}`);
  if (bRes.status === "rejected")
    dataLoadErrors.push(`Team B players: ${errMsg(bRes.reason)}`);
  if (statsRes.status === "rejected")
    dataLoadErrors.push(`Match stats: ${errMsg(statsRes.reason)}`);
  if (partsRes.status === "rejected")
    dataLoadErrors.push(`Participants: ${errMsg(partsRes.reason)}`);
  if (noteRes.status === "rejected")
    dataLoadErrors.push(`Referee note: ${errMsg(noteRes.reason)}`);
  // When the note failed to load, leave the field out entirely: rendering it
  // empty would let the next Save all delete the stored note.
  const refereeNote = noteRes.status === "fulfilled" ? noteRes.value : null;

  // ----- KO context -----
  const isLeg2Decider = match.leg === 2 && match.tie_leg1_match_id != null;
  // Single-leg KO (or a leg-2 whose leg 1 was deleted): a level score is
  // decided on penalties, so the pens panel must render here too. Leg 1 of a
  // tie is excluded — it may end level with no shootout.
  const isSingleLegKo = !!match.is_ko && !isLeg2Decider && match.leg !== 1;
  const leg1 = isLeg2Decider
    ? await fetchLegOneScores(match.tie_leg1_match_id as Id)
    : null;

  const scoreForTeam = (
    row: { team_a_id: number | null; team_b_id: number | null; team_a_score: number | null; team_b_score: number | null } | null,
    teamId: number | null,
  ) => {
    if (!row || teamId == null) return 0;
    if (row.team_a_id === teamId) return row.team_a_score ?? 0;
    if (row.team_b_id === teamId) return row.team_b_score ?? 0;
    return 0;
  };
  const leg1Ready = !!leg1 && leg1.team_a_score != null && leg1.team_b_score != null;

  // Leg-1 score mapped into leg-2's (team_a/team_b) orientation, for the live
  // penalty panel. Teams swap home/away between legs, so map by team id.
  const leg1AScore = leg1Ready ? scoreForTeam(leg1, match.team_a.id) : null;
  const leg1BScore = leg1Ready ? scoreForTeam(leg1, match.team_b.id) : null;

  // Penalty requirement + leg-win counting live in the client
  // <TwoLeggedPenaltyPanel>, which reacts to the goals the admin is currently
  // typing (the leg-2 score is recomputed from player stats on submit). The
  // server still enforces the rule in resolveKoFinishPatch.

  return (
    <>
      {dataLoadErrors.length > 0 && (
        <div className="border-2 border-[#E8B931]/50 bg-[#1a1605] p-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#E8B931]">
          <p className="font-semibold">Μερική φόρτωση δεδομένων</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[#E8B931]/85">
            {dataLoadErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Admin Actions (Postpone Match / set its new date) */}
      <MatchAdminActions
        match={{
          id: match.id,
          status: match.status,
          match_date: match.match_date,
          original_match_date: match.original_match_date ?? null,
          postponement_reason: match.postponement_reason ?? null,
          teamA: match.team_a,
          teamB: match.team_b,
        }}
      />

      <section className="rounded-2xl border border-white/20 bg-black/50 p-5 shadow-lg backdrop-blur-sm">
        <h2 className="mb-3 text-lg font-semibold text-white">
          Admin: Match Player Stats
        </h2>
        <p className="mb-4 text-xs text-white/70">
          Ενεργοποίησε <strong>Συμμετοχή</strong>, δήλωσε θέση/αρχηγό/GK και
          συμπλήρωσε στατιστικά. Πάτησε <strong>Save all</strong> για
          αποθήκευση.
        </p>
        <p className="-mt-3 mb-4 text-xs text-white/50">
          Το <strong>Νούμερο φανέλας</strong> είναι προσωρινό βοήθημα για να
          ξεχωρίζεις τους παίκτες — μένει μόνο σε αυτή τη συσκευή και δεν
          αποθηκεύεται. Οι αλλαγές κρατιούνται αυτόματα ως πρόχειρο μέχρι το{" "}
          <strong>Save all</strong>.
        </p>

        <form id="stats-form" action={saveAllStatsAction}>
          <input type="hidden" name="match_id" value={String(match.id)} />

          {duplicatePlayerIds.size > 0 && (
            <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
              <p className="font-semibold text-amber-200 text-sm">
                ⚠️ Προσοχή: {duplicatePlayerIds.size} παίκτης/παίκτες
                βρίσκονται και στις δύο ομάδες
              </p>
              <p className="mt-1 text-xs text-amber-200/80">
                Βεβαιωθείτε ότι επισημαίνετε κάθε παίκτη ως "συμμετοχή" μόνο
                σε ΜΙΑ ομάδα. Η επισήμανση παίκτη στις δύο ομάδες θα
                προκαλέσει σφάλμα.
              </p>
            </div>
          )}

          {/* Inputs autosave to localStorage until "Save all" (which
              finishes the match, so it can't double as a draft save). */}
          <JerseyTagsProvider matchId={match.id}>
            <StatsDraftAutosave matchId={match.id} justSaved={saved}>
              <MatchAwardsProvider
                initialMvpPlayerId={
                  [...existingStats.values()].find((s) => s.mvp)?.player_id ?? null
                }
                initialBestGkPlayerId={
                  [...existingStats.values()].find((s) => s.best_goalkeeper)?.player_id ?? null
                }
              >
                <div className="grid grid-cols-1 gap-6">
                  <StatsEditor
                    teamId={match.team_a.id}
                    teamName={match.team_a.name}
                    associations={teamAPlayers}
                    existing={existingStats}
                    participants={participants}
                    duplicatePlayerIds={duplicatePlayerIds}
                  />
                  <StatsEditor
                    teamId={match.team_b.id}
                    teamName={match.team_b.name}
                    associations={teamBPlayers}
                    existing={existingStats}
                    participants={participants}
                    duplicatePlayerIds={duplicatePlayerIds}
                  />
                </div>
              </MatchAwardsProvider>

              {(isLeg2Decider || isSingleLegKo) && (
                <TwoLeggedPenaltyPanel
                  mode={isLeg2Decider ? "decider" : "single"}
                  teamAId={match.team_a.id}
                  teamBId={match.team_b.id}
                  teamAName={match.team_a.name}
                  teamBName={match.team_b.name}
                  leg1AScore={leg1AScore}
                  leg1BScore={leg1BScore}
                  leg1Ready={leg1Ready}
                  savedPenaltyA={match.penalty_a ?? null}
                  savedPenaltyB={match.penalty_b ?? null}
                />
              )}
            </StatsDraftAutosave>
          </JerseyTagsProvider>

          {canSeeRefereeNote && refereeNote !== null && (
            <RefereeNoteField initialNote={refereeNote} />
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="submit"
              className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Save all
            </button>
          </div>
        </form>
      </section>

      {/* Admin: Match video CRUD, at the very bottom */}
      <MatchVideoAdminForm
        matchId={match.id}
        initialVideoUrl={match.video_url ?? null}
      />
    </>
  );
}
