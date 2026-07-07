// Builder 2.0 entry — tournament picker (mirrors src/app/dashboard/tournaments/page.tsx)
// plus create mode. Edit deep-links live at ./[id].
import { Suspense } from "react";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import BuilderShell from "./builder/BuilderShell";

export const dynamic = "force-dynamic";

export default async function TournamentBuilderPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ new?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const startNew = sp.new === "1";

  if (startNew) {
    return (
      <Suspense>
        <BuilderShell mode="create" />
      </Suspense>
    );
  }

  const { data: tournamentsList, error } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[preview/tournament-builder] tournaments error", error);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 text-white">
      <h1 className="text-xl font-bold tracking-tight">Tournament Builder 2.0</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Επίλεξε διοργάνωση για επεξεργασία ή ξεκίνα μία καινούρια.
      </p>

      <a
        href="/preview/tournament-builder?new=1"
        className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
      >
        ➕ Νέα διοργάνωση
      </a>

      <ul className="mt-5 space-y-2">
        {(tournamentsList ?? []).map((t) => {
          const created = t.created_at ? new Date(t.created_at).toLocaleDateString("el-GR") : "—";
          return (
            <li key={t.id}>
              <a
                href={`/preview/tournament-builder/${t.id}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0d0f14] px-4 py-3 hover:border-indigo-500/40 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{t.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {t.slug ? `${t.slug} · ` : ""}δημιουργία {created}
                  </span>
                </span>
                <span className="text-zinc-600">→</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
