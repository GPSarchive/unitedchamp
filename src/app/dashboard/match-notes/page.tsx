// SERVER: private referee notes (Σημειώσεις διαιτητή), one per match, written
// from the stats editor on /matches/[id]. Each note is shown with enough match
// context (date, tournament, phase, teams, score, referee) to tell which match
// it is about.
//
// Auth: proxy.ts + dashboard/layout.tsx admit only admins to this path (it is
// not in the editor allow-list). The read uses the cookie-bound client, so the
// table's admin-only RLS (migrations/add-match-referee-notes.sql) applies too.
import Link from "next/link";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";
import { formatInstant, formatMatchDateTime } from "@/app/lib/datetime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type SP = { q?: string; tournament?: string; page?: string };

type TeamRef = { id: number; name: string } | null;

type NoteRow = {
  id: number;
  match_id: number;
  note: string;
  created_at: string;
  updated_at: string;
  updated_by_email: string | null;
  match: {
    id: number;
    match_date: string | null;
    status: string | null;
    team_a_score: number | null;
    team_b_score: number | null;
    penalty_a: number | null;
    penalty_b: number | null;
    referee: string | null;
    round: number | null;
    matchday: number | null;
    team_a: TeamRef;
    team_b: TeamRef;
    tournament: { id: number; name: string } | null;
    stage: { id: number; name: string } | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Προγραμματισμένος",
  finished: "Ολοκληρώθηκε",
  postponed: "Αναβλήθηκε",
};

export default async function MatchNotesPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim().slice(0, 200);
  const tournamentId = Number(sp.tournament) || null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createSupabaseRSCClient();

  // `!inner` lets the tournament filter apply to the joined match row.
  let query = supabase
    .from("match_referee_notes")
    .select(
      `
      id, match_id, note, created_at, updated_at, updated_by_email,
      match:match_id!inner (
        id, match_date, status, team_a_score, team_b_score, penalty_a, penalty_b,
        referee, round, matchday, tournament_id,
        team_a:team_a_id (id, name),
        team_b:team_b_id (id, name),
        tournament:tournament_id (id, name),
        stage:stage_id (id, name)
      )
    `,
      { count: "exact" }
    )
    .order("updated_at", { ascending: false });

  if (q) query = query.ilike("note", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  if (tournamentId) query = query.eq("match.tournament_id", tournamentId);

  const start = (page - 1) * PAGE_SIZE;
  const [{ data, count, error }, { data: tournaments }] = await Promise.all([
    query.range(start, start + PAGE_SIZE - 1),
    supabase.from("tournaments").select("id, name").order("id", { ascending: false }),
  ]);

  const rows = (data ?? []) as unknown as NoteRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (over: { page?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tournamentId) p.set("tournament", String(tournamentId));
    if (over.page && over.page > 1) p.set("page", String(over.page));
    const qs = p.toString();
    return qs ? `/dashboard/match-notes?${qs}` : "/dashboard/match-notes";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-white">Σημειώσεις διαιτητή</h2>
        <p className="text-sm text-white/60">
          Ιδιωτικές σημειώσεις ανά αγώνα, ορατές μόνο στους διαχειριστές. Γράφονται και
          διορθώνονται από τον επεξεργαστή στατιστικών στη σελίδα κάθε αγώνα.
        </p>
      </header>

      <form method="get" className="rounded-2xl border border-white/10 bg-black/40 p-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Αναζήτηση στο κείμενο
          <input name="q" defaultValue={q} placeholder="π.χ. κάρτα, καθυστέρηση"
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15 placeholder:text-white/40" />
        </label>
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Διοργάνωση
          <select name="tournament" defaultValue={tournamentId ? String(tournamentId) : ""}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15">
            <option value="">Όλες</option>
            {(tournaments ?? []).map((t: { id: number; name: string }) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit"
            className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800">
            Φίλτρο
          </button>
          <Link href="/dashboard/match-notes"
            className="px-3 py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
            Καθαρισμός
          </Link>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Σφάλμα φόρτωσης: {error.message}
          {/relation .* does not exist|match_referee_notes/i.test(error.message) && (
            <> — τρέξε πρώτα το <code>migrations/add-match-referee-notes.sql</code> στο Supabase.</>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 text-sm text-white/60">
          {q || tournamentId ? "Καμία σημείωση με αυτά τα φίλτρα." : "Δεν υπάρχουν σημειώσεις ακόμη."}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const m = r.match;
            const hasScore = m?.team_a_score != null && m?.team_b_score != null;
            const pens = m?.penalty_a != null && m?.penalty_b != null ? ` (πέν. ${m.penalty_a}–${m.penalty_b})` : "";
            const phase = [
              m?.stage?.name,
              m?.round != null ? `Γύρος ${m.round}` : null,
              m?.matchday != null ? `Αγωνιστική ${m.matchday}` : null,
            ].filter(Boolean).join(" · ");
            const edited = r.updated_at !== r.created_at;
            return (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-white/50">
                      {m?.tournament?.name ?? "—"}
                      {phase ? ` · ${phase}` : ""}
                    </div>
                    <div className="mt-0.5 text-base font-semibold text-white">
                      {m?.team_a?.name ?? "TBD"}
                      <span className="mx-2 text-white/70">
                        {hasScore ? `${m!.team_a_score} – ${m!.team_b_score}${pens}` : "vs"}
                      </span>
                      {m?.team_b?.name ?? "TBD"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                      <span>{m?.match_date ? formatMatchDateTime(m.match_date, { day: "2-digit", month: "short", year: "numeric" }) : "Χωρίς ημερομηνία"}</span>
                      {m?.status && <span>{STATUS_LABELS[m.status] ?? m.status}</span>}
                      {m?.referee && <span>Διαιτητής · {m.referee}</span>}
                      <span className="text-white/40">#{r.match_id}</span>
                    </div>
                  </div>
                  <Link href={`/matches/${r.match_id}`}
                    className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 hover:text-white">
                    Άνοιγμα αγώνα →
                  </Link>
                </div>

                <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white/90">
                  {r.note}
                </p>

                <div className="mt-2 text-[11px] text-white/40">
                  {edited ? "Τελευταία αλλαγή" : "Καταχωρήθηκε"} {formatInstant(r.updated_at)}
                  {r.updated_by_email ? ` · ${r.updated_by_email}` : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm text-white/70">
          <span>Σελίδα {page} από {pages} · {total} σημειώσεις</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={link({ page: page - 1 })} className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">← Προηγούμενη</Link>
            )}
            {page < pages && (
              <Link href={link({ page: page + 1 })} className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">Επόμενη →</Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
