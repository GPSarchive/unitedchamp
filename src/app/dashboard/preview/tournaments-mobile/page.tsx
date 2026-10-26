// src/app/dashboard/preview/tournaments-mobile/page.tsx
// Preview of the tournament editor with the phone layout (EditorLayoutProvider
// compact). Data loading is copied as-is from /dashboard/tournaments; only the
// wrapper and the layout flag differ. Same store and save path as the live editor.
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import TournamentWizard from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { getTournamentForEditAction } from "@/app/dashboard/tournaments/TournamentCURD/actions";
import { EditorLayoutProvider } from "@/app/dashboard/tournaments/TournamentCURD/editorLayout";

export const dynamic = "force-dynamic";

type SP = { tid?: string };

export default async function TournamentsMobilePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const tidParam = sp.tid ?? "";
  const selectedTid = tidParam ? Number(tidParam) : null;

  // Λίστα διοργανώσεων για το dropdown — μόνο η ενεργή σεζόν (contract Phase 5).
  // Παλαιότερες: /dashboard/seasons/[label] → "Editor" ανά διοργάνωση.
  const activeSeason = await getActiveSeasonCached();
  const { data: tournamentsList, error: tournamentsErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, slug, created_at")
    .eq("season", activeSeason?.label ?? NO_SEASON)
    .order("created_at", { ascending: false });

  if (tournamentsErr) {
    console.error("[preview/tournaments-mobile] tournaments error", tournamentsErr);
  }

  // Αν έχει επιλεγεί tid → φόρτωσε πλήρη δεδομένα επεξεργασίας
  let editorData:
    | {
        payload: any;
        teams: Array<{ id: number; seed?: number; groupsByStage?: Record<string, number | undefined> }>;
        draftMatches: any[];
        meta: { id: number; slug: string | null; updated_at: string; created_at: string };
      }
    | null = null;

  if (selectedTid && Number.isFinite(selectedTid)) {
    const res = await getTournamentForEditAction(selectedTid);
    if (res.ok) editorData = (res.data as any) ?? null;
    else console.error("[preview/tournaments-mobile] getTournamentForEditAction error", res.error);
  }

  // Μετατροπέας ομάδων για τον Wizard
  function toWizardTeams(
    src:
      | Array<{ id: number; seed?: number; groupsByStage?: Record<string, number | undefined> }>
      | null
      | undefined
  ) {
    return (src ?? []).map((t) => {
      const gbs = t.groupsByStage;
      let groupsByStage: Record<number, number | null> | undefined = undefined;
      if (gbs && typeof gbs === "object") {
        groupsByStage = Object.fromEntries(
          Object.entries(gbs).map(([k, v]) => [Number(k), v == null ? null : Number(v)])
        ) as Record<number, number | null>;
      }
      return { id: Number(t.id), seed: t.seed ?? null, groupsByStage };
    });
  }

  const wizardInitialTeams = editorData ? toWizardTeams(editorData.teams) : undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Διοργανώσεις</h2>
      </header>

      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Προεπισκόπηση διάταξης για κινητό. Ίδια δεδομένα και ίδια αποθήκευση με τις{" "}
        <a
          className="underline"
          href={selectedTid ? `/dashboard/tournaments?tid=${selectedTid}` : "/dashboard/tournaments"}
        >
          Διοργανώσεις
        </a>
        .
      </div>

      <p className="text-white/70">
        Επίλεξε υπάρχουσα διοργάνωση για επεξεργασία ή ξεκίνα μία καινούρια.
      </p>

      {/* Επιλογέας διοργάνωσης */}
      <form method="get" className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <label htmlFor="tid" className="sr-only">Επιλογή διοργάνωσης</label>
        <select
          id="tid"
          name="tid"
          defaultValue={selectedTid ?? ""}
          className="min-w-[16rem] px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white"
        >
          <option value="">➕ Νέα διοργάνωση…</option>
          {(tournamentsList ?? []).map((t) => {
            const created = t.created_at ? new Date(t.created_at).toLocaleString() : "—";
            return (
              <option key={t.id} value={t.id}>
                {t.name} {t.slug ? `(${t.slug})` : ""} — δημιουργία {created}
              </option>
            );
          })}
        </select>

        <button
          type="submit"
          className="px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800"
        >
          Φόρτωση
        </button>

        {selectedTid ? (
          <a
            href="/dashboard/preview/tournaments-mobile"
            className="px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800"
            title="Ξεκίνημα νέας διοργάνωσης"
          >
            Ξεκίνημα νέας
          </a>
        ) : null}
      </form>

      {/* Wizard */}
      {/* On phones the editor sits flat in the page padding; the card frame returns at sm. */}
      <div className="mt-2 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-black/70 sm:backdrop-blur-sm sm:p-6 sm:shadow-xl sm:shadow-black/40">
        <EditorLayoutProvider compact>
          {editorData ? (
            <TournamentWizard
              mode="edit"
              meta={editorData.meta}
              initialPayload={editorData.payload}
              initialTeams={wizardInitialTeams}
              initialDraftMatches={editorData.draftMatches}
            />
          ) : (
            <TournamentWizard mode="create" />
          )}
        </EditorLayoutProvider>
      </div>

      <p className="text-xs text-white/50">
        Συμβουλή: Μπορείς να αναγεννήσεις τα ζευγάρια από το κουμπί «Regenerate fixtures» χωρίς να χάσεις τα ήδη
        αποθηκευμένα IDs αγώνων.
      </p>
    </div>
  );
}
