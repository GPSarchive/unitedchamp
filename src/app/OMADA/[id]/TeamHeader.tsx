// app/OMADA/[id]/TeamHeader.tsx
import { Team } from "@/app/lib/types";
import LightRays from "./react-bits/LightRays";

export default function TeamHeader({ team }: { team: Team }) {
  const established = team.created_at
    ? new Date(team.created_at).toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Unknown";

  const yearsActive = team.created_at
    ? Math.max(new Date().getFullYear() - new Date(team.created_at).getFullYear(), 0)
    : null;

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-10 shadow-[0_45px_120px_-70px_rgba(255,160,70,0.85)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,170,90,0.22),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.18),transparent_50%)]" />

      <div className="relative flex flex-col gap-10 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <div className="relative shrink-0">
            <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-[26px] border border-white/15 bg-black/40 p-1 shadow-[0_30px_80px_-45px_rgba(255,155,60,0.95)]">
              <LightRays
                className="absolute inset-0 h-full w-full rounded-[22px] pointer-events-none mix-blend-screen"
                raysOrigin="top-center"
                raysColor="#ffd9a6"
                raysSpeed={1.15}
                lightSpread={0.95}
                rayLength={1.5}
                followMouse
                mouseInfluence={0.18}
                noiseAmount={0.07}
                distortion={0.02}
                logoSrc={team.logo ?? "/placeholder-logo.png"}
                logoStrength={2.1}
                logoFit="cover"
                logoScale={1}
                popIn
                popDuration={700}
                popDelay={80}
                popScaleFrom={0.88}
              />
            </div>
            <div className="absolute -bottom-6 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-orange-500/40 blur-3xl" aria-hidden />
          </div>

          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-zinc-200">
              Squad dossier
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {team.name}
            </h1>
            <p className="text-sm text-zinc-300">
              Established <span className="font-medium text-white/90">{established}</span>
              {yearsActive ? (
                <span className="text-zinc-500"> · {yearsActive}+ seasons of competition</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:w-auto">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Registry ID</p>
            <p className="mt-2 text-2xl font-semibold text-white">{team.am ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(125,255,195,0.35)]">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">Season score</p>
            <p className="mt-2 text-2xl font-semibold text-white">{team.season_score ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Seasons active</p>
            <p className="mt-2 text-2xl font-semibold text-white">{yearsActive ? `${yearsActive}+` : "—"}</p>
            <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-400/80">Competitive campaigns</p>
          </div>
        </div>
      </div>
    </section>
  );
}
