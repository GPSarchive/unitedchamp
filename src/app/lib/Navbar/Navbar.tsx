// src/app/components/Navbar.tsx  (Server Component — no "use client")
import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';
import { fetchRecentNewsCount } from '@/app/lib/fetchRecentNewsCount';
import NavbarClient from '@/app/lib/Navbar/NavbarClient'; // <-- updated path to match your file location

export default async function Navbar() {
  const supabase = await createSupabaseRSCClient();
  const [{ data: { user } }, newsCount] = await Promise.all([
    supabase.auth.getUser(),
    fetchRecentNewsCount(),
  ]);

  return <NavbarClient initialUser={user ?? null} newsCount={newsCount} />;
}
