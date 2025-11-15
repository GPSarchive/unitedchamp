import Image from "next/image";
import { Team } from "@/app/lib/types";

type TeamHeaderProps = {
  team: Team;
  playersCount: number;
  tournamentsCount: number;
  winsCount: number;
};

const formatter = new Intl.DateTimeFormat("el-GR", {
  year: "numeric",
  month: "long",
  day: "2-digit",
});

export default function TeamHeader({
  team,
  playersCount,
  tournamentsCount,
  winsCount,
}: TeamHeaderProps) {
  const established = team.created_at ? formatter.format(new Date(team.created_at)) : null;

  return (
    <header className="rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 shadow-[0_30px_60px_rgba(2,6,23,0.45)] md:p-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 ring-1 ring-slate-700 md:h-28 md:w-28">
            {team.logo ? (
              <Image
                src={team.logo}
                alt={team.name ?? "Team logo"}
                width={112}
                height={112}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                No Logo
              </span>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Team profile</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-5xl">
              {team.name}
            </h1>
            <p className="mt-3 text-sm text-slate-400">
              Established {established ?? "—"}
            </p>
          </div>
        </div>

        <dl className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
          <Metric label="Season score" value={team.season_score ?? 0} />
          <Metric label="Players" value={playersCount} />
          <Metric label="Tournaments" value={tournamentsCount} />
          <Metric label="Titles" value={winsCount} />
        </dl>
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold text-white">{value}</dd>
    </div>
  );
}