import type { TeamsMap } from "@/app/lib/types";

export default function MatchRow({
  id,
  score,
  teamsMap,
  tbdText,
  byeBadge,
}: {
  id: number | null;
  score: number | null;
  teamsMap: TeamsMap;
  tbdText: string;
  byeBadge: string | null;
}) {
  const team = id ? teamsMap[id] : undefined;
  const seed = team?.seed;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {seed != null && (
          <span className="px-1.5 py-0.5 text-[10px] rounded-full border border-white/15 text-white/70 bg-white/5">
            #{seed}
          </span>
        )}
        <span className="truncate font-medium">{team?.name ?? tbdText}</span>
        {byeBadge && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded-md border border-cyan-400/30 text-cyan-200 bg-cyan-400/10"
            title={byeBadge === "BYE" ? "Advanced without playing previous round" : "Πέρασε χωρίς αγώνα"}
          >
            {byeBadge}
          </span>
        )}
      </div>
      <span className="text-sm tabular-nums">{score == null ? "–" : score}</span>
    </div>
  );
}
