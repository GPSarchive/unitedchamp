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
      <div className="mb-10 flex items-center gap-3">
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

      <div className="space-y-8">
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

          return (
            <article
              key={p.id}
              className="group overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-950/90 via-zinc-950/60 to-zinc-900/50 shadow-[0_40px_90px_-70px_rgba(255,125,45,0.85)] transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_60px_110px_-65px_rgba(255,150,50,0.9)]"
            >
              <div className="relative">
                <div className="relative aspect-[17/10] w-full overflow-hidden">
                  <Image
                    src={photoUrl}
                    alt={`${p.first_name} ${p.last_name}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 900px"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute inset-0 opacity-0 mix-blend-screen blur-3xl transition-opacity duration-700 group-hover:opacity-40" style={{
                    background:
                      "radial-gradient(circle at 20% 20%, rgba(255,165,72,0.35), transparent 55%), radial-gradient(circle at 80% 0%, rgba(255,82,82,0.45), transparent 55%)",
                  }} />
                </div>

                <div className="space-y-7 px-6 pb-8 pt-8 sm:px-10">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">Active Player</p>
                      <h3 className="mt-1 text-3xl font-semibold text-white sm:text-4xl">
                        {p.first_name} {p.last_name}
                      </h3>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          <FaUser className="text-orange-300" />
                          {p.position ?? "—"}
                        </span>
                        {p.height_cm && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.04] px-3 py-1">
                            <FaRulerVertical className="text-orange-200" />
                            {p.height_cm}cm
                          </span>
                        )}
                        {birthDate && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.04] px-3 py-1">
                            <FaBirthdayCake className="text-rose-200" />
                            {birthDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right text-sm text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Latest Update</p>
                      <p className="text-base font-medium text-white">
                        {perSeason?.[0]?.updated_at
                          ? new Date(perSeason[0].updated_at).toLocaleDateString("el-GR")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-orange-400/20 bg-orange-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,155,80,0.3)]">
                      <div className="flex items-center justify-between text-sm text-orange-200">
                        <span className="font-semibold uppercase tracking-[0.15em]">Goals</span>
                        <FaFutbol className="text-lg" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-white">{stats.total_goals ?? 0}</p>
                      <p className="text-xs text-orange-100/70">Across recorded club competitions</p>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 shadow-[inset_0_1px_0_rgba(125,255,195,0.28)]">
                      <div className="flex items-center justify-between text-sm text-emerald-200">
                        <span className="font-semibold uppercase tracking-[0.15em]">Assists</span>
                        <FaHandsHelping className="text-lg" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-white">{stats.total_assists ?? 0}</p>
                      <p className="text-xs text-emerald-100/70">Chances created converted to goals</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-center text-xs text-zinc-300">
                      <div className="rounded-xl bg-yellow-500/10 py-3">
                        <FaExclamationTriangle className="mx-auto text-yellow-400" />
                        <p className="mt-1 text-lg font-semibold text-white">{stats.yellow_cards ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em]">YC</p>
                      </div>
                      <div className="rounded-xl bg-red-500/10 py-3">
                        <FaTimesCircle className="mx-auto text-red-400" />
                        <p className="mt-1 text-lg font-semibold text-white">{stats.red_cards ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em]">RC</p>
                      </div>
                      <div className="rounded-xl bg-sky-500/10 py-3">
                        <FaCircle className="mx-auto text-sky-300" />
                        <p className="mt-1 text-lg font-semibold text-white">{stats.blue_cards ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em]">BC</p>
                      </div>
                    </div>
                  </div>

                  {perSeason.length > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Season snapshots</p>
                      <div className="mt-4 grid gap-3 text-sm text-zinc-200 md:grid-cols-2">
                        {perSeason.map((row, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-white/5 bg-black/40 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                          >
                            <div className="flex items-center justify-between text-xs text-zinc-500">
                              <span className="font-semibold tracking-[0.2em]">{row.season}</span>
                              <span className="uppercase tracking-[0.2em]">{row.matches} matches</span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-zinc-300">
                              <span className="inline-flex items-center gap-2">
                                <FaFutbol className="text-orange-300" />
                                {row.goals} G / {row.assists} A
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <FaExclamationTriangle className="text-yellow-300" />
                                {row.yellow_cards}/{row.red_cards}/{row.blue_cards}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <FaUsers className="text-rose-200" /> MVP {row.mvp} · GK {row.best_gk}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {DEV && (
                <div className="border-t border-white/5 bg-black/60 px-6 py-3 text-[11px] text-zinc-500">
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
