// src/app/components/Navbar.tsx  (Server Component — no "use client")
import { createSupabaseRSCClient } from '@/app/lib/supabaseServer';
import NavbarClient from '@/app/lib/Navbar/NavbarClient'; // <-- updated path to match your file location

export default async function Navbar() {
  const supabase = await createSupabaseRSCClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <NavbarClient initialUser={user ?? null} />;
}
