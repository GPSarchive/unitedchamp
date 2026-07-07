// TEMPORARY: auth guard disabled for preview inspection.
// This UI is slated to replace /dashboard/tournaments, whose layout
// (src/app/dashboard/layout.tsx) already enforces the admin guard — restore
// that guard here if the preview lives longer than the inspection phase.
// NOTE: mutations still go through the existing server actions / API routes,
// which enforce their own auth.

export const dynamic = "force-dynamic";

export default function TournamentBuilderPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-dvh bg-black">{children}</div>;
}
