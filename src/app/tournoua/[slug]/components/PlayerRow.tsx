// app/tournoua/[slug]/components/PlayerRow.tsx

type Player = {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
  };
  
  type Stats = {
    goals?: number;
    assists?: number;
    yellow_cards?: number;
    red_cards?: number;
    blue_cards?: number;
    mvp_count?: number;
    best_gk_count?: number;
  };
  
  export default function PlayerRow({
    player,
    stats,
  }: {
    player: Player;
    stats: Stats;
  }) {
    const name = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() ||
      `Player #${player.id}`;
  
    return (
      <tr className="bg-white/5">
        <td className="px-2 py-2 font-medium">{name}</td>
        <td className="px-2 py-2 text-right">{stats.goals ?? 0}</td>
        <td className="px-2 py-2 text-right">{stats.assists ?? 0}</td>
        <td className="px-2 py-2 text-right">{stats.mvp_count ?? 0}</td>
        <td className="px-2 py-2 text-right">{stats.best_gk_count ?? 0}</td>
        <td className="px-2 py-2 text-right">{stats.yellow_cards ?? 0}</td>
        <td className="px-2 py-2 text-right">{stats.red_cards ?? 0}</td>
        <td className="px-2 py-2 text-right">{stats.blue_cards ?? 0}</td>
      </tr>
    );
  }
  