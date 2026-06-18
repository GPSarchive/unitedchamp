// src/app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";
import ClientShell from "./ui/ClientShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const supabase = await createSupabaseRSCClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  const isAdmin = roles.includes("admin");
  const isEditor = roles.includes("editor");
  // Editors are allowed in (the middleware scopes which sub-routes they can
  // load); everyone else without admin is rejected.
  if (!isAdmin && !isEditor) redirect("/403");

  // Editor-only users see a trimmed nav (Articles + Announcements).
  const editorOnly = !isAdmin && isEditor;

  return (
    <ClientShell userEmail={user.email ?? "—"} editorOnly={editorOnly}>
      {children}
    </ClientShell>
  );
}