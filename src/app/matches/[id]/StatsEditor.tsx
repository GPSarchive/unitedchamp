//matches/[id]/StatsEditor.tsx
// no "use client" needed; server components can render inputs
import type { Id, PlayerAssociation } from "@/app/lib/types";

type MatchPlayerStatRow = {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: boolean;
  best_goalkeeper: boolean;
};

export default function StatsEditor({
  teamId,
  teamName,
  associations,
  existing,
}: {
  teamId: Id;
  teamName: string;
  associations: PlayerAssociation[];
  existing: Map<number, MatchPlayerStatRow>;
}) {
  return (
    <div className="rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">
        {teamName} – Edit stats{" "}
        <span className="text-xs text-gray-500">(players: {associations.length})</span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="text-left">
              <th className="py-1 pr-2">Player</th>
              <th className="py-1 pr-2">G</th>
              <th className="py-1 pr-2">A</th>
              <th className="py-1 pr-2">Y</th>
              <th className="py-1 pr-2">R</th>
              <th className="py-1 pr-2">B</th>
              <th className="py-1 pr-2">MVP (1/match)</th>
              <th className="py-1 pr-2">Best GK (1/match)</th>
              <th className="py-1 pr-2">Clear</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {associations.map((assoc) => {
              const p: any = assoc.player;
              const row = existing.get(p.id);
              const base = `players[${teamId}][${p.id}]`;

              return (
                <tr key={p.id}>
                  <td className="py-1 pr-2 max-w-[200px] truncate">
                    {p.first_name} {p.last_name}
                  </td>

                  <td className="py-1 pr-2">
                    <input name={`${base}[goals]`} defaultValue={row?.goals ?? 0} className="w-14 rounded border px-2 py-1" type="number" min={0}/>
                  </td>
                  <td className="py-1 pr-2">
                    <input name={`${base}[assists]`} defaultValue={row?.assists ?? 0} className="w-14 rounded border px-2 py-1" type="number" min={0}/>
                  </td>
                  <td className="py-1 pr-2">
                    <input name={`${base}[yellow_cards]`} defaultValue={row?.yellow_cards ?? 0} className="w-14 rounded border px-2 py-1" type="number" min={0}/>
                  </td>
                  <td className="py-1 pr-2">
                    <input name={`${base}[red_cards]`} defaultValue={row?.red_cards ?? 0} className="w-14 rounded border px-2 py-1" type="number" min={0}/>
                  </td>
                  <td className="py-1 pr-2">
                    <input name={`${base}[blue_cards]`} defaultValue={row?.blue_cards ?? 0} className="w-14 rounded border px-2 py-1" type="number" min={0}/>
                  </td>

                  {/* ensure a row exists even if only awards picked */}
                  <input type="hidden" name={`${base}[team_id]`} value={String(teamId)} />
                  <input type="hidden" name={`${base}[player_id]`} value={String(p.id)} />

                  <td className="py-1 pr-2">
                    <input type="radio" name="mvp_player_id" value={String(p.id)} defaultChecked={row?.mvp ?? false} aria-label="MVP"/>
                  </td>
                  <td className="py-1 pr-2">
                    <input type="radio" name="best_gk_player_id" value={String(p.id)} defaultChecked={row?.best_goalkeeper ?? false} aria-label="Best Goalkeeper"/>
                  </td>

                  <td className="py-1 pr-2">
                    <input type="hidden" name={`${base}[_delete]`} value="false" />
                    <input type="checkbox" name={`${base}[_delete]`} value="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {associations.length === 0 && (
          <div className="mt-3 text-sm text-amber-600">
            No players returned for this team — check your players query/joins.
          </div>
        )}
      </div>
    </div>
  );
}
