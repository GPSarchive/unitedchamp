// matches/[id]/StatsEditor.tsx
// no "use client" needed; server components can render inputs
import AddPlayerToTeamLauncher from "./AddPlayerToTeamLauncher";
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
  readOnly = false,
}: {
  teamId: Id;
  teamName: string;
  associations: PlayerAssociation[];
  existing: Map<number, MatchPlayerStatRow>;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">
          {teamName} – Edit stats{" "}
          <span className="text-xs text-gray-500">
            (players: {associations.length})
          </span>
        </h3>

        {!readOnly && (
          <AddPlayerToTeamLauncher
            teamId={Number(teamId)}
            label="Add player"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white bg-emerald-600/20 hover:bg-emerald-600/30"
          />
        )}
      </div>

      {/* Mobile layout: stacked cards for easier editing on phones */}
      <div className="md:hidden space-y-3">
        {associations.map((assoc) => {
          const p: any = assoc.player;
          const row = existing.get(p.id);
          const base = `players[${teamId}][${p.id}]`;

          const goalsDefault = String(row?.goals ?? 0);
          const assistsDefault = String(row?.assists ?? 0);
          const ycDefault = String(row?.yellow_cards ?? 0);
          const rcDefault = String(row?.red_cards ?? 0);
          const bcDefault = String(row?.blue_cards ?? 0);

          return (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="font-medium mb-2 truncate">
                {p.first_name} {p.last_name}
              </div>

              {/* ensure a row exists even if only awards picked */}
              <input type="hidden" name={`${base}[team_id]`} defaultValue={String(teamId)} />
              <input type="hidden" name={`${base}[player_id]`} defaultValue={String(p.id)} />

              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="flex flex-col">
                  <span className="text-gray-500">G</span>
                  <input
                    name={`${base}[goals]`}
                    defaultValue={goalsDefault}
                    className="rounded border px-2 py-1"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-500">A</span>
                  <input
                    name={`${base}[assists]`}
                    defaultValue={assistsDefault}
                    className="rounded border px-2 py-1"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-500">Y</span>
                  <input
                    name={`${base}[yellow_cards]`}
                    defaultValue={ycDefault}
                    className="rounded border px-2 py-1"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-500">R</span>
                  <input
                    name={`${base}[red_cards]`}
                    defaultValue={rcDefault}
                    className="rounded border px-2 py-1"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-500">B</span>
                  <input
                    name={`${base}[blue_cards]`}
                    defaultValue={bcDefault}
                    className="rounded border px-2 py-1"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <label className="inline-flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="mvp_player_id"
                    value={String(p.id)}
                    defaultChecked={Boolean(row?.mvp)}
                    aria-label="MVP"
                    disabled={readOnly}
                  />
                  MVP
                </label>
                <label className="inline-flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="best_gk_player_id"
                    value={String(p.id)}
                    defaultChecked={Boolean(row?.best_goalkeeper)}
                    aria-label="Best Goalkeeper"
                    disabled={readOnly}
                  />
                  Best GK
                </label>

                {!readOnly && (
                  <>
                    <input type="hidden" name={`${base}[_delete]`} defaultValue="false" />
                    <label className="inline-flex items-center gap-1 text-xs ml-auto">
                      <input
                        type="checkbox"
                        name={`${base}[_delete]`}
                        value="true"
                        defaultChecked={false}
                        aria-label="Clear row"
                      />
                      Clear
                    </label>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop layout: table with scroll if needed */}
      <div className="hidden md:block overflow-x-auto">
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

              const goalsDefault = String(row?.goals ?? 0);
              const assistsDefault = String(row?.assists ?? 0);
              const ycDefault = String(row?.yellow_cards ?? 0);
              const rcDefault = String(row?.red_cards ?? 0);
              const bcDefault = String(row?.blue_cards ?? 0);

              return (
                <tr key={p.id}>
                  <td className="py-1 pr-2 max-w-[220px] truncate">
                    {p.first_name} {p.last_name}
                    {/* ensure a row exists even if only awards picked */}
                    <input type="hidden" name={`${base}[team_id]`} defaultValue={String(teamId)} />
                    <input type="hidden" name={`${base}[player_id]`} defaultValue={String(p.id)} />
                  </td>

                  <td className="py-1 pr-2">
                    <input
                      name={`${base}[goals]`}
                      defaultValue={goalsDefault}
                      className="w-14 rounded border px-2 py-1"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      readOnly={readOnly}
                      aria-readonly={readOnly}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      name={`${base}[assists]`}
                      defaultValue={assistsDefault}
                      className="w-14 rounded border px-2 py-1"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      readOnly={readOnly}
                      aria-readonly={readOnly}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      name={`${base}[yellow_cards]`}
                      defaultValue={ycDefault}
                      className="w-14 rounded border px-2 py-1"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      readOnly={readOnly}
                      aria-readonly={readOnly}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      name={`${base}[red_cards]`}
                      defaultValue={rcDefault}
                      className="w-14 rounded border px-2 py-1"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      readOnly={readOnly}
                      aria-readonly={readOnly}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      name={`${base}[blue_cards]`}
                      defaultValue={bcDefault}
                      className="w-14 rounded border px-2 py-1"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      readOnly={readOnly}
                      aria-readonly={readOnly}
                    />
                  </td>

                  <td className="py-1 pr-2">
                    <input
                      type="radio"
                      name="mvp_player_id"
                      value={String(p.id)}
                      defaultChecked={Boolean(row?.mvp)}
                      aria-label="MVP"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="radio"
                      name="best_gk_player_id"
                      value={String(p.id)}
                      defaultChecked={Boolean(row?.best_goalkeeper)}
                      aria-label="Best Goalkeeper"
                      disabled={readOnly}
                    />
                  </td>

                  <td className="py-1 pr-2">
                    {!readOnly && (
                      <>
                        {/* hidden fallback unchecked value */}
                        <input type="hidden" name={`${base}[_delete]`} defaultValue="false" />
                        <input
                          type="checkbox"
                          name={`${base}[_delete]`}
                          value="true"
                          defaultChecked={false}
                          aria-label="Clear row"
                        />
                      </>
                    )}
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
