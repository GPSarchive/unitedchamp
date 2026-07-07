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

// ---------------------------------------------------------------------------
// Match-wide award selection (MVP / Best GK).
//
// These are radio-style awards: at most one player per match. Plain HTML radios
// can't be unticked once selected (and offer no "none"), so admins reported
// being unable to clear a Best GK / MVP pick. We drive them with shared React
// state instead, scoped across BOTH team editors (they live in one form), so
// clicking the already-selected player toggles the award back off.
// ---------------------------------------------------------------------------
type AwardKey = "mvp" | "best_gk";

interface AwardContextValue {
  selected: Record<AwardKey, number | null>;
  toggle: (award: AwardKey, playerId: number) => void;
}

const AwardContext = React.createContext<AwardContextValue | null>(null);

export function MatchAwardsProvider({
  initialMvpPlayerId = null,
  initialBestGkPlayerId = null,
  children,
}: {
  initialMvpPlayerId?: number | null;
  initialBestGkPlayerId?: number | null;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = React.useState<Record<AwardKey, number | null>>({
    mvp: initialMvpPlayerId,
    best_gk: initialBestGkPlayerId,
  });

  const toggle = React.useCallback((award: AwardKey, playerId: number) => {
    setSelected((prev) => ({
      ...prev,
      // Re-clicking the current holder clears the award; otherwise reassign.
      [award]: prev[award] === playerId ? null : playerId,
    }));
  }, []);

  return (
    <AwardContext.Provider value={{ selected, toggle }}>
      {/* Single hidden field per award carries the form value; "" → null server-side. */}
      <input type="hidden" name="mvp_player_id" value={selected.mvp ?? ""} />
      <input type="hidden" name="best_gk_player_id" value={selected.best_gk ?? ""} />
      {children}
    </AwardContext.Provider>
  );
}

function useAwards(): AwardContextValue {
  const ctx = React.useContext(AwardContext);
  if (ctx) return ctx;
  // Fallback for any standalone usage without the provider: no-op selection.
  return { selected: { mvp: null, best_gk: null }, toggle: () => {} };
}

export default function StatsEditor({
  teamId,
  teamName,
  associations,
  existing,
  participants,
  duplicatePlayerIds,
  readOnly = false,
}: {
  teamId: Id;
  teamName: string;
  associations: PlayerAssociation[];
  existing: Map<number, MatchPlayerStatRow>;
  participants: Map<number, ParticipantRow>;
  duplicatePlayerIds?: Set<number>;
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

  // Match-wide award selection, shared across both team editors via context.
  const { selected: selectedAwards, toggle: toggleAward } = useAwards();

  // Boolean role state (captain / goalkeeper) kept separate from the string-based
  // playerStats map. These checkboxes must be driven by real booleans — storing
  // them as "true"/"false" strings broke the controlled `checked` value (every
  // non-empty string is truthy), which made the boxes untoggleable on iOS Safari.
  const [captainMap, setCaptainMap] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const a of associations) init[a.player.id] = !!existing.get(a.player.id)?.is_captain;
    return init;
  });
  const [gkMap, setGkMap] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const a of associations) init[a.player.id] = !!existing.get(a.player.id)?.gk;
    return init;
  });

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

  const setCaptain = (playerId: number, next: boolean) =>
    setCaptainMap((m) => ({ ...m, [playerId]: next }));

  const setGk = (playerId: number, next: boolean) =>
    setGkMap((m) => ({ ...m, [playerId]: next }));

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
          const capOn = !!captainMap[p.id];
          const gkOn = !!gkMap[p.id];

          // Ensure all values are strings when passed to inputs
          const goals = String(stats?.goals ?? 0);
          const assists = String(stats?.assists ?? 0);
          const ownGoals = String(stats?.own_goals ?? 0);
          const yc = String(stats?.yellow_cards ?? 0);
          const rc = String(stats?.red_cards ?? 0);
          const bc = String(stats?.blue_cards ?? 0);
          const playerNumber = String(stats?.player_number ?? "");

          // Check if this player appears on both rosters
          const isDuplicatePlayer = duplicatePlayerIds?.has(p.id) ?? false;

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

                  {/* Warning badge for players on both rosters */}
                  {isDuplicatePlayer && (
                    <span
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-300"
                      title="Ο παίκτης βρίσκεται και στις δύο ομάδες. Επισημάνετε συμμετοχή μόνο σε ΜΙΑ ομάδα."
                    >
                      ⚠️ Δύο Ομάδες
                    </span>
                  )}

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
                  <input type="hidden" name={`${baseStats}[player_number]`} value="" />

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
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        readOnly={readOnly || !playedOn}
                      />
                    </div>

                    {/* Player Number */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Player Number
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        name={`${baseStats}[player_number]`}
                        value={playerNumber}
                        placeholder="e.g. 10"
                        onChange={(e) => handleStatChange(p.id, 'player_number', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                            value="true"
                            checked={capOn}
                            onChange={(e) => setCaptain(p.id, e.currentTarget.checked)}
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
                            value="true"
                            checked={gkOn}
                            onChange={(e) => setGk(p.id, e.currentTarget.checked)}
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

                    {/* MVP / Best GK — radio-style awards. Click the selected
                        player again to clear the award (plain radios can't do
                        this, which is why admins couldn't un-pick a Best GK). */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Awards
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={selectedAwards.mvp === p.id}
                            readOnly
                            onClick={() => {
                              if (readOnly || !playedOn) return;
                              toggleAward("mvp", p.id);
                            }}
                            disabled={readOnly || !playedOn}
                            className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">MVP</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={selectedAwards.best_gk === p.id}
                            readOnly
                            onClick={() => {
                              if (readOnly || !playedOn) return;
                              toggleAward("best_gk", p.id);
                            }}
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
          readOnly ? "bg-gray-50 text-gray-500" : "bg-white text-gray-900"
        }`}
      />
    </div>
  );
}
