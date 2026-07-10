// TEMPORARY: auth guard disabled for preview inspection.
// This UI is slated to replace /dashboard/tournaments, whose layout
// (src/app/dashboard/layout.tsx) already enforces the admin guard — restore
// that guard here if the preview lives longer than the inspection phase.
// NOTE: mutations still go through the existing server actions / API routes,
// which enforce their own auth.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TournamentBuilderPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-black">
      {/* Uniform back-nav — the preview lives outside the /dashboard route
          group, so it doesn't inherit ClientShell's sidebar. */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur px-3 md:px-6 py-3 flex items-center gap-3">
        <Link
          href="/dashboard/tournaments"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Πίνακας Διαχείρισης
        </Link>
        <span className="text-sm font-semibold text-white/90">Tournament Builder 2.0</span>
      </header>
      {children}
    </div>
  );
}
