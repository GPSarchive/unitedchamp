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

  const fieldCls =
    "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white placeholder-white/30 " +
    "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400/30 transition";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-indigo-950/60 p-5 sm:p-6 shadow-2xl space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-400/20 text-violet-200 text-sm font-medium">
            {teams.length} selected
          </div>
          <span className="text-sm text-white/40">
            {filtered.length} available{loading ? "..." : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/70 text-sm cursor-pointer hover:bg-white/[0.06] transition">
            <input
              type="checkbox"
              className="accent-violet-500"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.08] transition text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search + bulk add */}
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className={fieldCls + " md:col-span-2"}
          placeholder="Search by name or #id..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className={fieldCls + " flex-1"}
            placeholder="Bulk IDs (1, 2, 3)"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button
            onClick={bulkAdd}
            className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 transition"
          >
            Add
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={addAllFiltered}
          className="px-3 py-1.5 rounded-lg border border-emerald-400/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-sm transition"
        >
          Select all filtered
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 rounded-lg border border-rose-400/20 text-rose-300 hover:bg-rose-500/10 text-sm transition"
        >
          Clear all
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Available */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
          <div className="px-4 py-2.5 text-sm font-medium text-white/70 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <span>Available Teams</span>
            <span className="text-xs text-white/30">{filtered.length}</span>
          </div>
          {loading ? (
            <div className="p-4 text-white/40 text-sm">Loading teams...</div>
          ) : error ? (
            <div className="p-4 text-rose-300 text-sm">Error: {error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-white/40 text-sm">No teams match your search.</div>
          ) : (
            <ul className="max-h-80 overflow-auto divide-y divide-white/[0.04]">
              {filtered.map((t) => {
                const selected = isSelected(teams, t.id);
                const archived = !!t.deleted_at;
                return (
                  <li key={t.id} className={`px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.03] transition ${selected ? "bg-violet-500/5" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.logo ?? ""} alt={t.name}
                      className="h-8 w-8 rounded-lg object-contain ring-1 ring-white/[0.08] bg-white/[0.04]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-white/90 text-sm">
                        {t.name} <span className="text-white/30 text-xs">#{t.id}</span>
                      </div>
                      {archived && (
                        <div className="text-[11px] text-amber-400/70">Archived</div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleOne(t.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        selected
                          ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                          : "bg-white/[0.05] text-white/50 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white/80"
                      }`}
                    >
                      {selected ? "Added" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Selected */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
          <div className="px-4 py-2.5 text-sm font-medium text-white/70 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <span>Selected Teams</span>
            <span className="text-xs text-white/30">{teams.length}</span>
          </div>
          {teams.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-white/20 text-sm">No teams selected</div>
              <div className="text-white/10 text-xs mt-1">Select teams from the list on the left</div>
            </div>
          ) : (
            <ul className="max-h-80 overflow-auto divide-y divide-white/[0.04]">
              {teams.map((t) => {
                const name = (t as any).name ?? byId.get(t.id)?.name ?? `#${t.id}`;
                const logo = (t as any).logo ?? byId.get(t.id)?.logo ?? "";
                return (
                  <li key={t.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.03] transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo} alt={name}
                      className="h-8 w-8 rounded-lg object-contain ring-1 ring-white/[0.08] bg-white/[0.04]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-white/90 text-sm">
                        {name} <span className="text-white/30 text-xs">#{t.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeOne(t.id)}
                      className="px-2 py-1 rounded-lg border border-rose-400/20 text-rose-300/80 hover:bg-rose-500/10 text-xs transition"
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
