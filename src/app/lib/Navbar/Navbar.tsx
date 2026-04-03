// src/app/components/Navbar.tsx  (Server Component — no "use client")
import { fetchRecentNewsCount } from '@/app/lib/fetchRecentNewsCount';
import NavbarClient from '@/app/lib/Navbar/NavbarClient';

export default async function Navbar() {
  const newsCount = await fetchRecentNewsCount();

  return <NavbarClient initialUser={null} newsCount={newsCount} />;
}
