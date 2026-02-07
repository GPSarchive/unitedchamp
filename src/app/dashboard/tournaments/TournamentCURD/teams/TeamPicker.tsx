// app/dashboard/tournaments/TournamentCURD/teams/TeamPicker.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TeamDraft } from "../TournamentWizard";

// --- tiny helpers (local so we don't couple to Dashboard helpers) ---
async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}
const isSelected = (selected: TeamDraft[], id: number) =>
  selected.some((t) => t.id === id);

// Lightweight row used by the picker (not the full DB TeamRow)
type CatalogRow = {
  id: number;
  name: string;
  logo?: string | null;
  deleted_at?: string | null;
};

export default function TeamPicker({
  teams,
  onChange,
}: {
  teams: TeamDraft[];
  onChange: (next: TeamDraft[]) => void;
}) {
  // ---- catalog state (auto-loaded) ----
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ Use relative URL for deployment safety (client-side component)
      const params = new URLSearchParams({ sign: "1" });
      if (showArchived) params.set("include", "all");
      const res = await fetch(`/api/teams?${params.toString()}`, {
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      // Be liberal about shape & types and coerce IDs to numbers
      const arr: Array<any> = body?.teams ?? body?.data ?? body ?? [];
      const rows: CatalogRow[] = arr
        .map((t: any) => ({
          id: Number(t.id),
          name: String(t.name ?? t.team_name ?? t.title ?? `Team #${t.id}`),
          logo: t.logo ?? null,
          deleted_at: t.deleted_at ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setCatalog(rows);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fast id → team lookup
  const byId = useMemo(() => {
    const m = new Map<number, CatalogRow>();
    for (const t of catalog) m.set(t.id, t);
    return m;
  }, [catalog]);

  // ---- filtering ----
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = catalog.filter((t) => (showArchived ? true : !t.deleted_at));
    if (!term) return list;
    return list.filter(
      (t) => t.name.toLowerCase().includes(term) || String(t.id).includes(term)
    );
  }, [catalog, q, showArchived]);

  // ---- selection ops (store name/logo too) ----
  const addOne = (id: number) => {
    if (isSelected(teams, id)) return;
    const src = byId.get(id);
    const entry: TeamDraft = {
      id,
      seed: undefined,
      groupsByStage: {},
      // extra metadata for UI downstream:
      name: src?.name ?? `Team #${id}`,
      logo: src?.logo ?? null,
    };
    onChange([...teams, entry]);
  };

  const removeOne = (id: number) => {
    onChange(teams.filter((t) => t.id !== id));
  };

  const toggleOne = (id: number) => {
    isSelected(teams, id) ? removeOne(id) : addOne(id);
  };

  const addAllFiltered = () => {
    const existing = new Set(teams.map((t) => t.id));
    const toAdd: TeamDraft[] = filtered
      .filter((t) => !existing.has(t.id))
      .map((t) => ({
        id: t.id,
        seed: undefined,
        groupsByStage: {},
        name: t.name ?? `Team #${t.id}`,
        logo: t.logo ?? null,
      }));
    if (toAdd.length) onChange([...teams, ...toAdd]);
  };

  const clearAll = () => onChange([]);

  // bulk-add by ids (also try to attach metadata)
  const [bulk, setBulk] = useState("");
  const bulkAdd = () => {
    const ids = bulk
      .split(/[,\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const existing = new Set(teams.map((t) => t.id));
    const next: TeamDraft[] = [...teams];
    ids.forEach((id) => {
      if (existing.has(id)) return;
      const src = byId.get(id);
      next.push({
        id,
        seed: undefined,
        groupsByStage: {},
        name: src?.name ?? `Team #${id}`,
        logo: src?.logo ?? null,
      });
    });
    onChange(next);
    setBulk("");
  };

  // ------------------------------
  // Ensure selected teams carry name/logo:
  // Rehydrate missing metadata from catalog once it's available.
  // ------------------------------
  useEffect(() => {
    if (teams.length === 0 || catalog.length === 0) return;

    let changed = false;
    const next = teams.map((t) => {
      const hasName = typeof t.name === "string" && t.name.length > 0;
      const hasLogo = t.logo !== undefined; // allow null as a valid "known" value
      if (hasName && hasLogo) return t;

      const src = byId.get(t.id);
      if (!src) return t;

      const enriched: TeamDraft = {
        ...t,
        name: hasName ? t.name : src.name ?? `Team #${t.id}`,
        logo: hasLogo ? t.logo! : src.logo ?? null,
      };
      if (enriched.name !== t.name || enriched.logo !== t.logo) changed = true;
      return enriched;
    });

    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, byId, teams]); // guarded by "changed" flag to avoid loops

  // ---- UI (aurora theme, consistent with your palette) ----
  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-cyan-200">Teams</h3>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-white/10 bg-slate-900/40 text-white/90">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span className="text-sm">Show archived</span>
          </label>
          <button
            onClick={load}
            className="px-2.5 py-1.5 rounded-md border border-white/10 bg-slate-900/40 text-white/90 hover:bg-cyan-500/5 hover:border-cyan-400/30 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search + bulk add */}
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="md:col-span-2 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Search by name or #id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            placeholder="Bulk IDs (comma/space)"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button
            onClick={bulkAdd}
            className="px-3 py-2 rounded-md border border-emerald-400/40 text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={addAllFiltered}
          className="px-3 py-1.5 rounded-md border border-emerald-400/40 text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 transition-colors"
        >
          Select all (filtered)
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 rounded-md border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 transition-colors"
        >
          Clear selected
        </button>
        <div className="ml-auto text-sm text-white/70">
          Selected: <span className="text-white">{teams.length}</span> / Available:{" "}
          <span className="text-white">
            {filtered.length}
            {loading ? "…" : ""}
          </span>
        </div>
      </div>

      {/* Two columns: available list (left) and selected list (right) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-cyan-400/15 bg-black/30">
          <div className="px-3 py-2 text-cyan-200/90 border-b border-cyan-400/10">Available</div>
          {loading ? (
            <div className="p-3 text-white/70">Loading…</div>
          ) : error ? (
            <div className="p-3 text-rose-300">Error: {error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-white/70">No teams found.</div>
          ) : (
            <ul className="max-h-72 overflow-auto divide-y divide-white/5">
              {filtered.map((t) => {
                const selected = isSelected(teams, t.id);
                const archived = !!t.deleted_at;
                return (
                  <li key={t.id} className="px-3 py-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.logo ?? ""} alt={t.name}
                      className="h-7 w-7 rounded-full object-contain ring-1 ring-white/10 bg-white/5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-white/90">
                        {t.name} <span className="text-white/40 text-xs">#{t.id}</span>
                      </div>
                      {archived && (
                        <div className="text-xs text-amber-300/80">Archived</div>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOne(t.id)}
                      />
                      <span>{selected ? "Selected" : "Select"}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-cyan-400/15 bg-black/30">
          <div className="px-3 py-2 text-cyan-200/90 border-b border-cyan-400/10">Selected</div>
          {teams.length === 0 ? (
            <div className="p-3 text-white/70">Nothing selected yet.</div>
          ) : (
            <ul className="max-h-72 overflow-auto divide-y divide-white/5">
              {teams.map((t) => {
                // prefer stored metadata; fallback to catalog
                const name = (t as any).name ?? byId.get(t.id)?.name ?? `#${t.id}`;
                const logo = (t as any).logo ?? byId.get(t.id)?.logo ?? "";
                return (
                  <li key={t.id} className="px-3 py-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo} alt={name}
                      className="h-7 w-7 rounded-full object-contain ring-1 ring-white/10 bg-white/5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-white/90">
                        {name} <span className="text-white/40 text-xs">#{t.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeOne(t.id)}
                      className="px-2 py-1 rounded-md border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 text-xs"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
