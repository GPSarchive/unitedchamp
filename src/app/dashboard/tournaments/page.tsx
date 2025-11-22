//app/dashboard/tournaments/TournamentCURD/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import TournamentWizard from "./TournamentCURD/TournamentWizard";
import { getTournamentForEditAction } from "./TournamentCURD/actions";

export const dynamic = "force-dynamic";

type SP = { tid?: string };

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const tidParam = sp.tid ?? "";
  const selectedTid = tidParam ? Number(tidParam) : null;

  // Λίστα διοργανώσεων για το dropdown
  const { data: tournamentsList, error: tournamentsErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  if (tournamentsErr) {
    console.error("[tournaments/page] tournaments error", tournamentsErr);
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
    else console.error("[tournaments/page] getTournamentForEditAction error", res.error);
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
            const created = t.created_at ? new Date(t.created_at).toLocaleString('el-GR') : "—";
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
            href="/dashboard/tournaments"
            className="px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800"
            title="Ξεκίνημα νέας διοργάνωσης"
          >
            Ξεκίνημα νέας
          </a>
        ) : null}
      </form>

      {/* Wizard */}
      <div className="mt-2 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-sm p-4 sm:p-6 shadow-xl shadow-black/40">
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
      </div>

      <p className="text-xs text-white/50">
        Συμβουλή: Μπορείς να αναγεννήσεις τα ζευγάρια από το κουμπί «Regenerate fixtures» χωρίς να χάσεις τα ήδη
        αποθηκευμένα IDs αγώνων.
      </p>
    </div>
  );
}
