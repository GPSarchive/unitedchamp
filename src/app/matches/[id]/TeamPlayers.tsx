// matches/[id]/TeamPlayers.tsx
import type { PlayerAssociation, PlayerStatisticsRow as PlayerStat } from "@/app/lib/types";

export default function TeamPlayers({
  title,
  players,
  alignRight = false,
}: {
  title: string;
  players: PlayerAssociation[];
  alignRight?: boolean;
}) {
  return (
    <div
      className="
        rounded-2xl border border-orange-400/20
        bg-gradient-to-b from-orange-500/10 to-transparent
        p-5 shadow-md
      "
    >
      <h3 className="mb-3 text-lg font-bold text-white">{title}</h3>

      {players.length === 0 ? (
        <div className="text-sm text-gray-300">No players found for this team.</div>
      ) : (
        <ul className="divide-y divide-orange-400/10">
          {players.map((assoc) => {
            const p = assoc.player;
            const stats = (p.player_statistics[0] as PlayerStat | undefined);

            const goals = stats?.total_goals ?? 0;
            const assists = stats?.total_assists ?? 0;
            const age = stats?.age ?? null;

            return (
              <li key={p.id} className="py-3">
                <div className={`${alignRight ? "text-right" : "text-left"}`}>
                  <div className="font-semibold text-white/95 truncate">
                    {p.first_name} {p.last_name}
                  </div>

                  <div
                    className={`mt-2 flex flex-wrap gap-2 text-xs ${
                      alignRight ? "justify-end" : ""
                    }`}
                  >
                    <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                      Goals: {goals}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                      Assists: {assists}
                    </span>
                    {age !== null ? (
                      <span className="inline-flex items-center rounded-full bg-zinc-800/60 px-2 py-0.5 text-gray-200">
                        Age: {age}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-zinc-800/60 px-2 py-0.5 text-gray-400">
                        Age: N/A
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
