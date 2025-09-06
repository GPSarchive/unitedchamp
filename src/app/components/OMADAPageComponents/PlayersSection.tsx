import { PlayerAssociation } from "@/app/lib/types";

interface PlayersSectionProps {
  playerAssociations: PlayerAssociation[] | null;
  errorMessage?: string | null;
}

export default function PlayersSection({
  playerAssociations,
  errorMessage,
}: PlayersSectionProps) {
  return (
    <section className="mb-12 border border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-transparent p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Current Players</h2>

      {errorMessage ? (
        <p className="text-red-400">Error loading players: {errorMessage}</p>
      ) : !playerAssociations || playerAssociations.length === 0 ? (
        <p className="text-gray-400">No players currently on this team.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {playerAssociations.map((assoc) => {
            const player = assoc.player;
            const stats =
              player.player_statistics?.[0] ?? {
                age: null,
                total_goals: 0,
                total_assists: 0,
                yellow_cards: 0,
                red_cards: 0,
                blue_cards: 0,
              };

            return (
              <div
                key={player.id}
                className="p-4 border border-orange-400/20 bg-orange-500/5 shadow-md hover:shadow-lg hover:border-orange-400/40 transition"
              >
                <p className="text-lg font-semibold text-white/95">
                  {player.first_name} {player.last_name}
                </p>
                <p className="text-gray-300 mt-1">Age: {stats.age ?? "N/A"}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-sm text-orange-300">
                    Goals: {stats.total_goals ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-sm text-orange-300">
                    Assists: {stats.total_assists ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-sm text-yellow-300">
                    YC: {stats.yellow_cards ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-sm text-red-300">
                    RC: {stats.red_cards ?? 0}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-sm text-blue-300">
                    BC: {stats.blue_cards ?? 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
