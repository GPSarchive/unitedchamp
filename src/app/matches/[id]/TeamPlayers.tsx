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
    <div className="rounded-2xl border p-5 shadow-sm bg-white">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {players.length === 0 ? (
        <div className="text-sm text-gray-500">No players found for this team.</div>
      ) : (
        <ul className="divide-y">
          {players.map((assoc) => {
            const p = assoc.player;
            const stats = (p.player_statistics[0] as PlayerStat | undefined);
            return (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div className={`truncate ${alignRight ? "text-right" : "text-left"}`}>
                  <div className="font-medium">
                    {p.first_name} {p.last_name}
                  </div>
                  {stats ? (
                    <div className="text-xs text-gray-500">
                      Goals: {stats.total_goals} • Assists: {stats.total_assists}
                      {stats.age ? ` • Age: ${stats.age}` : null}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">No stats</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
