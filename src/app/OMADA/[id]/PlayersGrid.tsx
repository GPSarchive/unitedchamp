import Image from "next/image";
import {
  FaUser,
  FaRulerVertical,
  FaBirthdayCake,
  FaFutbol,
  FaHandsHelping,
  FaExclamationTriangle,
  FaTimesCircle,
  FaCircle,
  FaUsers,
} from "react-icons/fa";
import { PlayerAssociation } from "@/app/lib/types";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

interface PlayersGridProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
  teamLogo?: string | null;
}

const DEV = process.env.NODE_ENV !== "production";

export default function PlayersGrid({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
  teamLogo,
}: PlayersGridProps) {
  if (errorMessage) {
    return <p className="text-red-400">Error loading players: {errorMessage}</p>;
  }

  if (!playerAssociations || playerAssociations.length === 0) {
    return <p className="text-zinc-400">No players currently on this team.</p>;
  }

  return (
    <section className="rounded-[32px] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-8 shadow-[0_45px_140px_-70px_rgba(255,80,50,0.6)] backdrop-blur-2xl">
      <div className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400/80 to-rose-500/60 text-black shadow-[0_18px_35px_-22px_rgba(255,149,50,0.7)]">
          <FaUsers className="text-xl" />
        </span>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Squad</h2>
          <p className="text-sm text-zinc-400">
            Player profiles, match impact and honours in a fresh, cinematic layout.
          </p>
        </div>
      </div>

      <div className="grid justify-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {playerAssociations.map((assoc) => {
          const p = assoc.player;

          const stats =
            p.player_statistics?.[0] ?? {
              age: null,
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

          const birthDate = p.birth_date
            ? new Date(p.birth_date).toLocaleDateString("el-GR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : null;

          const latestSeason = perSeason[0] ?? null;
          const resolvedPhoto = resolvePlayerPhotoUrl(p.photo);
          const usesPlaceholder =
            !p.photo ||
            p.photo === "/player-placeholder.jpg" ||
            resolvedPhoto.includes("/player-placeholder.jpg");
          const photoUrl = usesPlaceholder && teamLogo ? teamLogo : resolvedPhoto;

          return (
            <article
              key={p.id}
              className="group flex w-full max-w-[240px] flex-col overflow-hidden rounded-[30px] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent shadow-[0_40px_120px_-65px_rgba(255,80,50,0.7)] transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_60px_140px_-70px_rgba(255,110,70,0.9)]"
            >
              <div className="relative w-full">
                <div className="relative aspect-[4/5] w-full">
                  <Image
                    src={photoUrl}
                    alt={`${p.first_name} ${p.last_name}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-90 mix-blend-soft-light" />
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-6 px-6 py-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">
                      {p.first_name} {p.last_name}
                    </h3>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">Active Player</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-200">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 shadow-[0_12px_30px_-18px_rgba(255,120,80,0.8)]">
                      <FaUser className="text-orange-300" />
                      {p.position ?? "—"}
                    </span>
                    {p.height_cm && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 shadow-[0_12px_30px_-18px_rgba(255,120,80,0.5)]">
                        <FaRulerVertical className="text-orange-200" />
                        {p.height_cm}cm
                      </span>
                    )}
                    {birthDate && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 shadow-[0_12px_30px_-18px_rgba(255,120,80,0.5)]">
                        <FaBirthdayCake className="text-rose-200" />
                        {birthDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-gradient-to-br from-orange-500/25 via-orange-500/15 to-orange-500/10 px-4 py-5 text-center text-xs text-zinc-200 shadow-[0_25px_60px_-40px_rgba(255,140,90,0.8)]">
                    <FaFutbol className="mx-auto text-lg text-orange-200" />
                    <p className="mt-2 text-xl font-semibold text-white">{stats.total_goals ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-[0.22em]">Goals</p>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-400/25 via-emerald-400/15 to-emerald-400/10 px-4 py-5 text-center text-xs text-zinc-200 shadow-[0_25px_60px_-40px_rgba(90,220,170,0.7)]">
                    <FaHandsHelping className="mx-auto text-lg text-emerald-200" />
                    <p className="mt-2 text-xl font-semibold text-white">{stats.total_assists ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-[0.22em]">Assists</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] px-4 py-5 text-center text-xs text-zinc-200 shadow-[0_25px_60px_-40px_rgba(255,255,255,0.35)]">
                    <div className="flex items-center justify-center gap-3 text-base">
                      <FaExclamationTriangle className="text-yellow-300" />
                      <FaTimesCircle className="text-red-400" />
                      <FaCircle className="text-sky-300" />
                    </div>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {(stats.yellow_cards ?? 0) + (stats.red_cards ?? 0) + (stats.blue_cards ?? 0)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em]">Cards</p>
                  </div>
                </div>

                {latestSeason && (
                  <div className="rounded-2xl bg-white/[0.05] px-5 py-4 text-sm text-zinc-200 shadow-[0_25px_60px_-40px_rgba(255,255,255,0.35)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                      <span>{latestSeason.season}</span>
                      <span>{latestSeason.matches} Matches</span>
                      <span>
                        Updated {latestSeason.updated_at ? new Date(latestSeason.updated_at).toLocaleDateString("el-GR") : "—"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <FaFutbol className="text-orange-300" />
                        {latestSeason.goals} G / {latestSeason.assists} A
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FaExclamationTriangle className="text-yellow-300" />
                        {latestSeason.yellow_cards}/{latestSeason.red_cards}/{latestSeason.blue_cards}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FaUsers className="text-rose-200" /> MVP {latestSeason.mvp} · GK {latestSeason.best_gk}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {DEV && (
                <div className="mt-2 bg-black/60 px-6 py-3 text-[11px] text-zinc-500">
                  <span className="font-semibold uppercase tracking-[0.22em]">Image Source</span>: {photoUrl}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
