// matches/[id]/StatsEditor.tsx
"use client";

import * as React from "react";
import AddPlayerToTeamLauncher from "./AddPlayerToTeamLauncher";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";

export default function StatsEditor({
  teamId,
  teamName,
  associations,
  existing,
  participants,
  readOnly = false,
}: {
  teamId: Id;
  teamName: string;
  associations: PlayerAssociation[];
  existing: Map<number, MatchPlayerStatRow>;
  participants: Map<number, ParticipantRow>;
  readOnly?: boolean;
}) {
  // Local "played" state per player so toggling Συμμετοχή enables inputs immediately
  const [playedMap, setPlayedMap] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const a of associations) init[a.player.id] = participants.has(a.player.id);
    return init;
  });

  const setPlayed = (playerId: number, next: boolean) =>
    setPlayedMap((m) => ({ ...m, [playerId]: next }));

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">
          {teamName} – Edit participants & stats{" "}
          <span className="text-xs text-gray-500">(players: {associations.length})</span>
        </h3>

        {!readOnly && (
          <AddPlayerToTeamLauncher
            teamId={Number(teamId)}
            label="Add player"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-emerald-600/20 px-3 py-2 text-white hover:bg-emerald-600/30"
          />
        )}
      </div>

      {/* Mobile layout: stacked cards */}
      <div className="space-y-3 md:hidden">
        {associations.map((assoc) => {
          const p: any = assoc.player;
          const stats = existing.get(p.id);
          const baseStats = `players[${teamId}][${p.id}]`;
          const basePart = `participants[${teamId}][${p.id}]`;

          const playedOn = !!playedMap[p.id];

          const posVal = stats?.position ?? "";
          const capDefault = !!stats?.is_captain;
          const gkDefault = !!stats?.gk;

          const goalsDefault = String(stats?.goals ?? 0);
          const assistsDefault = String(stats?.assists ?? 0);
          const ycDefault = String(stats?.yellow_cards ?? 0);
          const rcDefault = String(stats?.red_cards ?? 0);
          const bcDefault = String(stats?.blue_cards ?? 0);

          return (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0 truncate font-medium">
                  {p.first_name} {p.last_name}
                </div>

                {/* Συμμετοχή switch */}
                <label className="inline-flex items-center gap-2 text-xs">
                  {/* fallback unchecked value */}
                  <input type="hidden" name={`${basePart}[played]`} defaultValue="false" />
                  <input
                    type="checkbox"
                    name={`${basePart}[played]`}
                    value="true"
                    checked={playedOn}
                    onChange={(e) => setPlayed(p.id, e.currentTarget.checked)}
                    aria-label="Συμμετοχή"
                    disabled={readOnly}
                  />
                  Συμμετοχή
                </label>
              </div>

              {/* Ensure stats row exists even if only awards picked */}
              <input type="hidden" name={`${baseStats}[team_id]`} defaultValue={String(teamId)} />
              <input type="hidden" name={`${baseStats}[player_id]`} defaultValue={String(p.id)} />

              {/* Role fields (now posted under players[...] per-match stats) */}
              <div className="mb-2 grid grid-cols-3 gap-2 text-sm">
                <label className="flex flex-col">
                  <span className="text-gray-500">Position</span>
                  <input
                    type="text"
                    name={`${baseStats}[position]`}
                    defaultValue={posVal}
                    placeholder="TBD"
                    className="rounded border px-2 py-1"
                    disabled={readOnly || !playedOn}
                  />
                </label>

                {/* Captain with hidden fallback */}
                <label className="flex items-center gap-2 pt-5 text-xs">
                  <input type="hidden" name={`${baseStats}[is_captain]`} value="false" />
                  <input
                    type="checkbox"
                    name={`${baseStats}[is_captain]`}
                    defaultChecked={capDefault}
                    disabled={readOnly || !playedOn}
                  />
                  Captain
                </label>

                {/* GK with hidden fallback */}
                <label className="flex items-center gap-2 pt-5 text-xs">
                  <input type="hidden" name={`${baseStats}[gk]`} value="false" />
                  <input
                    type="checkbox"
                    name={`${baseStats}[gk]`}
                    defaultChecked={gkDefault}
                    disabled={readOnly || !playedOn}
                  />
                  GK
                </label>
              </div>

              {/* fallbacks first */}
              <input type="hidden" name={`${baseStats}[goals]`} value="0" />
              <input type="hidden" name={`${baseStats}[assists]`} value="0" />
              <input type="hidden" name={`${baseStats}[yellow_cards]`} value="0" />
              <input type="hidden" name={`${baseStats}[red_cards]`} value="0" />
              <input type="hidden" name={`${baseStats}[blue_cards]`} value="0" />

              {/* then the visible inputs */}
              <NumInput name={`${baseStats}[goals]`}   def={goalsDefault}  disabled={!playedOn || readOnly} label="G" />
              <NumInput name={`${baseStats}[assists]`} def={assistsDefault} disabled={!playedOn || readOnly} label="A" />
              <NumInput name={`${baseStats}[yellow_cards]`} def={ycDefault} disabled={!playedOn || readOnly} label="Y" />
              <NumInput name={`${baseStats}[red_cards]`}    def={rcDefault} disabled={!playedOn || readOnly} label="R" />
              <NumInput name={`${baseStats}[blue_cards]`}   def={bcDefault} disabled={!playedOn || readOnly} label="B" />

              {/* Awards and Clear (added for mobile) */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm border-t border-gray-300 pt-4">
                <label className="flex items-center gap-2">
                  MVP
                  <input
                    type="radio"
                    name="mvp_player_id"
                    value={String(p.id)}
                    defaultChecked={Boolean(stats?.mvp)}
                    aria-label="MVP"
                    disabled={readOnly || !playedOn}
                  />
                </label>
                <label className="flex items-center gap-2">
                  Best GK
                  <input
                    type="radio"
                    name="best_gk_player_id"
                    value={String(p.id)}
                    defaultChecked={Boolean(stats?.best_goalkeeper)}
                    aria-label="Best Goalkeeper"
                    disabled={readOnly || !playedOn}
                  />
                </label>
                {!readOnly && (
                  <label className="flex items-center gap-2">
                    Clear
                    <input type="hidden" name={`${baseStats}[_delete]`} defaultValue="false" />
                    <input
                      type="checkbox"
                      name={`${baseStats}[_delete]`}
                      value="true"
                      defaultChecked={false}
                      aria-label="Clear row"
                      disabled={!playedOn}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop layout: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-2 text-left">Played</th>
              <th className="py-2 pr-2 text-left">Player</th>
              <th className="py-2 pr-2 text-left">Pos</th>
              <th className="py-2 pr-2 text-left">Cap</th>
              <th className="py-2 pr-2 text-left">GK</th>
              <th className="py-2 pr-2 text-left">G</th>
              <th className="py-2 pr-2 text-left">A</th>
              <th className="py-2 pr-2 text-left">Y</th>
              <th className="py-2 pr-2 text-left">R</th>
              <th className="py-2 pr-2 text-left">B</th>
              <th className="py-2 pr-2 text-left">MVP</th>
              <th className="py-2 pr-2 text-left">Best GK</th>
              <th className="py-2 pr-2 text-left">Clear</th>
            </tr>
          </thead>
          <tbody>
            {associations.map((assoc) => {
              const p: any = assoc.player;
              const stats = existing.get(p.id);
              const baseStats = `players[${teamId}][${p.id}]`;
              const basePart = `participants[${teamId}][${p.id}]`;

              const playedOn = !!playedMap[p.id];

              const posVal = stats?.position ?? "";
              const capDefault = !!stats?.is_captain;
              const gkDefault = !!stats?.gk;

              const goalsDefault = String(stats?.goals ?? 0);
              const assistsDefault = String(stats?.assists ?? 0);
              const ycDefault = String(stats?.yellow_cards ?? 0);
              const rcDefault = String(stats?.red_cards ?? 0);
              const bcDefault = String(stats?.blue_cards ?? 0);

              return (
                <tr key={p.id}>
                  {/* Συμμετοχή */}
                  <td className="py-1 pr-2">
                    <input type="hidden" name={`${basePart}[played]`} defaultValue="false" />
                    <input
                      type="checkbox"
                      name={`${basePart}[played]`}
                      value="true"
                      checked={playedOn}
                      onChange={(e) => setPlayed(p.id, e.currentTarget.checked)}
                      aria-label="Συμμετοχή"
                      disabled={readOnly}
                    />
                  </td>

                  {/* Player */}
                  <td className="max-w-[220px] truncate py-1 pr-2">
                    {p.first_name} {p.last_name}
                    <input type="hidden" name={`${baseStats}[team_id]`} defaultValue={String(teamId)} />
                    <input type="hidden" name={`${baseStats}[player_id]`} defaultValue={String(p.id)} />
                  </td>

                  {/* Position */}
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      name={`${baseStats}[position]`}
                      defaultValue={posVal}
                      placeholder="TBD"
                      className="w-20 rounded border px-2 py-1"
                      disabled={readOnly || !playedOn}
                    />
                  </td>

                  {/* Captain */}
                  <td className="py-1 pr-2">
                    <input type="hidden" name={`${baseStats}[is_captain]`} value="false" />
                    <input
                      type="checkbox"
                      name={`${baseStats}[is_captain]`}
                      defaultChecked={capDefault}
                      disabled={readOnly || !playedOn}
                      aria-label="Captain"
                    />
                  </td>

                  {/* GK */}
                  <td className="py-1 pr-2">
                    <input type="hidden" name={`${baseStats}[gk]`} value="false" />
                    <input
                      type="checkbox"
                      name={`${baseStats}[gk]`}
                      defaultChecked={gkDefault}
                      disabled={readOnly || !playedOn}
                      aria-label="GK"
                    />
                  </td>

                  {/* Stats */}
                  <td className="py-1 pr-2">
                    <NumInput name={`${baseStats}[goals]`} def={goalsDefault} disabled={!playedOn || readOnly} />
                  </td>
                  <td className="py-1 pr-2">
                    <NumInput name={`${baseStats}[assists]`} def={assistsDefault} disabled={!playedOn || readOnly} />
                  </td>
                  <td className="py-1 pr-2">
                    <NumInput name={`${baseStats}[yellow_cards]`} def={ycDefault} disabled={!playedOn || readOnly} />
                  </td>
                  <td className="py-1 pr-2">
                    <NumInput name={`${baseStats}[red_cards]`} def={rcDefault} disabled={!playedOn || readOnly} />
                  </td>
                  <td className="py-1 pr-2">
                    <NumInput name={`${baseStats}[blue_cards]`} def={bcDefault} disabled={!playedOn || readOnly} />
                  </td>

                  {/* Awards */}
                  <td className="py-1 pr-2">
                    <input
                      type="radio"
                      name="mvp_player_id"
                      value={String(p.id)}
                      defaultChecked={Boolean(stats?.mvp)}
                      aria-label="MVP"
                      disabled={readOnly || !playedOn}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="radio"
                      name="best_gk_player_id"
                      value={String(p.id)}
                      defaultChecked={Boolean(stats?.best_goalkeeper)}
                      aria-label="Best Goalkeeper"
                      disabled={readOnly || !playedOn}
                    />
                  </td>

                  {/* Clear */}
                  <td className="py-1 pr-2">
                    {!readOnly && (
                      <>
                        <input type="hidden" name={`${baseStats}[_delete]`} defaultValue="false" />
                        <input
                          type="checkbox"
                          name={`${baseStats}[_delete]`}
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

/** Small numeric input helper (uncontrolled) */
function NumInput({
  name,
  def,
  disabled,
  label,
}: {
  name: string;
  def: string;
  disabled: boolean;
  label?: string;
}) {
  return (
    <label className={label ? "flex flex-col" : "block"}>
      {label && <span className="text-gray-500">{label}</span>}
      <input
        name={name}
        defaultValue={def}
        className="w-14 rounded border px-2 py-1"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        disabled={disabled}
      />
    </label>
  );
}