// src/app/components/Navbar.tsx  (Server Component — no "use client")
//
// Deliberately does NOT read auth cookies: this renders inside the root
// layout, and any cookies()/headers() call here would force every route
// dynamic and void ISR site-wide. NavbarClient resolves the signed-in user
// in the browser on mount (it already refetches via supabase.auth.getUser()
// and subscribes to onAuthStateChange), so cached pages ship the logged-out
// shell and hydrate into the user-specific one.
import { fetchRecentNewsCount } from '@/app/lib/fetchRecentNewsCount';
import NavbarClient from '@/app/lib/Navbar/NavbarClient';

export default async function Navbar() {
  const newsCount = await fetchRecentNewsCount();

  return <NavbarClient initialUser={null} newsCount={newsCount} />;
}
