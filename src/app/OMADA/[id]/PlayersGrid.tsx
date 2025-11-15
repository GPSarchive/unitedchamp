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
}

const DEV = process.env.NODE_ENV !== "production";

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
    <section className="rounded-[32px] border border-white/10 bg-black/40 p-8 shadow-[0_35px_120px_-60px_rgba(255,130,20,0.55)] backdrop-blur-xl">
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

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {playerAssociations.map((assoc) => {
          const p = assoc.player;
          const photoUrl = resolvePlayerPhotoUrl(p.photo);

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

          return (
            <article
              key={p.id}
              className="group flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-zinc-950/90 via-zinc-950/60 to-zinc-900/40 shadow-[0_35px_70px_-60px_rgba(255,150,60,0.85)] transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_55px_110px_-70px_rgba(255,165,80,0.95)]"
            >
              <div className="relative">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={photoUrl}
                    alt={`${p.first_name} ${p.last_name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />
                  <div
                    className="absolute inset-0 opacity-0 mix-blend-screen blur-3xl transition-opacity duration-700 group-hover:opacity-40"
                    style={{
                      background:
                        "radial-gradient(circle at 20% 20%, rgba(255,165,72,0.35), transparent 55%), radial-gradient(circle at 80% 0%, rgba(255,82,82,0.45), transparent 55%)",
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pb-3 pt-6">
                    <span className="text-[10px] uppercase tracking-[0.35em] text-white/70">Active Player</span>
                    {latestSeason && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] text-zinc-200 shadow-[0_10px_35px_-25px_rgba(255,170,90,0.9)]">
                        Season {latestSeason.season}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white sm:text-2xl">
                      {p.first_name} {p.last_name}
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        <FaUser className="text-orange-300" />
                        {p.position ?? "—"}
                      </span>
                      {p.height_cm && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.04] px-3 py-1">
                          <FaRulerVertical className="text-orange-200" />
                          {p.height_cm}cm
                        </span>
                      )}
                      {birthDate && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.04] px-3 py-1">
                          <FaBirthdayCake className="text-rose-200" />
                          {birthDate}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-[7.5rem] rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-right text-[11px] text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <p className="uppercase tracking-[0.28em] text-zinc-500">Updated</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {latestSeason?.updated_at
                        ? new Date(latestSeason.updated_at).toLocaleDateString("el-GR")
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs text-zinc-300">
                  <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,175,95,0.28)]">
                    <FaFutbol className="mx-auto text-base text-orange-200" />
                    <p className="mt-2 text-lg font-semibold text-white">{stats.total_goals ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-[0.22em]">Goals</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-4 shadow-[inset_0_1px_0_rgba(125,255,195,0.22)]">
                    <FaHandsHelping className="mx-auto text-base text-emerald-200" />
                    <p className="mt-2 text-lg font-semibold text-white">{stats.total_assists ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-[0.22em]">Assists</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <div className="flex items-center justify-center gap-3 text-sm">
                      <FaExclamationTriangle className="text-yellow-300" />
                      <FaTimesCircle className="text-red-400" />
                      <FaCircle className="text-sky-300" />
                    </div>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {(stats.yellow_cards ?? 0) + (stats.red_cards ?? 0) + (stats.blue_cards ?? 0)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em]">Cards</p>
                  </div>
                </div>

                {latestSeason && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] text-zinc-200">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                      <span>{latestSeason.season}</span>
                      <span>{latestSeason.matches} Matches</span>
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
                <div className="border-t border-white/5 bg-black/60 px-5 py-3 text-[11px] text-zinc-500">
                  <span className="font-semibold uppercase tracking-[0.22em]">Image URL</span>: {photoUrl}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
