// Admin guard — mirrors src/app/dashboard/layout.tsx (keep in sync if that
// guard ever changes). The builder preview mutates real data, so it must be
// gated exactly like the dashboard.
import { redirect } from "next/navigation";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";

export const dynamic = "force-dynamic";

export default async function TournamentBuilderPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseRSCClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/preview/tournament-builder");

  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  if (!roles.includes("admin")) redirect("/403");

  return <div className="min-h-dvh bg-black">{children}</div>;
}
