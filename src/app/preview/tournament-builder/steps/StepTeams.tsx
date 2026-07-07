"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, RefreshCw, Search, X } from "lucide-react";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

import Button from "../ui/Button";
import { field as fieldCls, card } from "../ui/tokens";
import { useTeamCatalog, type CatalogRow } from "../hooks/useTeamCatalog";

const isSelected = (selected: TeamDraft[], id: number) => selected.some((t) => t.id === id);

function TeamLogo({ logo, name }: { logo?: string | null; name: string }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      className="h-9 w-9 shrink-0 rounded-full bg-zinc-800 object-contain ring-1 ring-white/10"
    />
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-500 ring-1 ring-white/10">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/**
 * Mobile-first team picker: two stacked lists —
 * 1) "Επιλεγμένες": teams already in the tournament (remove + seed), and
 * 2) the searchable catalog with tap-to-toggle rows.
 * Emits the same onChange(TeamDraft[]) contract as teams/TeamPicker.tsx;
 * removals are staged exactly like the live picker's Remove button (nothing
 * is persisted until Save).
 */
export default function StepTeams({
  teams,
  onChange,
}: {
  teams: TeamDraft[];
  onChange: (next: TeamDraft[]) => void;
}) {
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [includedOpen, setIncludedOpen] = useState(true);

  const { catalog, byId, loading, error, reload } = useTeamCatalog(showArchived);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = catalog.filter((t) => (showArchived ? true : !t.deleted_at));
    if (!term) return list;
    return list.filter(
      (t) => t.name.toLowerCase().includes(term) || String(t.id).includes(term)
    );
  }, [catalog, q, showArchived]);

  // Same selection ops as TeamPicker (store name/logo on add)
  const addOne = (id: number) => {
    if (isSelected(teams, id)) return;
    const src = byId.get(id);
    onChange([
      ...teams,
      {
        id,
        seed: undefined,
        groupsByStage: {},
        name: src?.name ?? `Team #${id}`,
        logo: src?.logo ?? null,
      },
    ]);
  };
  const removeOne = (id: number) => onChange(teams.filter((t) => t.id !== id));
  const toggleOne = (id: number) => (isSelected(teams, id) ? removeOne(id) : addOne(id));

  // Rehydrate missing name/logo metadata from catalog (same as TeamPicker)
  useEffect(() => {
    if (teams.length === 0 || catalog.length === 0) return;
    let changed = false;
    const next = teams.map((t) => {
      const hasName = typeof t.name === "string" && t.name.length > 0;
      const hasLogo = t.logo !== undefined;
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
  }, [catalog, byId, teams]);

  return (
    <div className="space-y-4">
      {/* 1) Included teams */}
      <section className={`${card} overflow-hidden`}>
        <button
          onClick={() => setIncludedOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/4 transition-colors"
        >
          <h3 className="text-sm font-bold text-white">
            Επιλεγμένες ομάδες{" "}
            <span className="font-normal text-zinc-500">({teams.length})</span>
          </h3>
          {includedOpen ? (
            <ChevronUp size={16} className="text-zinc-500" />
          ) : (
            <ChevronDown size={16} className="text-zinc-500" />
          )}
        </button>
        {includedOpen && (
          <div className="border-t border-white/8">
            {teams.length === 0 ? (
              <p className="p-4 text-center text-sm text-zinc-500">
                Καμία ομάδα ακόμη — επίλεξε από τη λίστα παρακάτω.
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-white/5 overflow-auto">
                {teams.map((t) => {
                  const name = t.name ?? byId.get(t.id)?.name ?? `#${t.id}`;
                  const logo = t.logo ?? byId.get(t.id)?.logo ?? null;
                  return (
                    <li key={t.id} className="flex min-h-13 items-center gap-3 px-3 py-2">
                      <TeamLogo logo={logo} name={name} />
                      <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                        {name} <span className="text-xs text-white/40">#{t.id}</span>
                      </span>
                      <button
                        onClick={() => removeOne(t.id)}
                        aria-label={`Αφαίρεση ${name}`}
                        title="Αφαίρεση από τη διοργάνωση (αποθηκεύεται στο Save)"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <X size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {teams.length > 0 && (
              <div className="flex justify-end border-t border-white/5 p-2">
                <Button variant="danger" className="!min-h-9 text-xs" onClick={() => onChange([])}>
                  Καθαρισμός όλων
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2) Catalog picker */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-white">Διαθέσιμες ομάδες</h3>
        <div className="sticky top-14 z-20 -mx-1 space-y-2 bg-black/90 px-1 py-2 backdrop-blur">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="search"
              className={`${fieldCls} pl-9`}
              placeholder="Αναζήτηση ομάδας ή #id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Αρχειοθετημένες
            </label>
            <button
              onClick={reload}
              aria-label="Ανανέωση"
              className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <span className="ml-auto text-xs text-zinc-500">
              {filtered.length}
              {loading ? "…" : ""} διαθέσιμες
            </span>
          </div>
        </div>

        {loading ? (
          <div className={`${card} p-6 text-sm text-zinc-500`}>Φόρτωση ομάδων…</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 p-4 text-sm text-rose-300">
            Σφάλμα: {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${card} p-6 text-center text-sm text-zinc-500`}>
            Δεν βρέθηκαν ομάδες.
          </div>
        ) : (
          <ul className={`${card} divide-y divide-white/5 overflow-hidden`}>
            {filtered.map((t: CatalogRow) => {
              const selected = isSelected(teams, t.id);
              const archived = !!t.deleted_at;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => toggleOne(t.id)}
                    aria-pressed={selected}
                    className={[
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors min-h-14",
                      selected ? "bg-indigo-500/8" : "hover:bg-white/4",
                    ].join(" ")}
                  >
                    <TeamLogo logo={t.logo} name={t.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white/90">
                        {t.name} <span className="text-xs text-white/40">#{t.id}</span>
                      </span>
                      {archived && (
                        <span className="text-xs text-amber-300/80">Αρχειοθετημένη</span>
                      )}
                    </span>
                    <span
                      className={[
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
                        selected
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-zinc-600 text-transparent",
                      ].join(" ")}
                    >
                      <Check size={14} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
