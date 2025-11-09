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
  // Local "played" state per player
  const [playedMap, setPlayedMap] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const a of associations) init[a.player.id] = participants.has(a.player.id);
    return init;
  });

  const setPlayed = (playerId: number, next: boolean) =>
    setPlayedMap((m) => ({ ...m, [playerId]: next }));

  return (
    <div className="overflow-hidden rounded-xl border border-amber-700/50 bg-neutral-900/80 p-4 backdrop-blur">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-white">
          {teamName} – Edit participants & stats{" "}
          <span className="text-xs text-amber-300/70">(players: {associations.length})</span>
        </h3>

        {!readOnly && (
          <AddPlayerToTeamLauncher
            teamId={Number(teamId)}
            label="Add player"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-600/40 bg-amber-600/20 px-3 py-2 text-sm text-amber-100 hover:bg-amber-600/30"
          />
        )}
      </div>

      {/* Horizontal scroll wrapper for table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[900px] space-y-3">
          {/* Desktop headers */}
          <div className="hidden md:grid md:grid-cols-[70px_minmax(140px,1fr)_80px_50px_50px_repeat(6,56px)_80px_98px_60px] md:gap-2 md:px-1 md:text-xs md:font-medium md:text-amber-300/80">
            <div>Συμ.</div>
            <div>Player</div>
            <div>Pos</div>
            <div>Cap</div>
            <div>GK</div>
            <div>Goals</div>
            <div>Assist</div>
            <div>Own G</div>
            <div>Yellow</div>
            <div>Red</div>
            <div>Blue</div>
            <div>MVP</div>
            <div>Best GK</div>
            <div>Clear</div>
          </div>

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
            const ownGoalsDefault = String(stats?.own_goals ?? 0);
            const ycDefault = String(stats?.yellow_cards ?? 0);
            const rcDefault = String(stats?.red_cards ?? 0);
            const bcDefault = String(stats?.blue_cards ?? 0);

            return (
              <div
                key={p.id}
                className="
                  rounded-lg border border-amber-800/40 bg-neutral-950/60 p-3
                  grid gap-2
                  md:grid-cols-[70px_minmax(140px,1fr)_80px_50px_50px_repeat(6,56px)_80px_98px_60px]
                  md:items-center md:gap-2
                "
              >
                {/* Συμμετοχή */}
                <div className="flex items-center md:block">
                  <input type="hidden" name={`${basePart}[played]`} defaultValue="false" />
                  <input
                    type="checkbox"
                    name={`${basePart}[played]`}
                    value="true"
                    checked={playedOn}
                    onChange={(e) => setPlayed(p.id, e.currentTarget.checked)}
                    aria-label="Συμμετοχή"
                    disabled={readOnly}
                    className="h-4 w-4 rounded border-amber-600 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="ml-2 text-xs text-amber-200 md:hidden">Συμμετοχή</span>
                </div>

                {/* Player */}
                <div className="min-w-0 truncate font-medium text-white">
                  {p.first_name} {p.last_name}
                  <input type="hidden" name={`${baseStats}[team_id]`} defaultValue={String(teamId)} />
                  <input type="hidden" name={`${baseStats}[player_id]`} defaultValue={String(p.id)} />
                </div>

                {/* Position */}
                <div>
                  <input
                    type="text"
                    name={`${baseStats}[position]`}
                    defaultValue={posVal}
                    placeholder="TBD"
                    className="w-full rounded border border-amber-700/40 bg-neutral-800 px-2 py-1 text-sm text-white placeholder:text-amber-300/40 focus:border-amber-500 focus:outline-none md:w-20"
                    readOnly={readOnly || !playedOn}
                  />
                </div>

                {/* Captain */}
                <div className="flex items-center gap-2 md:block">
                  <input type="hidden" name={`${baseStats}[is_captain]`} value="false" />
                  <input
                    type="checkbox"
                    name={`${baseStats}[is_captain]`}
                    defaultChecked={capDefault}
                    disabled={readOnly || !playedOn}
                    aria-label="Captain"
                    className="h-4 w-4 rounded border-amber-600 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-xs text-amber-200 md:hidden">Cap</span>
                </div>

                {/* GK */}
                <div className="flex items-center gap-2 md:block">
                  <input type="hidden" name={`${baseStats}[gk]`} value="false" />
                  <input
                    type="checkbox"
                    name={`${baseStats}[gk]`}
                    defaultChecked={gkDefault}
                    disabled={readOnly || !playedOn}
                    aria-label="GK"
                    className="h-4 w-4 rounded border-amber-600 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-xs text-amber-200 md:hidden">GK</span>
                </div>

                {/* Hidden numeric fallbacks */}
                <input type="hidden" name={`${baseStats}[goals]`} value="0" />
                <input type="hidden" name={`${baseStats}[assists]`} value="0" />
                <input type="hidden" name={`${baseStats}[own_goals]`} value="0" />
                <input type="hidden" name={`${baseStats}[yellow_cards]`} value="0" />
                <input type="hidden" name={`${baseStats}[red_cards]`} value="0" />
                <input type="hidden" name={`${baseStats}[blue_cards]`} value="0" />

                {/* Stats */}
                <NumInput name={`${baseStats}[goals]`} def={goalsDefault} readOnly={!playedOn || readOnly} labelMD="Goals" labelSM="Goals" />
                <NumInput name={`${baseStats}[assists]`} def={assistsDefault} readOnly={!playedOn || readOnly} labelMD="Assists" labelSM="Assists" />
                <NumInput name={`${baseStats}[own_goals]`} def={ownGoalsDefault} readOnly={!playedOn || readOnly} labelMD="Own G" labelSM="Own G" />
                <NumInput name={`${baseStats}[yellow_cards]`} def={ycDefault} readOnly={!playedOn || readOnly} labelMD="Yellow" labelSM="Yellow" />
                <NumInput name={`${baseStats}[red_cards]`} def={rcDefault} readOnly={!playedOn || readOnly} labelMD="Red" labelSM="Red" />
                <NumInput name={`${baseStats}[blue_cards]`} def={bcDefault} readOnly={!playedOn || readOnly} labelMD="Blue" labelSM="Blue" />

                {/* MVP */}
                <div>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="mvp_player_id"
                      value={String(p.id)}
                      defaultChecked={Boolean(stats?.mvp)}
                      aria-label="MVP"
                      disabled={readOnly || !playedOn}
                      className="h-4 w-4 border-amber-600 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs text-amber-200 md:hidden">MVP</span>
                  </label>
                </div>

                {/* Best GK */}
                <div>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="best_gk_player_id"
                      value={String(p.id)}
                      defaultChecked={Boolean(stats?.best_goalkeeper)}
                      aria-label="Best Goalkeeper"
                      disabled={readOnly || !playedOn}
                      className="h-4 w-4 border-amber-600 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs text-amber-200 md:hidden">Best GK</span>
                  </label>
                </div>

                {/* Clear */}
                <div>
                  {!readOnly && (
                    <>
                      <input type="hidden" name={`${baseStats}[_delete]`} defaultValue="false" />
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          name={`${baseStats}[_delete]`}
                          value="true"
                          defaultChecked={false}
                          aria-label="Clear row"
                          disabled={!playedOn}
                          className="h-4 w-4 rounded border-amber-600 bg-neutral-800 text-red-500 focus:ring-red-500"
                        />
                        <span className="text-xs text-amber-200 md:hidden">Clear</span>
                      </label>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Numeric input unified */
function NumInput({
  name,
  def,
  readOnly,
  labelMD,
  labelSM,
}: {
  name: string;
  def: string;
  readOnly: boolean;
  labelMD?: string;
  labelSM?: string;
}) {
  return (
    <div className="flex items-center gap-2 md:block">
      <input
        name={name}
        defaultValue={def}
        className={`w-14 rounded border border-amber-700/40 bg-neutral-800 px-2 py-1 text-sm text-white focus:border-amber-500 focus:outline-none ${readOnly ? "opacity-50" : ""}`}
        type="text"
        inputMode="numeric"
        pattern="\d*"
        readOnly={readOnly}
        aria-label={labelMD ?? ""}
      />
      <span className="text-xs text-amber-200 md:hidden">{labelSM ?? ""}</span>
    </div>
  );
}