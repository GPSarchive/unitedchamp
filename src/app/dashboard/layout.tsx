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
  if (!roles.includes("admin")) redirect("/403");

  return (
    <ClientShell userEmail={user.email ?? "—"}>
      {children}
    </ClientShell>
  );
}