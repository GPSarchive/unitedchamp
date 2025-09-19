// app/components/DashboardPageComponents/TournamentCURD/stages/KnockoutTree/MatchRow.tsx
import type { TeamsMap } from "@/app/lib/types";

/**
 * Row for a single side of a match card.
 * - `byeBadge`: shows BYE label if the team advanced without playing the previous round.
 * - `derived`: when true, shows a subtle chip meaning this team is *virtually progressed*
 *   from a parent (computed in UI), not persisted to DB yet.
 */
export default function MatchRow({
  id,
  score,
  teamsMap,
  tbdText,
  byeBadge,
  derived = false,
}: {
  id: number | null;
  score: number | null;
  teamsMap: TeamsMap;
  tbdText: string;
  byeBadge?: string | null;
  derived?: boolean;
}) {
  const team = id != null ? teamsMap[id] : undefined;
  const seed = team?.seed;

  const showDerived = derived && id != null;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {seed != null && (
          <span className="px-1.5 py-0.5 text-[10px] rounded-full border border-white/15 text-white/70 bg-white/5">
            #{seed}
          </span>
        )}

        <span className={`truncate font-medium ${!team ? "text-white/70 italic" : ""}`}>
          {team?.name ?? tbdText}
        </span>

        {byeBadge && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded-md border border-cyan-400/30 text-cyan-200 bg-cyan-400/10"
            title={
              byeBadge === "BYE"
                ? "Advanced without playing previous round"
                : "Πέρασε χωρίς αγώνα"
            }
          >
            {byeBadge}
          </span>
        )}

        {showDerived && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded-md border border-amber-400/30 text-amber-200 bg-amber-400/10"
            title="Progressed from parent winner (virtual; not saved to DB)"
          >
            via W
          </span>
        )}
      </div>

      <span className="text-sm tabular-nums">{score == null ? "–" : score}</span>
    </div>
  );
}
