// matches/[id]/StatsEditor.tsx
"use client";

import * as React from "react";
import AddPlayerToTeamLauncher from "./AddPlayerToTeamLauncher";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";
import { ChevronDown, ChevronUp } from "lucide-react";

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


  const setPlayed = (playerId: number, next: boolean) =>
    setPlayedMap((m) => ({ ...m, [playerId]: next }));

  const toggleExpanded = (playerId: number) =>
    setExpandedPlayers((m) => ({ ...m, [playerId]: !m[playerId] }));

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
          const stats = existing.get(p.id);
          const baseStats = `players[${teamId}][${p.id}]`;
          const basePart = `participants[${teamId}][${p.id}]`;
          const playedOn = !!playedMap[p.id];
          const isExpanded = !!expandedPlayers[p.id];

          const posVal = stats?.position ?? "";
          const capDefault = !!stats?.is_captain;
          const gkDefault = !!stats?.gk;

          const goalsDefault = String(stats?.goals ?? 0);
          const assistsDefault = String(stats?.assists ?? 0);
          const ownGoalsDefault = String(stats?.own_goals ?? 0);
          const ycDefault = String(stats?.yellow_cards ?? 0);
          const rcDefault = String(stats?.red_cards ?? 0);
          const bcDefault = String(stats?.blue_cards ?? 0);

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
              {isExpanded && (
                <div className="border-t border-gray-200 bg-white p-4">
                  {/* Hidden inputs */}
                  <input type="hidden" name={`${baseStats}[team_id]`} defaultValue={String(teamId)} />
                  <input type="hidden" name={`${baseStats}[player_id]`} defaultValue={String(p.id)} />
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
                        defaultValue={posVal}
                        placeholder="e.g. FW, MF, DF, GK"
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
                            defaultChecked={capDefault}
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
                            defaultChecked={gkDefault}
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
                      defaultValue={goalsDefault}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Assists */}
                    <StatInput
                      label="Assists"
                      name={`${baseStats}[assists]`}
                      defaultValue={assistsDefault}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Own Goals */}
                    <StatInput
                      label="Own Goals"
                      name={`${baseStats}[own_goals]`}
                      defaultValue={ownGoalsDefault}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Yellow Cards */}
                    <StatInput
                      label="Yellow Cards"
                      name={`${baseStats}[yellow_cards]`}
                      defaultValue={ycDefault}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Red Cards */}
                    <StatInput
                      label="Red Cards"
                      name={`${baseStats}[red_cards]`}
                      defaultValue={rcDefault}
                      readOnly={readOnly || !playedOn}
                    />

                    {/* Blue Cards */}
                    <StatInput
                      label="Blue Cards"
                      name={`${baseStats}[blue_cards]`}
                      defaultValue={bcDefault}
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
              )}
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
  defaultValue,
  readOnly,
}: {
  label: string;
  name: string;
  defaultValue: string;
  readOnly: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        name={name}
        defaultValue={defaultValue}
        type="text"
        inputMode="numeric"
        pattern="\d*"
        readOnly={readOnly}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
          readOnly ? "bg-gray-50 text-gray-500" : ""
        }`}
      />
    </div>
  );
}