// src/app/lib/Navbar/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useStagedHeaderMotion } from "@/app/lib/framermotion/useStagedHeaderMotion"; // ensure this file is also "use client"
import { createSupabaseBrowserClient } from "@/app/lib/supabase/supabaseBrowser";

/* ===================== Data ===================== */
const NAV_LINKS = [
  { href: "/home",            label: "HOME",                     img: "/field2.jpg" },
  { href: "/anakoinoseis",    label: "ΑΝΑΚΟΙΝΩΣΕΙΣ",             img: "/ανακοινωσεις.jpg" },
  { href: "/OMADES",          label: "ΟΜΑΔΕΣ",                   img: "/Ομαδες.jpg" },
  { href: "/tournaments",        label: "ΤΟΥΡΝΟΥΑ",                 img: "/τουρνουα.jpg" },
  { href: "/epikoinonia",     label: "ΕΠΙΚΟΙΝΩΝΙΑ",              img: "/επικοινωνια.jpg" },

  // NEW
  { href: "/paiktes",                   label: "ΠΑΙΚΤΕΣ",                 img: "/παικτες.jpg" },
  { href: "/agones",                    label: "ΑΓΩΝΕΣ",                  img: "/αγωνες.jpg" },
  { href: "/geniki-katataxi",           label: "ΓΕΝΙΚΗ ΚΑΤΑΤΑΞΗ",         img: "/γενικη-καταταξη.jpg" },
  { href: "/kanonismos",                label: "ΚΑΝΟΝΙΣΜΟΣ",              img: "/κανονισμος.jpg" },
  //{ href: "/gallery",                   label: "GALLERY",                 img: "/gallery.jpg" },
  //{ href: "/meikti-omada-ultrachamp",   label: "ΜΕΙΚΤΗ ΟΜΑΔΑ ULTRACHAMP", img: "/μεικτη-ομαδα.jpg" },
  //{ href: "/elliniki-omada-f7",         label: "ΕΛΛΗΝΙΚΗ ΟΜΑΔΑ F7",       img: "/ελλινικη-ομαδα.jpg" },
] as const;

/* ===================== Styles ===================== */
const tile =
  "relative group block shrink-0 rounded-xl overflow-hidden " +
  "border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 " +
  "hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transition-all duration-300 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
  "w-[180px] h-[64px] md:w-[260px] md:h-[84px] xl:w-[300px] xl:h-[90px]";

export default function NavbarClient({ initialUser }: { initialUser: User | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = (href: string) => (pathname === href ? "page" : undefined);

  // hydrate user from server, then keep in sync on client
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
    return pathname + (q ? `?${q}` : "");
  }, [pathname, searchParams]);

  /* Staged header behavior */
  const { stage, scrolled } = useStagedHeaderMotion({
    activateAt: 72, jitter: 6, peekAfterPx: 36, hideAfterPx: 120, revealAfterPx: 28,
  });

  const prefersReduced = useReducedMotion();

  /* Mobile menu state */
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = () => setMobileOpen(v => !v);
  const closeMobile = () => setMobileOpen(false);

  const variants = {
    visible: { y: 0 },
    peek: { y: "-50%" },
    hidden: { y: "-100%" },
  } as const;

  return (
    <motion.header
      aria-label="Site header"
      initial={false}
      animate={prefersReduced ? "visible" : stage}
      variants={variants}
      transition={prefersReduced ? { duration: 0 } : { type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50"
      data-stage={stage}
      data-scrolled={scrolled}
    >
      <nav
        aria-label="Main"
        className={`
          relative isolate w-full
          h-16 md:h-32
          flex items-center justify-between
          px-3 sm:px-4 lg:px-8
          text-white crimson-kintsugi nav-blur edge-glow
          border-b border-white/10 overflow-hidden
          transition-[background-color,backdrop-filter,box-shadow,border-color,height] duration-300
          data-[scrolled=true]:bg-black/60 data-[scrolled=true]:backdrop-blur-md
          data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.35)]
          data-[scrolled=true]:border-white/15
          data-[scrolled=true]:h-14 md:data-[scrolled=true]:h-28
        `}
      >
        {/* Animated background */}
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
              fill="none" stroke="url(#gold)" strokeWidth="2.2" strokeLinecap="round" strokeOpacity=".9"
              filter="url(#glow)" strokeDasharray="10 18">
              <animate attributeName="stroke-dashoffset" from="420" to="0" dur="10s" repeatCount="indefinite" />
            </path>
            <path d="M-40,170 C120,110 300,160 520,140 C740,120 900,40 1140,80 C1300,110 1480,60 1520,20"
              fill="none" stroke="url(#gold)" strokeWidth="1.7" strokeLinecap="round" strokeOpacity=".85"
              filter="url(#glow)" strokeDasharray="8 20">
              <animate attributeName="stroke-dashoffset" from="620" to="0" dur="12s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>

        <div className="grain-layer" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/20" />

        {/* Left: Brand (mobile) + Desktop tile group */}
        <div className="relative z-10 flex items-center gap-3">
          {/* Mobile brand (hidden on md+) */}
          <Link href="/home" className="flex items-center gap-2 md:hidden">
            <Image
              src="/UltraChampLogo.png" alt="Ultra Champ" width={28} height={28}
              className="rounded-sm shadow" priority
            />
            <span className="text-base font-semibold tracking-wide">Ultra Champ</span>
          </Link>

          {/* Desktop tile links — horizontally scrollable with invisible scrollbar */}
          <div
            className={`
              hidden md:flex items-center gap-4
              overflow-x-auto desktop-scroll pr-1
              max-w-[78vw] lg:max-w-[82vw] xl:max-w-[86vw]
            `}
            role="list"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map(({ href, label, img }) => (
              <Link key={href} href={href} aria-current={isActive(href)} className={tile} role="listitem">
                <Image
                  src={img}
                  alt={label}
                  fill
                  sizes="(min-width: 1280px) 300px, (min-width: 768px) 260px, 180px"
                  className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-110"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="rounded-md bg-black/30 px-3 py-1 text-white text-lg font-semibold tracking-wide backdrop-blur-[2px]">
                    {label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Session + Mobile Menu Button */}
        <div className="relative z-10 flex items-center gap-2 md:gap-3">
          {/* Desktop session controls */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {(() => {
                  const m = (user?.user_metadata ?? {}) as Record<string, any>;
                  const avatarUrl: string | undefined = m.avatar_url || m.picture;
                  return (
                    <Link
                      href="/dashboard"
                      className="inline-flex flex-col items-center bg-black/60 gap-1 rounded-full border border-white/15 px-3 py-2 hover:bg-white/5 transition min-w-0"
                      aria-label={`Account: ${user.email ?? "Unknown user"}`}
                      title={user.email ?? "Account"}
                    >
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="Profile photo" width={24} height={24} className="rounded-full" />
                      ) : (
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden className="opacity-90">
                          <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"/>
                        </svg>
                      )}
                      <span className="text-[11px] leading-tight opacity-90 max-w-40 truncate">
                        {user.email ?? "Account"}
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

          {/* Mobile: avatar or login (compact) */}
          <div className="md:hidden">
            {user ? (
              <Link
                href="/dashboard"
                aria-label="Account"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 size-9"
                title={user.email ?? "Account"}
              >
                {(() => {
                  const m = (user?.user_metadata ?? {}) as Record<string, any>;
                  const avatarUrl: string | undefined = m.avatar_url || m.picture;
                  return avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={24} height={24} className="rounded-full" />
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="opacity-90">
                      <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"/>
                    </svg>
                  );
                })()}
              </Link>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                aria-label="Login"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 size-9"
                title="Login"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="opacity-90">
                  <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"/>
                </svg>
              </Link>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={toggleMobile}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className="md:hidden inline-flex items-center justify-center size-9 rounded-full border border-white/25 bg-black/40 hover:bg-white/10 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path
                fill="currentColor"
                d={mobileOpen
                  ? "M6 6 L18 18 M18 6 L6 18"
                  : "M4 7h16v2H4V7Zm0 4h16v2H4v-2Zm0 4h16v2H4v-2Z"
                }
                stroke="currentColor"
                strokeWidth={mobileOpen ? 2 : 0}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* ======= Mobile dropdown ======= */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.24 }}
            className={`
              md:hidden overflow-hidden
              border-b border-white/15
              bg-zinc-950/90 backdrop-blur-md text-white
            `}
          >
            {/* horizontally scrollable cards on mobile (scrollbar hidden via global class) */}
            <div className="flex items-stretch gap-3 px-3 py-3 overflow-x-auto no-scrollbar">
              {NAV_LINKS.map(({ href, label, img }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobile}
                  aria-current={isActive(href)}
                  className={`
                    relative group block shrink-0 w-[200px] h-[70px] rounded-lg overflow-hidden
                    border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900
                    hover:border-white/30 transition
                  `}
                >
                  <Image
                    src={img} alt={label} fill sizes="200px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded bg-black/30 px-2.5 py-0.5 text-white text-sm font-semibold tracking-wide backdrop-blur-[2px]">
                      {label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Mobile sign out / login in the dropdown */}
            <div className="px-3 pb-3">
              {user ? (
                <form method="post" action="/api/auth/sign-out">
                  <button
                    type="submit"
                    className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 transition"
                    aria-label="Sign out"
                    onClick={closeMobile}
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(next)}`}
                  className="block w-full text-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 transition"
                  onClick={closeMobile}
                >
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======= Scrollbar HIDDEN on desktop horizontal row ======= */}
      <style jsx>{`
  .desktop-scroll {
    /* keeps layout from jumping when the bar shows */
    scrollbar-gutter: stable both-edges;

    /* prevents the page from also scrolling when you drag sideways */
    overscroll-behavior-x: contain;

    /* Firefox */
    scrollbar-width: thin; /* thin | auto | none */
    scrollbar-color: rgba(255,255,255,0.45) transparent;
  }
  .desktop-scroll:hover {
    /* brighter thumb on hover (Firefox) */
    scrollbar-color: rgba(255,255,255,0.70) transparent;
  }

  /* Chromium/Safari */
  .desktop-scroll::-webkit-scrollbar {
    height: 6px; /* thin horizontal bar */
  }
  .desktop-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .desktop-scroll::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.5));
    border-radius: 9999px;            /* pill shape */
    border: 2px solid transparent;    /* inner padding so it looks lighter */
    background-clip: padding-box;     /* keep gradient crisp */
  }
  .desktop-scroll:hover::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.75));
  }
`}</style>
    </motion.header>
  );
}
