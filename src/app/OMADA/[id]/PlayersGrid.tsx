import AvatarImage from "./AvatarImage";
import { PlayerAssociation } from "@/app/lib/types";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

interface PlayersGridProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
}

export default function PlayersGrid({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
}: PlayersGridProps) {
  if (errorMessage) {
    return <p className="text-red-400">Error loading players: {errorMessage}</p>;
  }

  if (!playerAssociations || playerAssociations.length === 0) {
    return <p className="text-zinc-400">No players currently on this team.</p>;
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Squad</h2>
          <p className="text-sm text-slate-400">Profiles and key numbers for every active player.</p>
        </div>
        <span className="rounded-full border border-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          {playerAssociations.length} players
        </span>
      </header>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {playerAssociations.map((assoc) => {
          const p = assoc.player;
          const photoUrl = resolvePlayerPhotoUrl(p.photo);

          const stats =
            p.player_statistics?.[0] ?? {
              total_goals: 0,
              total_assists: 0,
              yellow_cards: 0,
              red_cards: 0,
              blue_cards: 0,
            };

          const perSeason = (seasonStatsByPlayer?.[p.id] ?? []) as Array<{
            season: string;
            matches: number;
            goals: number;
            assists: number;
            yellow_cards: number;
            red_cards: number;
            blue_cards: number;
            mvp: number;
            best_gk: number;
            updated_at: string;
          }>;

          const recentSeason = perSeason[0];

          return (
            <li
              key={p.id}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-700 hover:bg-slate-900"
            >
              <div className="flex items-center gap-4">
                <AvatarImage
                  src={photoUrl}
                  alt={`${p.first_name} ${p.last_name}`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-2xl border border-slate-800 object-cover"
                  sizes="56px"
                />
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    {p.position ? <span>{p.position}</span> : null}
                    {p.height_cm ? <span>{p.height_cm} cm</span> : null}
                    {p.birth_date ? (
                      <span>{new Date(p.birth_date).toLocaleDateString("el-GR")}</span>
                    ) : null}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-5 gap-3 text-center text-xs text-slate-400">
                <Stat label="Goals" value={stats.total_goals ?? 0} />
                <Stat label="Assists" value={stats.total_assists ?? 0} />
                <Stat label="Yellow" value={stats.yellow_cards ?? 0} />
                <Stat label="Red" value={stats.red_cards ?? 0} />
                <Stat label="Blue" value={stats.blue_cards ?? 0} />
              </dl>

              {recentSeason ? (
                <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>{recentSeason.season}</span>
                    <span>{recentSeason.matches} matches</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SeasonFact label="Goals" value={recentSeason.goals} />
                    <SeasonFact label="Assists" value={recentSeason.assists} />
                    <SeasonFact
                      label="Cards"
                      value={`${recentSeason.yellow_cards}/${recentSeason.red_cards}/${recentSeason.blue_cards}`}
                    />
                    <SeasonFact
                      label="Awards"
                      value={`MVP ${recentSeason.mvp} • GK ${recentSeason.best_gk}`}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-2 py-3">
      <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-white">{value}</dd>
    </div>
  );
}

function SeasonFact({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-900/80 bg-slate-900/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-200">{value}</p>
    </div>
  );
}
