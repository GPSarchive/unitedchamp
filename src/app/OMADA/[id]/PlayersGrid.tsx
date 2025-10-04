// app/OMADA/[id]/PlayersGrid.tsx
import Image from "next/image";
import {
  FaUser,
  FaRulerVertical,
  FaBirthdayCake,
  FaFutbol,
  FaHandsHelping,
  FaExclamationTriangle,
  FaTimesCircle,
  FaCircle,
} from "react-icons/fa";
import { PlayerAssociation } from "@/app/lib/types";

interface PlayersGridProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
}

export default function PlayersGrid({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
}: PlayersGridProps) {
  if (errorMessage) {
    return <p className="text-red-400">Error loading players: {errorMessage}</p>;
  }

  if (!playerAssociations || playerAssociations.length === 0) {
    return <p className="text-zinc-400">No players currently on this team.</p>;
  }

  return (
    <section className="rounded-2xl p-6 shadow-xl backdrop-blur-sm border border-amber-500/20 bg-gradient-to-b from-stone-900/60 via-amber-950/5 to-zinc-900">
      <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 mb-4 flex items-center gap-2">
        <FaUser className="text-amber-400" /> Squad
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playerAssociations.map((assoc) => {
          const p = assoc.player;
          const stats =
            p.player_statistics?.[0] ?? {
              age: null,
              total_goals: 0,
              total_assists: 0,
              yellow_cards: 0,
              red_cards: 0,
              blue_cards: 0,
            };

          const perSeason = (seasonStatsByPlayer?.[p.id] ?? []) as Array<{
            season: string;
            matches: number;
            goals: number;
            assists: number;
            yellow_cards: number;
            red_cards: number;
            blue_cards: number;
            mvp: number;
            best_gk: number;
            updated_at: string;
          }>;

          return (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-stone-950/40 border border-amber-600/30 hover:border-amber-400/50 transition-shadow hover:shadow-md hover:shadow-orange-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <div className="flex items-center gap-3 mb-3">
                <Image
                  src={p.photo || "/player-placeholder.jpg"}
                  alt={`${p.first_name} ${p.last_name}`}
                  width={48}
                  height={48}
                  className="rounded-full border-2 border-amber-400/30"
                />
                <div>
                  <p className="font-semibold text-white">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-sm text-zinc-400 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <FaUser /> {p.position ?? "—"}
                    </span>
                    {p.height_cm && (
                      <span className="inline-flex items-center gap-1">
                        <FaRulerVertical /> {p.height_cm}
                        cm
                      </span>
                    )}
                    {p.birth_date && (
                      <span className="inline-flex items-center gap-1">
                        <FaBirthdayCake />{" "}
                        {new Date(p.birth_date).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 text-sm">
                <div className="text-center bg-orange-900/20 p-2 rounded">
                  <FaFutbol className="mx-auto text-amber-400" />
                  <p className="text-zinc-100">{stats.total_goals ?? 0}</p>
                </div>
                <div className="text-center bg-orange-900/20 p-2 rounded">
                  <FaHandsHelping className="mx-auto text-amber-400" />
                  <p className="text-zinc-100">{stats.total_assists ?? 0}</p>
                </div>
                <div className="text-center bg-yellow-900/20 p-2 rounded">
                  <FaExclamationTriangle className="mx-auto text-yellow-400" />
                  <p className="text-zinc-100">{stats.yellow_cards ?? 0}</p>
                </div>
                <div className="text-center bg-red-900/20 p-2 rounded">
                  <FaTimesCircle className="mx-auto text-red-400" />
                  <p className="text-zinc-100">{stats.red_cards ?? 0}</p>
                </div>
                {/* Neutralize the former blue tile to match the warm theme */}
                <div className="text-center bg-stone-900/25 p-2 rounded">
                  <FaCircle className="mx-auto text-amber-300" />
                  <p className="text-zinc-100">{stats.blue_cards ?? 0}</p>
                </div>
              </div>

              {perSeason.length > 0 && (
                <div className="mt-4 text-xs overflow-x-auto">
                  <table className="w-full text-zinc-300">
                    <thead>
                      <tr className="border-b border-amber-600/30">
                        <th className="text-left py-1 pr-2">Season</th>
                        <th className="text-left py-1 pr-2">M</th>
                        <th className="text-left py-1 pr-2">G/A</th>
                        <th className="text-left py-1 pr-2">Y/R/B</th>
                        <th className="text-left py-1 pr-2">MVP/GK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perSeason.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                          <td className="py-1 pr-2">{row.season}</td>
                          <td className="py-1 pr-2">{row.matches}</td>
                          <td className="py-1 pr-2">
                            {row.goals}/{row.assists}
                          </td>
                          <td className="py-1 pr-2">
                            {row.yellow_cards}/{row.red_cards}/{row.blue_cards}
                          </td>
                          <td className="py-1 pr-2">
                            {row.mvp}/{row.best_gk}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
