// src/app/lib/Navbar/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, memo } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useStagedHeaderMotion } from "@/app/lib/framermotion/useStagedHeaderMotion";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/supabaseBrowser";

/* ===================== Data ===================== */
const NAV_LINKS = [
  { href: "/home", label: "HOME", img: "/field2.jpg" },
  { href: "/anakoinoseis", label: "ΑΝΑΚΟΙΝΩΣΕΙΣ", img: "/ανακοινωσεις.jpg" },
  { href: "/OMADES", label: "ΟΜΑΔΕΣ", img: "/Ομαδες.jpg" },
  { href: "/tournaments", label: "ΤΟΥΡΝΟΥΑ", img: "/tournamentPhoto.png" },
  { href: "/epikoinonia", label: "ΕΠΙΚΟΙΝΩΝΙΑ", img: "/επικοινωνια.jpg" },
  { href: "/paiktes", label: "ΠΑΙΚΤΕΣ", img: "/παικτες.jpg" },
  { href: "/agones", label: "ΑΓΩΝΕΣ", img: "/αγωνες.jpg" },
  { href: "/geniki-katataxi", label: "ΓΕΝΙΚΗ ΚΑΤΑΤΑΞΗ", img: "/γενικη-καταταξη.jpg" },
  { href: "/kanonismos", label: "ΚΑΝΟΝΙΣΜΟΣ", img: "/κανονισμος.jpg" },
] as const;

/* ===================== Styles ===================== */
const TILE_CLASS =
  "relative group block shrink-0 rounded-xl overflow-hidden " +
  "border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 " +
  "hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transition-all duration-300 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
  "w-[180px] h-[64px] md:w-[260px] md:h-[84px] xl:w-[300px] xl:h-[90px]";

const MOTION_VARIANTS = {
  visible: { y: 0 },
  peek: { y: "-50%" },
  hidden: { y: "-100%" },
} as const;

/* ===================== Sub-components ===================== */

// Memoized Nav Link Component
const NavLink = memo(({ href, label, img, isActive, onClick }: {
  href: string;
  label: string;
  img: string;
  isActive?: "page";
  onClick?: () => void;
}) => (
  <Link
    href={href}
    aria-current={isActive}
    className={TILE_CLASS}
    role="listitem"
    onClick={onClick}
  >
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
));
NavLink.displayName = "NavLink";

// Memoized Mobile Nav Link
const MobileNavLink = memo(({ href, label, img, isActive, onClick }: {
  href: string;
  label: string;
  img: string;
  isActive?: "page";
  onClick: () => void;
}) => (
  <Link
    href={href}
    onClick={onClick}
    aria-current={isActive}
    className="relative group block w-full h-[70px] rounded-lg overflow-hidden border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 hover:border-white/30 transition active:scale-[0.98]"
  >
    <Image
      src={img}
      alt={label}
      fill
      sizes="100vw"
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="rounded bg-black/30 px-2.5 py-0.5 text-white text-sm font-semibold tracking-wide backdrop-blur-[2px]">
        {label}
      </span>
    </div>
  </Link>
));
MobileNavLink.displayName = "MobileNavLink";

// Memoized User Avatar Component
const UserAvatar = memo(({ user, isMobile }: { user: User; isMobile?: boolean }) => {
  const metadata = user?.user_metadata ?? {};
  const avatarUrl: string | undefined = metadata.avatar_url || metadata.picture;
  
  const avatarContent = avatarUrl ? (
    <Image src={avatarUrl} alt="Profile photo" width={24} height={24} className="rounded-full" />
  ) : (
    <svg viewBox="0 0 24 24" width={isMobile ? 20 : 22} height={isMobile ? 20 : 22} aria-hidden className="opacity-90">
      <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"/>
    </svg>
  );

  if (isMobile) {
    return (
      <Link
        href="/dashboard"
        aria-label="Account"
        className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 size-9"
        title={user.email ?? "Account"}
      >
        {avatarContent}
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      className="inline-flex flex-col items-center bg-black/60 gap-1 rounded-full border border-white/15 px-3 py-2 hover:bg-white/5 transition min-w-0"
      aria-label={`Account: ${user.email ?? "Unknown user"}`}
      title={user.email ?? "Account"}
    >
      {avatarContent}
      <span className="text-[11px] leading-tight opacity-90 max-w-40 truncate">
        {user.email ?? "Account"}
      </span>
    </Link>
  );
});
UserAvatar.displayName = "UserAvatar";

// Memoized Animated Background
const AnimatedBackground = memo(() => (
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
      <path
        d="M-20,120 C180,40 360,200 560,90 C760,-10 960,220 1160,120 C1300,60 1460,120 1500,80"
        fill="none"
        stroke="url(#gold)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeOpacity=".9"
        filter="url(#glow)"
        strokeDasharray="10 18"
      >
        <animate attributeName="stroke-dashoffset" from="420" to="0" dur="10s" repeatCount="indefinite" />
      </path>
      <path
        d="M-40,170 C120,110 300,160 520,140 C740,120 900,40 1140,80 C1300,110 1480,60 1520,20"
        fill="none"
        stroke="url(#gold)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeOpacity=".85"
        filter="url(#glow)"
        strokeDasharray="8 20"
      >
        <animate attributeName="stroke-dashoffset" from="620" to="0" dur="12s" repeatCount="indefinite" />
      </path>
    </svg>
  </div>
));
AnimatedBackground.displayName = "AnimatedBackground";

/* ===================== Main Component ===================== */

export default function NavbarClient({ initialUser }: { initialUser: User | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Memoize isActive function
  const isActive = useCallback((href: string) => (pathname === href ? "page" as const : undefined), [pathname]);

  // User state management
  const [user, setUser] = useState<User | null>(initialUser);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  
  useEffect(() => {
    let ignore = false;
    
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!ignore) setUser(user ?? null);
    };
    
    initUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!ignore) setUser(session?.user ?? null);
    });
    
    return () => {
      ignore = true;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  // Memoize next path
  const next = useMemo(() => {
    const q = searchParams?.toString();
    return pathname + (q ? `?${q}` : "");
  }, [pathname, searchParams]);

  // Staged header behavior
  const { stage, scrolled } = useStagedHeaderMotion({
    activateAt: 72,
    jitter: 6,
    peekAfterPx: 36,
    hideAfterPx: 120,
    revealAfterPx: 28,
  });

  const prefersReduced = useReducedMotion();

  // Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen(v => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Memoize login URL
  const loginUrl = useMemo(() => `/login?next=${encodeURIComponent(next)}`, [next]);

  return (
    <motion.header
      aria-label="Site header"
      initial={false}
      animate={prefersReduced ? "visible" : stage}
      variants={MOTION_VARIANTS}
      transition={prefersReduced ? { duration: 0 } : { type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50"
      data-stage={stage}
      data-scrolled={scrolled}
    >
      <nav
        aria-label="Main"
        className="relative isolate w-full h-16 md:h-32 flex items-center justify-between px-3 sm:px-4 lg:px-8 text-white crimson-kintsugi nav-blur edge-glow border-b border-white/10 overflow-hidden transition-[background-color,backdrop-filter,box-shadow,border-color,height] duration-300 data-[scrolled=true]:bg-black/60 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.35)] data-[scrolled=true]:border-white/15 data-[scrolled=true]:h-14 md:data-[scrolled=true]:h-28"
      >
        <AnimatedBackground />

        <div className="grain-layer" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/20" />

        {/* Left: Brand + Desktop tiles */}
        <div className="relative z-10 flex items-center gap-3">
          {/* Mobile brand */}
          <Link href="/home" className="flex items-center gap-2 md:hidden">
            <Image
              src="/UltraChampLogo.png"
              alt="Ultra Champ"
              width={28}
              height={28}
              className="rounded-sm shadow"
              priority
            />
            <span className="text-base font-semibold tracking-wide">Ultra Champ</span>
          </Link>

          {/* Desktop tile links */}
          <div
            className="hidden md:flex items-center gap-4 overflow-x-auto desktop-scroll pr-1 max-w-[78vw] lg:max-w-[82vw] xl:max-w-[86vw]"
            role="list"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map(({ href, label, img }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                img={img}
                isActive={isActive(href)}
              />
            ))}
          </div>
        </div>

        {/* Right: Session + Mobile Menu */}
        <div className="relative z-10 flex items-center gap-2 md:gap-3">
          {/* Desktop session */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <UserAvatar user={user} />
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
                href={loginUrl}
                className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 transition"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile avatar/login */}
          <div className="md:hidden">
            {user ? (
              <UserAvatar user={user} isMobile />
            ) : (
              <Link
                href={loginUrl}
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

          {/* Mobile hamburger with label */}
          <button
            type="button"
            onClick={toggleMobile}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/25 bg-black/40 hover:bg-white/10 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
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
            <span className="text-sm font-medium">
              {mobileOpen ? "Close" : "Menu"}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.24 }}
            className="md:hidden overflow-hidden border-b border-white/15 bg-zinc-950/90 backdrop-blur-md text-white"
          >
            <div className="flex flex-col gap-3 px-3 py-3">
              {NAV_LINKS.map(({ href, label, img }) => (
                <MobileNavLink
                  key={href}
                  href={href}
                  label={label}
                  img={img}
                  isActive={isActive(href)}
                  onClick={closeMobile}
                />
              ))}
            </div>

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
                  href={loginUrl}
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

      <style jsx>{`
        .desktop-scroll {
          scrollbar-gutter: stable both-edges;
          overscroll-behavior-x: contain;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.45) transparent;
        }
        .desktop-scroll:hover {
          scrollbar-color: rgba(255,255,255,0.70) transparent;
        }
        .desktop-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .desktop-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .desktop-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.5));
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .desktop-scroll:hover::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.75));
        }
      `}</style>
    </motion.header>
  );
}