// src/app/components/Navbar.tsx  (Server Component — no "use client")
import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import NavbarClient from '@/app/lib/Navbar/NavbarClient'; // <-- updated path to match your file location

async function fetchNewsCount(): Promise<number> {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoISO = twoDaysAgo.toISOString();

  const [{ count: announcementsCount }, { count: articlesCount }] = await Promise.all([
    supabaseAdmin
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', twoDaysAgoISO),
    supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', twoDaysAgoISO),
  ]);

  return (announcementsCount ?? 0) + (articlesCount ?? 0);
}

export default async function Navbar() {
  const supabase = await createSupabaseRSCClient();
  const { data: { user } } = await supabase.auth.getUser();
  const newsCount = await fetchNewsCount();

  return <NavbarClient initialUser={user ?? null} newsCount={newsCount} />;
}
