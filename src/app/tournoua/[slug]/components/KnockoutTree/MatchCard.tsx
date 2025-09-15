// app/tournoua/[slug]/components/teams/KnockoutTreeComponents/MatchCard.tsx
"use client";

import type { BracketMatch as Match, TeamsMap, Labels } from "@/app/lib/types";
import MatchRow from "@/app/tournoua/[slug]/components/teams/KnockoutTreeComponents/MatchRow";

export default function MatchCard({
  match,
  teamsMap,
  labels,
  transformY = 0,
  minCardHeight = 76,
  onClick,
  setRef,
  statusText,
  statusClasses,
  byeTop,
  byeBottom,
}: {
  match: Match;
  teamsMap: TeamsMap;
  labels: Labels;
  transformY?: number;
  minCardHeight?: number;
  onClick?: () => void;
  setRef?: (el: HTMLDivElement | null) => void;
  statusText: (s?: string) => string;
  statusClasses: (s?: string) => { chip: string; card: string };
  byeTop?: string | null;
  byeBottom?: string | null;
}) {
  const isFinished = (match.status as string) === "finished";
  const s = statusClasses(match.status as string);

  return (
    <div
      ref={setRef}
      onClick={onClick}
      className={[
        "group relative rounded-xl border bg-gradient-to-br",
        "from-slate-900/80 via-slate-900/60 to-slate-800/60",
        "hover:border-white/25 hover:shadow-lg transition-colors p-3 will-change-transform",
        s.card,
      ].join(" ")}
      style={{ minHeight: minCardHeight, transform: `translateY(${transformY}px)` }}
    >
      {/* Status chip */}
      <span
        className={[
          "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
          s.chip,
        ].join(" ")}
        title={statusText(match.status as string)}
      >
        {statusText(match.status as string)}
      </span>

      <MatchRow
        id={match.team_a_id}
        score={isFinished ? match.team_a_score : null}
        teamsMap={teamsMap}
        tbdText={labels.tbd}
        byeBadge={byeTop ?? null}
      />
      <div className="h-1" />
      <MatchRow
        id={match.team_b_id}
        score={isFinished ? match.team_b_score : null}
        teamsMap={teamsMap}
        tbdText={labels.tbd}
        byeBadge={byeBottom ?? null}
      />
    </div>
  );
}
