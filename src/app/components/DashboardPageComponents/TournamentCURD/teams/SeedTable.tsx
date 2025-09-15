// app/components/DashboardPageComponents/TournamentCURD/teams/SeedTable.tsx
"use client";

import type { TeamDraft } from "../TournamentWizard";

export default function SeedTable({
  teams,
  onChange,
}: {
  teams: TeamDraft[];
  onChange: (next: TeamDraft[]) => void;
}) {
  // Display name helper (works even if 'name' is absent on TeamDraft)
  const displayName = (t: TeamDraft): string =>
    (t as any)?.name ? String((t as any).name) : `Team #${t.id}`;

  // Table sort: current seeds first (ascending), then unseeded
  const sorted = [...teams].sort((a, b) => (a.seed ?? 9e9) - (b.seed ?? 9e9));

  const setSeed = (id: number, seed?: number) => {
    onChange(teams.map((t) => (t.id === id ? { ...t, seed } : t)));
  };

  const clearAll = () => onChange(teams.map((t) => ({ ...t, seed: undefined })));

  // 🔹 Auto-assign seeds 1..N by alphabetical name (fallback: Team #ID)
  // Keeps the original 'teams' order; only updates the 'seed' field
  const autoAssignAll = () => {
    const order = [...teams].sort((a, b) => {
      const an = displayName(a).toLowerCase();
      const bn = displayName(b).toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return a.id - b.id; // stable tiebreak
    });
    const idToSeed = new Map<number, number>(order.map((t, i) => [t.id, i + 1]));
    onChange(
      teams.map((t) => ({
        ...t,
        seed: idToSeed.get(t.id)!, // non-null: every team is in the map
      }))
    );
  };

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-cyan-200">Knockout Seeding (optional)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={autoAssignAll}
            title="Assign seeds 1..N alphabetically by team name"
            className="text-xs px-2 py-1 rounded-md border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            Auto 1..N
          </button>
          <button
            onClick={clearAll}
            className="text-xs px-2 py-1 rounded-md border border-amber-400/30 text-amber-200 hover:bg-amber-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-cyan-200/80">
            <tr>
              <th className="text-left py-1">Team</th>
              <th className="text-right py-1">Seed</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} className="border-b border-cyan-400/10">
                <td className="py-1 text-white/90">
                  <span className="text-white/60 mr-1">#{t.id}</span>
                  {displayName(t)}
                </td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    className="w-20 bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-right text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    value={t.seed ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setSeed(t.id, v === "" ? undefined : Number(v));
                    }}
                    placeholder="—"
                  />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={2} className="py-3 text-center text-white/60">
                  No teams to seed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
