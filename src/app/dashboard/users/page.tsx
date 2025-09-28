// src/app/dashboard/users/page.tsx
import UsersTable from "./UsersTable";

export const dynamic = "force-dynamic";

type SP = { page?: string; q?: string };

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const q = (sp.q ?? "").trim();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Χρήστες</h2>
      </header>

      {/* Αναζήτηση */}
      <form method="get" className="flex flex-col sm:flex-row gap-2">
        <label className="sr-only" htmlFor="q">Αναζήτηση email</label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Αναζήτηση με email…"
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15 placeholder:text-white/50"
        />
        <input type="hidden" name="page" value="1" />
        <button
          type="submit"
          className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
        >
          Αναζήτηση
        </button>
      </form>

      {/* Πίνακας χρηστών */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
        <UsersTable page={page} perPage={50} q={q} />
      </div>

      <p className="text-xs text-white/50">
        Συμβουλή: Χρησιμοποίησε το πεδίο αναζήτησης για γρήγορο φιλτράρισμα με βάση το email.
      </p>
    </div>
  );
}
