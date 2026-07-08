"use client";

import { ChevronRight } from "lucide-react";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import Badge from "../../ui/Badge";

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  // Wall-clock display (match dates are literal, never tz-converted)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function TeamRow({
  name,
  logo,
  score,
  sourceLabel,
}: {
  name: string;
  logo: string | null;
  score: number | null;
  sourceLabel?: string | null;
}) {
  const isTbd = name === "—" && !!sourceLabel;
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-500">
          {isTbd ? "?" : name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          isTbd ? "italic text-zinc-500" : "font-medium text-white"
        }`}
      >
        {isTbd ? sourceLabel : name}
      </span>
      <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-white">
        {score != null ? score : <span className="text-zinc-600">–</span>}
      </span>
    </div>
  );
}

export default function MatchCard({
  match,
  nameOf,
  onOpen,
  homeSourceLabel,
  awaySourceLabel,
  subtitle,
}: {
  match: DraftMatch;
  nameOf: (id: number | string | null) => { name: string; logo: string | null };
  onOpen: () => void;
  /** KO only: "Νικητής R1·B2" style labels shown when the team slot is TBD */
  homeSourceLabel?: string | null;
  awaySourceLabel?: string | null;
  /** extra line under the date (e.g. group name) */
  subtitle?: string | null;
}) {
  const m = match as any;
  const a = nameOf(match.team_a_id ?? null);
  const b = nameOf(match.team_b_id ?? null);
  const finished = m.status === "finished";
  const date = fmtDate(match.match_date);

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-xl border border-white/8 bg-[#0d0f14] p-3 text-left transition-colors hover:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <TeamRow
            name={a.name}
            logo={a.logo}
            score={finished ? m.team_a_score ?? null : null}
            sourceLabel={homeSourceLabel}
          />
          <TeamRow
            name={b.name}
            logo={b.logo}
            score={finished ? m.team_b_score ?? null : null}
            sourceLabel={awaySourceLabel}
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={finished ? "emerald" : "neutral"}>
            {finished ? "Ολοκληρώθηκε" : "Προγρ/μένος"}
          </Badge>
          <ChevronRight size={16} className="text-zinc-600" />
        </div>
      </div>
      {(date || m.field || subtitle) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-white/5 pt-2 text-xs text-zinc-500">
          {date && <span>{date}</span>}
          {m.field && <span>📍 {m.field}</span>}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </button>
  );
}
