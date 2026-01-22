// app/OMADA/[id]/PlayersSection.tsx
import Image from "next/image";
import { FaUser, FaRulerVertical, FaBirthdayCake, FaFutbol, FaHandsHelping, FaExclamationTriangle, FaTimesCircle, FaCircle } from "react-icons/fa";
import { PlayerAssociation } from "@/app/lib/types";

interface PlayersSectionProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
}

export default function PlayersSection({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
}: PlayersSectionProps) {
  return (
    <section className="mb-12 rounded-2xl border border-orange-800/30 bg-orange-900/10 p-8 shadow-xl">
      <h2 className="text-3xl font-bold text-orange-300 mb-6 flex items-center gap-3"><FaUser className="text-orange-400" /> Current Players</h2>

      {errorMessage ? (
        <p className="text-red-400">Error loading players: {errorMessage}</p>
      ) : !playerAssociations || playerAssociations.length === 0 ? (
        <p className="text-gray-400">No players currently on this team.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                className="p-6 border border-orange-800/40 bg-orange-900/20 rounded-2xl shadow-lg hover:shadow-2xl hover:border-orange-600/60 transition"
              >
                <div className="flex items-center gap-4 mb-4">
                  {/* Photo (round) */}
                  <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-orange-500/40 bg-orange-900/30">
                    <Image
                      src={p.photo || "/player-placeholder.jpg"}
                      alt={`${p.first_name} ${p.last_name}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 object-cover"
                    />
                  </div>

                  <div>
                    <p className="text-2xl font-semibold text-white/95">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-gray-300 text-base flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1"><FaUser className="text-orange-400" /> {p.position ?? "—"}</span>
                    </p>
                  </div>
                </div>

                {/* Totals (from player_statistics) */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="inline-flex items-center rounded-full bg-orange-900/30 px-3 py-1 text-base text-orange-300 border border-orange-600/50">
                    <FaFutbol className="mr-1 text-orange-400" /> Goals: {stats.total_goals ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-orange-900/30 px-3 py-1 text-base text-orange-300 border border-orange-600/50">
                    <FaHandsHelping className="mr-1 text-orange-400" /> Assists: {stats.total_assists ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-yellow-900/30 px-3 py-1 text-base text-yellow-300 border border-yellow-600/50">
                    <FaExclamationTriangle className="mr-1 text-yellow-400" /> YC: {stats.yellow_cards ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-red-900/30 px-3 py-1 text-base text-red-300 border border-red-600/50">
                    <FaTimesCircle className="mr-1 text-red-400" /> RC: {stats.red_cards ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-900/30 px-3 py-1 text-base text-blue-300 border border-blue-600/50">
                    <FaCircle className="mr-1 text-blue-400" /> BC: {stats.blue_cards ?? 0}
                  </span>
                </div>

                {/* Per-season (team scope) – small table */}
                {perSeason.length > 0 && (
                  <div className="mt-6 rounded-xl bg-black/20 border border-orange-800/40 p-4 overflow-x-auto">
                    <p className="text-orange-300 text-base mb-3 font-semibold">Per-Season Stats (This Team)</p>
                    <table className="w-full text-sm text-slate-200">
                      <thead>
                        <tr className="border-b border-orange-800/40">
                          <th className="text-left py-2">Season</th>
                          <th className="text-left py-2">Matches</th>
                          <th className="text-left py-2">Goals/Assists</th>
                          <th className="text-left py-2">Cards (Y/R/B)</th>
                          <th className="text-left py-2">Awards (MVP/GK)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perSeason.map((row, i) => (
                          <tr key={i} className="border-b border-orange-800/20 last:border-none">
                            <td className="py-2">{row.season}</td>
                            <td className="py-2">{row.matches}</td>
                            <td className="py-2">{row.goals}/{row.assists}</td>
                            <td className="py-2">{row.yellow_cards}/{row.red_cards}/{row.blue_cards}</td>
                            <td className="py-2">{row.mvp}/{row.best_gk}</td>
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
      )}
    </section>
  );
}