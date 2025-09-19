import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";
import SelectRow, { Option } from "../../../../../tournoua/[slug]/components/teams/Knockout/SelectRow";

export default function EditablePairCard({
  match,
  teamsMap,
  L,
  makeOptions,
  onAssign,
  onSwap,
  disableA = false,
  disableB = false,
}: {
  match: Match; // bracket shape (has team_a_id / team_b_id)
  teamsMap: TeamsMap;
  L: Labels;
  makeOptions: (
    currentTeamId: number | null
  ) => Array<{ id: number | null; label: string; disabled: boolean; reason?: string }>;
  onAssign: (matchId: number, slot: "A" | "B", id: number | null) => void;
  onSwap?: (matchId: number) => void;
  /** NEW: lock an individual slot if it comes from a previous match */
  disableA?: boolean;
  disableB?: boolean;
}) {
  const teamA = match.team_a_id != null ? teamsMap[match.team_a_id] : undefined;
  const teamB = match.team_b_id != null ? teamsMap[match.team_b_id] : undefined;

  const optsA: Option[] = makeOptions(match.team_a_id);
  const optsB: Option[] = makeOptions(match.team_b_id);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>{L.pair(teamA?.seed ?? null, teamB?.seed ?? null)}</span>
        {onSwap && (
          <button
            onClick={() => onSwap(match.id)}
            className="px-1.5 py-0.5 rounded border border-white/10 hover:border-white/25 text-white/70 hover:text-white"
            title={L.swap}
            type="button"
          >
            ↔
          </button>
        )}
      </div>

      <SelectRow
        value={match.team_a_id}
        options={optsA}
        placeholder={teamA?.name ?? L.pickTeam}
        selectedSeed={teamA?.seed ?? null}
        disabled={disableA}
        onChange={(val) => onAssign(match.id, "A", val)}
      />

      <SelectRow
        value={match.team_b_id}
        options={optsB}
        placeholder={teamB?.name ?? L.pickTeam}
        selectedSeed={teamB?.seed ?? null}
        disabled={disableB}
        onChange={(val) => onAssign(match.id, "B", val)}
      />
    </div>
  );
}
