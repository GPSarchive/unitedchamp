// app/OMADA/[id]/TeamSidebar.tsx
"use client";

import { Team } from "@/app/lib/types";

type TournamentLight = {
  id: number;
  name: string | null;
  season: string | null;
};

type TeamSidebarProps = {
  team: Team;
  tournaments: TournamentLight[];
  wins: { id: number; name: string | null; season: string | null }[];
  errors?: { membership?: string; wins?: string };
};

export default function TeamSidebar({ team, tournaments, wins, errors }: TeamSidebarProps) {
  return (
    <aside className="sticky top-8 h-fit space-y-10 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Club details</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-300">
          <Detail label="Team ID" value={team.am ?? "—"} />
          <Detail label="Season score" value={team.season_score ?? 0} />
        </div>
      </section>

      <section>
        <header className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Tournaments</h2>
          <span className="text-xs text-slate-500">{tournaments.length}</span>
        </header>
        {errors?.membership ? (
          <p className="mt-3 text-sm text-rose-400">Failed to load tournaments: {errors.membership}</p>
        ) : tournaments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No tournament history recorded.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tournaments.map((tournament) => (
              <li
                key={tournament.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
              >
                <p className="text-sm font-medium text-white">
                  {tournament.name ?? "—"}
                </p>
                {tournament.season ? (
                  <p className="mt-1 text-xs text-slate-400">Season {tournament.season}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <header className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Championships</h2>
          <span className="text-xs text-slate-500">{wins.length}</span>
        </header>
        {errors?.wins ? (
          <p className="mt-3 text-sm text-rose-400">Failed to load titles: {errors.wins}</p>
        ) : wins.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No championship wins yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {wins.map((win) => (
              <li
                key={win.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
              >
                <p className="text-sm font-medium text-white">{win.name ?? "Champion"}</p>
                {win.season ? (
                  <p className="mt-1 text-xs text-slate-400">Season {win.season}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: number | string }) {
  return (
    <dl className="flex items-baseline justify-between text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </dl>
  );
}
