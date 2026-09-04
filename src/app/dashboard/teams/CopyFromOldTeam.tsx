"use client";

// "Δημιουργία από παλιά ομάδα": a new team row for the ACTIVE season, seeded
// from a team of an earlier season (name, colour, logo) and linked to it via
// teams.copied_from_team_id (contract D1 lineage). Nothing is moved: the old
// row stays in its season's archive.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Search, X } from "lucide-react";

export type OldTeamSource = {
  id: number;
  name: string;
  season_label: string | null;
  colour: string | null;
  logo: string | null;
  deleted: boolean;
};

export default function CopyFromOldTeam({
  sources,
  activeSeason,
}: {
  sources: OldTeamSource[];
  activeSeason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sources;
    return sources.filter((s) => s.name.toLowerCase().includes(term));
  }, [sources, q]);

  async function create(src: OldTeamSource) {
    setBusyId(src.id);
    setNotice(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: src.name, colour: src.colour, copied_from_team_id: src.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setNotice({ ok: true, text: `Δημιουργήθηκε η «${src.name}» για τη σεζόν ${activeSeason ?? ""}.` });
      router.refresh();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? String(e) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={!activeSeason}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white/85 hover:bg-zinc-800 disabled:opacity-50"
        >
          <Copy className="h-4 w-4" />
          Δημιουργία από παλιά ομάδα
          <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-white/60">{sources.length}</span>
        </button>
        {!activeSeason && <span className="text-xs text-red-300">Δεν υπάρχει ενεργή σεζόν.</span>}
      </div>

      {notice && (
        <p
          className={`rounded-lg border p-2 text-sm ${
            notice.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/40 bg-red-500/10 text-red-100"
          }`}
        >
          {notice.text}
        </p>
      )}

      {open && (
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Αναζήτηση παλιάς ομάδας"
                className="w-full rounded-lg border border-white/15 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40"
              />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-zinc-900 text-white/70"
              aria-label="Κλείσιμο"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-2 max-h-80 divide-y divide-white/5 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-2 py-4 text-sm text-white/45">Καμία ομάδα.</li>
            )}
            {filtered.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-2 py-2">
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo} alt="" className="h-8 w-8 rounded object-contain" />
                ) : (
                  <span className="h-8 w-8 rounded border border-white/10" style={{ background: s.colour ?? undefined }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{s.name}</div>
                  <div className="text-xs text-white/45">
                    σεζόν {s.season_label ?? "—"} · #{s.id}
                    {s.deleted ? " · αποχώρησε" : ""}
                  </div>
                </div>
                <button
                  disabled={busyId != null}
                  onClick={() => create(s)}
                  className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busyId === s.id ? "…" : "Δημιουργία"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
