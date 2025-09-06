// src/app/components/NavbarClient.tsx
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { motion, useReducedMotion } from 'framer-motion';
import { useStagedHeaderMotion } from '@/app/lib/useStagedHeaderMotion'; // ensure this file is also "use client"
import { createSupabaseBrowserClient } from '@/app/lib/supabaseBrowser';

const tile =
  "relative group block shrink-0 w-[300px] h-[90px] rounded-xl overflow-hidden " +
  "border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 " +
  "hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transition-all duration-300 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export default function NavbarClient({ initialUser }: { initialUser: User | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = (href: string) => (pathname === href ? 'page' : undefined);

  // hydrate from server (no flash), then keep in sync on the client
  const [user, setUser] = useState<User | null>(initialUser);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let ignore = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!ignore) setUser(user ?? null);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!ignore) setUser(session?.user ?? null);
    });

    return () => {
      ignore = true;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  // safe next = current path + query
  const next = useMemo(() => {
    const q = searchParams?.toString();
    return pathname + (q ? `?${q}` : '');
  }, [pathname, searchParams]);

  const { stage, scrolled } = useStagedHeaderMotion({
    activateAt: 72, jitter: 6, peekAfterPx: 36, hideAfterPx: 120, revealAfterPx: 28
  });

  const prefersReduced = useReducedMotion();
  const variants = { visible: { y: 0 }, peek: { y: '-50%' }, hidden: { y: '-100%' } } as const;

  return (
    <motion.header
      aria-label="Site header"
      initial={false}
      animate={prefersReduced ? 'visible' : stage}
      variants={variants}
      transition={prefersReduced ? { duration: 0 } : { type: 'tween', duration: 0.28, ease: [0.22,1,0.36,1] }}
      className="sticky top-0 z-50"
      data-stage={stage}
      data-scrolled={scrolled}
    >
      <nav
        aria-label="Main"
        className="relative isolate w-full h-32 md:h-32 flex items-center justify-between px-4 sm:px-6 lg:px-8
                   text-white crimson-kintsugi nav-blur edge-glow border-b border-white/10 overflow-hidden
                   transition-[background-color,backdrop-filter,box-shadow,border-color,height] duration-300
                   data-[scrolled=true]:bg-black/60 data-[scrolled=true]:backdrop-blur-md
                   data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.35)]
                   data-[scrolled=true]:border-white/15
                   data-[scrolled=true]:h-28 md:data-[scrolled=true]:h-32"
      >
        {/* Animation background inside the nav (no negative z) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
          <svg className="kintsugi-svg w-full h-full mix-blend-screen" viewBox="0 0 1440 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f6e27a" />
                <stop offset="35%" stopColor="#e8c66a" />
                <stop offset="65%" stopColor="#caa94d" />
                <stop offset="100%" stopColor="#f6e27a" />
                <animate attributeName="x1" values="0;0.2;0" dur="9s" repeatCount="indefinite" />
                <animate attributeName="x2" values="1;0.8;1" dur="9s" repeatCount="indefinite" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d="M-20,120 C180,40 360,200 560,90 C760,-10 960,220 1160,120 C1300,60 1460,120 1500,80"
              fill="none" stroke="url(#gold)" strokeWidth="2.5" strokeLinecap="round" strokeOpacity=".9"
              filter="url(#glow)" strokeDasharray="10 18">
              <animate attributeName="stroke-dashoffset" from="420" to="0" dur="10s" repeatCount="indefinite" />
            </path>
            <path d="M-40,170 C120,110 300,160 520,140 C740,120 900,40 1140,80 C1300,110 1480,60 1520,20"
              fill="none" stroke="url(#gold)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity=".85"
              filter="url(#glow)" strokeDasharray="8 20">
              <animate attributeName="stroke-dashoffset" from="620" to="0" dur="12s" repeatCount="indefinite" />
            </path>
            <path d="M-30,40 C160,90 340,20 520,70 C700,120 900,10 1140,60 C1300,95 1500,40 1540,70"
              fill="none" stroke="url(#gold)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity=".75"
              filter="url(#glow)" strokeDasharray="6 16">
              <animate attributeName="stroke-dashoffset" from="540" to="0" dur="8s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>

        <div className="grain-layer" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/20" />

        {/* Left: tiles */}
        <div className="relative z-10 flex gap-4 items-center">
          {[
            { href: "/home", label: "HOME", img: "/field2.jpg" },
            { href: "/anakoinoseis", label: "ΑΝΑΚΟΙΝΩΣΕΙΣ", img: "/navbar7.jpg" },
            { href: "/OMADES", label: "ΟΜΑΔΕΣ", img: "/omades.jpg" },
            { href: "/tournoua", label: "ΤΟΥΡΝΟΥΑ", img: "/NavbarTournoua.jpg" },
            { href: "/epikoinonia", label: "ΕΠΙΚΟΙΝΩΝΙΑ", img: "/epikoinonia.jpg" },
          ].map(({ href, label, img }) => (
            <Link key={href} href={href} aria-current={isActive(href)} className={tile}>
              <Image src={img} alt={label} fill sizes="300px"
                     className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-110" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-md bg-black/30 px-3 py-1 text-white text-lg font-semibold tracking-wide backdrop-blur-[2px]">
                  {label}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {/* Right: session-aware control */}
        <div className="relative z-10 flex items-center gap-3">
        {user ? (
          <>
            {(() => {
              const m = (user?.user_metadata ?? {}) as Record<string, any>;
              const avatarUrl: string | undefined = m.avatar_url || m.picture; // google often uses "picture"

              return (
                <Link
                  href="/dashboard"
                  className="inline-flex flex-col items-center bg-black/60 gap-1 rounded-full border border-white/15  px-3 py-2 hover:bg-white/5 transition min-w-0"
                  aria-label={`Account: ${user.email ?? 'Unknown user'}`}
                  title={user.email ?? 'Account'}
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profile photo"
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  ) : (
                    // fallback icon if no avatar
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden className="opacity-90">
                      <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"/>
                    </svg>
                  )}

                  <span className="text-[11px] leading-tight opacity-90 max-w-40 truncate">
                    {user.email ?? 'Account'}
                  </span>
                </Link>
              );
            })()}

            <form method="post" action="/api/auth/sign-out">
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 transition"
                aria-label="Sign out"
              >
                Sign out
              </button>
            </form>
          </>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 transition"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </motion.header>
  )
}
