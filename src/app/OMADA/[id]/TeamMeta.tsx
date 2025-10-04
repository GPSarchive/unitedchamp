// app/OMADA/[id]/TeamMeta.tsx
'use client';

import { FaTrophy, FaUsers, FaHashtag, FaChartLine, FaCalendarAlt, FaAward } from "react-icons/fa";
import { Team } from "@/app/lib/types";

type TournamentLight = {
  id: number;
  name: string | null;
  season: string | null;
  status?: string | null;
  winner_team_id?: number | null;
};

export default function TeamMeta({
  team,
  tournaments,
  wins,
  errors,
}: {
  team: Team;
  tournaments: TournamentLight[];
  wins: { id: number; name: string | null; season: string | null }[];
  errors?: { membership?: string; wins?: string };
}) {
  const membershipCount = tournaments.length;
  const winsCount = wins.length;

  return (
    <section className="mb-12 rounded-2xl bg-zinc-900/50 border border-orange-800/30 shadow-xl p-8 backdrop-blur-sm">
      {/* Stats grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Unique ID */}
        <div className="flex flex-col items-start p-6 rounded-xl bg-orange-900/20 border border-orange-700/40 shadow-inner">
          <div className="flex items-center gap-3 mb-3 text-orange-300 text-xl">
            <FaHashtag className="text-orange-400" />
            <span className="font-semibold">Team ID (AM)</span>
          </div>
          <p className="text-white text-3xl font-bold">{team.am ?? "—"}</p>
        </div>

        {/* Season Score */}
        <div className="flex flex-col items-start p-6 rounded-xl bg-orange-900/20 border border-orange-700/40 shadow-inner">
          <div className="flex items-center gap-3 mb-3 text-orange-300 text-xl">
            <FaChartLine className="text-orange-400" />
            <span className="font-semibold">Season Score</span>
          </div>
          <p className="text-white text-3xl font-bold">{team.season_score ?? 0}</p>
        </div>

        {/* Tournament Memberships */}
        <div className="flex flex-col items-start p-6 rounded-xl bg-orange-900/20 border border-orange-700/40 shadow-inner">
          <div className="flex items-center gap-3 mb-3 text-orange-300 text-xl">
            <FaUsers className="text-orange-400" />
            <span className="font-semibold">Tournaments Joined</span>
          </div>
          <p className="text-white text-3xl font-bold">{membershipCount}</p>
          {errors?.membership && (
            <p className="text-red-400 text-sm mt-2">Error: {errors.membership}</p>
          )}
        </div>

        {/* Championships */}
        <div className="flex flex-col items-start p-6 rounded-xl bg-orange-900/20 border border-orange-700/40 shadow-inner">
          <div className="flex items-center gap-3 mb-3 text-orange-300 text-xl">
            <FaTrophy className="text-orange-400" />
            <span className="font-semibold">Championships</span>
          </div>
          <p className="text-white text-3xl font-bold">{winsCount}</p>
          {errors?.wins && (
            <p className="text-red-400 text-sm mt-2">Error: {errors.wins}</p>
          )}
        </div>
      </div>

      {/* Lists */}
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        {/* Tournament Membership List */}
        {membershipCount > 0 && (
          <div>
            <h3 className="text-2xl text-orange-300 mb-4 font-bold flex items-center gap-3">
              <FaCalendarAlt className="text-orange-400" /> Tournaments
            </h3>
            <div className="flex flex-wrap gap-3">
              {tournaments.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center rounded-full px-4 py-2 text-base border border-orange-600/50 bg-orange-900/30 text-orange-200 shadow-sm"
                >
                  {t.name ?? "—"} {t.season ? <>&nbsp;• {t.season}</> : null}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tournament Wins List */}
        {winsCount > 0 && (
          <div>
            <h3 className="text-2xl text-orange-300 mb-4 font-bold flex items-center gap-3">
              <FaAward className="text-orange-400" /> Championships
            </h3>
            <div className="flex flex-wrap gap-3">
              {wins.map((w) => (
                <span
                  key={w.id}
                  className="inline-flex items-center rounded-full px-4 py-2 text-base border border-orange-600/50 bg-orange-900/30 text-orange-200 shadow-sm"
                >
                  {w.name ?? "Champion"}{w.season ? ` (${w.season})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}