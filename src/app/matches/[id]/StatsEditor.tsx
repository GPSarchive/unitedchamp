"use client";

import * as React from "react";
import AddPlayerToTeamLauncher from "./AddPlayerToTeamLauncher";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";
import { ChevronDown, ChevronUp } from "lucide-react";

// Define the type for the stats state
interface PlayerStatsMap {
  [playerId: number]: MatchPlayerStatRow;
}

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
  // Local "played" state per player
  const [playedMap, setPlayedMap] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const a of associations) init[a.player.id] = participants.has(a.player.id);
    return init;
  });

  // Track which players are expanded
  const [expandedPlayers, setExpandedPlayers] = React.useState<Record<number, boolean>>({});
  
  // Initialize player stats with existing data or empty
  const [playerStats, setPlayerStats] = React.useState<PlayerStatsMap>(() => {
    const initStats: PlayerStatsMap = {};
    associations.forEach(assoc => {
      const stats = existing.get(assoc.player.id);
      if (stats) {
        initStats[assoc.player.id] = stats;
      }
    });
    return initStats;
  });

  const setPlayed = (playerId: number, next: boolean) =>
    setPlayedMap((m) => ({ ...m, [playerId]: next }));

  const toggleExpanded = (playerId: number) =>
    setExpandedPlayers((m) => ({ ...m, [playerId]: !m[playerId] }));

  // Handle changes in player stats
  const handleStatChange = (playerId: number, statName: string, value: string) => {
    setPlayerStats((prevStats) => {
      const newStats = { ...prevStats };
      const playerStat = { ...newStats[playerId], [statName]: value };
      newStats[playerId] = playerStat;
      return newStats;
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {teamName}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({associations.length} players)
          </span>
        </h3>

        {!readOnly && (
          <AddPlayerToTeamLauncher
            teamId={Number(teamId)}
            label="Add player"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          />
        )}
      </div>

      {/* Accordion list of players */}
      <div className="space-y-2">
        {associations.map((assoc) => {
          const p: any = assoc.player;
          const stats = playerStats[p.id] || existing.get(p.id);
          const baseStats = `players[${teamId}][${p.id}]`;
          const basePart = `participants[${teamId}][${p.id}]`;
          const playedOn = !!playedMap[p.id];
          const isExpanded = !!expandedPlayers[p.id];

          const posVal = stats?.position ?? "";
          const capDefault = !!stats?.is_captain;
          const gkDefault = !!stats?.gk;

          // Ensure all values are strings when passed to inputs
          const goals = String(stats?.goals ?? 0);
          const assists = String(stats?.assists ?? 0);
          const ownGoals = String(stats?.own_goals ?? 0);
          const yc = String(stats?.yellow_cards ?? 0);
          const rc = String(stats?.red_cards ?? 0);
          const bc = String(stats?.blue_cards ?? 0);

          return (
            <div
              key={p.id}
              className={`rounded-lg border ${
                playedOn ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-white"
              }`}
            >
              {/* Player Header - Always visible */}
              <div
                className="flex cursor-pointer items-center justify-between p-3 hover:bg-gray-50/50"
                onClick={() => toggleExpanded(p.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Participation checkbox */}
                  <input
                    type="hidden"
                    name={`${basePart}[played]`}
                    defaultValue="false"
                  />
                  <input
                    type="checkbox"
                    name={`${basePart}[played]`}
                    value="true"
                    checked={playedOn}
                    onChange={(e) => {
                      e.stopPropagation();
                      setPlayed(p.id, e.currentTarget.checked);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    disabled={readOnly}
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Player name */}
                  <div className="font-medium text-gray-900">
                    {p.first_name} {p.last_name}
                  </div>

                  {/* Quick stats badges */}
                  {playedOn && (
                    <div className="flex items-center gap-2 text-xs">
                      {stats?.goals ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                          {stats.goals} ⚽
                        </span>
                      ) : null}
                      {stats?.is_captain && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                          C
                        </span>
                      )}
                      {stats?.gk && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                          GK
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expand/Collapse icon */}
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>

              {/* Player Details - Collapsible */}
              <div className={`transition-all duration-300 ${isExpanded ? 'block' : 'hidden'}`}>
                <div className="border-t border-gray-200 bg-white p-4">
                  {/* Hidden inputs */}
                  <input type="hidden" name={`${baseStats}[team_id}`} defaultValue={String(teamId)} />
                  <input type="hidden" name={`${baseStats}[player_id}`} defaultValue={String(p.id)} />
                  <input type="hidden" name={`${baseStats}[goals]`} value="0" />
                  <input type="hidden" name={`${baseStats}[assists]`} value="0" />
                  <input type="hidden" name={`${baseStats}[own_goals]`} value="0" />
                  <input type="hidden" name={`${baseStats}[yellow_cards]`} value="0" />
                  <input type="hidden" name={`${baseStats}[red_cards]`} value="0" />
                  <input type="hidden" name={`${baseStats}[blue_cards]`} value="0" />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Position */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Position
                      </label>
                      <input
                        type="text"
                        name={`${baseStats}[position]`}
                        value={posVal}
                        placeholder="e.g. FW, MF, DF, GK"
                        onChange={(e) => handleStatChange(p.id, 'position', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        readOnly={readOnly || !playedOn}
                      />
                    </div>

                    {/* Captain & GK checkboxes */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Roles
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="hidden" name={`${baseStats}[is_captain]`} value="false" />
                          <input
                            type="checkbox"
                            name={`${baseStats}[is_captain]`}
                            checked={capDefault}
                            onChange={(e) => handleStatChange(p.id, 'is_captain', e.target.checked.toString())}
                            disabled={readOnly || !playedOn}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">Captain</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="hidden" name={`${baseStats}[gk]`} value="false" />
                          <input
                            type="checkbox"
                            name={`${baseStats}[gk]`}
                            checked={gkDefault}
                            onChange={(e) => handleStatChange(p.id, 'gk', e.target.checked.toString())}
                            disabled={readOnly || !playedOn}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">Goalkeeper</span>
                        </label>
                      </div>
                    </div>

                    {/* Goals */}
                    <StatInput
                      label="Goals"
                      name={`${baseStats}[goals]`}
                      value={goals}
                      onChange={(e) => handleStatChange(p.id, 'goals', e.target.value)}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Assists */}
                    <StatInput
                      label="Assists"
                      name={`${baseStats}[assists]`}
                      value={assists}
                      onChange={(e) => handleStatChange(p.id, 'assists', e.target.value)}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Own Goals */}
                    <StatInput
                      label="Own Goals"
                      name={`${baseStats}[own_goals]`}
                      value={ownGoals}
                      onChange={(e) => handleStatChange(p.id, 'own_goals', e.target.value)}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Yellow Cards */}
                    <StatInput
                      label="Yellow Cards"
                      name={`${baseStats}[yellow_cards]`}
                      value={yc}
                      onChange={(e) => handleStatChange(p.id, 'yellow_cards', e.target.value)}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Red Cards */}
                    <StatInput
                      label="Red Cards"
                      name={`${baseStats}[red_cards]`}
                      value={rc}
                      onChange={(e) => handleStatChange(p.id, 'red_cards', e.target.value)}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Blue Cards */}
                    <StatInput
                      label="Blue Cards"
                      name={`${baseStats}[blue_cards]`}
                      value={bc}
                      onChange={(e) => handleStatChange(p.id, 'blue_cards', e.target.value)}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* MVP */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Awards
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="mvp_player_id"
                            value={String(p.id)}
                            defaultChecked={Boolean(stats?.mvp)}
                            disabled={readOnly || !playedOn}
                            className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">MVP</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="best_gk_player_id"
                            value={String(p.id)}
                            defaultChecked={Boolean(stats?.best_goalkeeper)}
                            disabled={readOnly || !playedOn}
                            className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">Best GK</span>
                        </label>
                      </div>
                    </div>

                    {/* Clear/Delete */}
                    {!readOnly && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Actions
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="hidden" name={`${baseStats}[_delete]`} defaultValue="false" />
                          <input
                            type="checkbox"
                            name={`${baseStats}[_delete]`}
                            value="true"
                            defaultChecked={false}
                            disabled={!playedOn}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-700">Clear all stats</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Stat input component */
function StatInput({
  label,
  name,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  readOnly: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        name={name}
        value={value}
        type="text"
        inputMode="numeric"
        pattern="\d*"
        onChange={onChange}
        readOnly={readOnly}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
          readOnly ? "bg-gray-50 text-gray-500" : ""
        }`}
      />
    </div>
  );
}
