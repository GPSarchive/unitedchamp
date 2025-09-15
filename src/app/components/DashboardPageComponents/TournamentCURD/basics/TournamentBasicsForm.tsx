//app/components/DashboardPageComponents/TournamentCURD/basics/TournamentBasicsForm.tsx
"use client";

import { useEffect, useRef } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";

type T = NewTournamentPayload["tournament"];

export default function TournamentBasicsForm({
  value,
  onChange,
}: {
  value: T;
  onChange: (next: T) => void;
}) {
  const editedSlug = useRef(false);

  useEffect(() => {
    if (!editedSlug.current && value.name) {
      const slug = value.name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      onChange({ ...value, slug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.name]);

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-4 space-y-3">
      <h2 className="text-xl font-semibold text-cyan-200">Tournament</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Name"
          value={value.name ?? ""}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Slug"
          value={value.slug ?? ""}
          onChange={(e) => {
            editedSlug.current = true;
            onChange({ ...value, slug: e.target.value || null });
          }}
        />
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Season (e.g. 2025)"
          value={value.season ?? ""}
          onChange={(e) => onChange({ ...value, season: e.target.value || null })}
        />
        <select
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          value={value.status ?? "scheduled"}
          onChange={(e) => onChange({ ...value, status: e.target.value as any })}
        >
          {["scheduled", "running", "completed", "archived"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          value={value.format ?? "league"}
          onChange={(e) => onChange({ ...value, format: e.target.value as any })}
        >
          {["league", "groups", "knockout", "mixed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Logo URL (/public...)"
          value={value.logo ?? ""}
          onChange={(e) => onChange({ ...value, logo: e.target.value || null })}
        />
      </div>
    </div>
  );
}
