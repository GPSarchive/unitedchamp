// app/tournoua/[slug]/layout.tsx
import Link from "next/link";
import Image from "next/image";
import { getTournamentBySlug, getStagesAndGroups } from "@/app/lib/repos/tournaments";

export default async function TournouaSlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>; // Next.js 15: params is a Promise
  children: React.ReactNode;
}) {
  const { slug } = await params;

  const [t, sg] = await Promise.all([getTournamentBySlug(slug), getStagesAndGroups(slug)]);
  if (!t) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  // Since layouts can't read searchParams, fall back to defaults:
  const stageId = Number(sg.stages[0]?.id ?? 0);
  const groupId = 0;

  const buildQS = (next: Record<string, any>) => {
    const q = new URLSearchParams();
    const sid = next.stage_id ?? stageId;
    const gid = next.group_id ?? groupId;
    if (sid) q.set("stage_id", String(sid));
    if (gid) q.set("group_id", String(gid));
    return q.toString();
  };

  return (
    <div className="min-h-screen">
      <div className="px-6 py-8 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-black/40">
            <Image src={t.logo || "/placeholder.png"} alt={t.name} fill className="object-contain" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t.name}</h1>
            <p className="text-white/70">
              {t.season ?? "—"} • {String(t.format).toUpperCase()} • {t.status}
            </p>
          </div>
        </div>

        <nav className="mt-6 flex gap-3 text-sm">
          {[
            ["", "Overview"],
            ["standings", "Standings"],
            ["fixtures", "Αγωνιστικές"],
            ["bracket", "Bracket"],
            ["teams", "Ομάδες"],
            ["players", "Παίκτες"],
            ["history", "Ιστορικό"],
          ].map(([seg, label]) => (
            <Link
              key={seg}
              href={`/tournoua/${t.slug}/${seg}?${buildQS({})}`}
              className="rounded-md border border-white/15 px-3 py-1 hover:bg-white/10"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Stage:</span>
            <div className="flex flex-wrap gap-2">
              {sg.stages.map((s: any) => (
                <Link
                  key={s.id}
                  href={`?${buildQS({ stage_id: s.id, group_id: 0 })}`}
                  className={`px-2 py-1 rounded border ${
                    stageId === s.id ? "border-white/80" : "border-white/20 hover:bg-white/10"
                  }`}
                >
                  {s.name} ({s.kind})
                </Link>
              ))}
            </div>
          </div>

          {!!(sg.groupsByStage[stageId]?.length) && (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">Όμιλος:</span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`?${buildQS({ group_id: 0 })}`}
                  className={`px-2 py-1 rounded border ${
                    groupId ? "border-white/20 hover:bg-white/10" : "border-white/80"
                  }`}
                >
                  Όλοι
                </Link>
                {sg.groupsByStage[stageId].map((g: any) => (
                  <Link
                    key={g.id}
                    href={`?${buildQS({ group_id: g.id })}`}
                    className={`px-2 py-1 rounded border ${
                      groupId === g.id ? "border-white/80" : "border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}
