// src/app/lib/Navbar/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, memo, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/supabaseBrowser";

/* ===================== Data ===================== */
const NAV_LINKS = [
  { href: "/home", label: "HOME" },
  { href: "/OMADES", label: "ΟΜΑΔΕΣ" },
  { href: "/paiktes", label: "ΠΑΙΚΤΕΣ" },
  { href: "/tournaments", label: "ΤΟΥΡΝΟΥΑ" },
  { href: "/anakoinoseis", label: "ΑΝΑΚΟΙΝΩΣΕΙΣ" },
  { href: "/kanonismos", label: "ΚΑΝΟΝΙΣΜΟΣ" },
  { href: "/matches", label: "ΑΓΩΝΕΣ" },
  { href: "/geniki-katataxi", label: "ΓΕΝΙΚΗ ΚΑΤΑΤΑΞΗ" },
  { href: "/epikoinonia", label: "ΕΠΙΚΟΙΝΩΝΙΑ" },
] as const;

/* ===================== Sub-components ===================== */

const NavLink = memo(({ href, label, isActive, onClick }: {
  href: string;
  label: string;
  isActive?: "page";
  onClick?: () => void;
}) => (
  <Link
    href={href}
    aria-current={isActive}
    className={`
      relative px-4 py-2 text-sm font-semibold tracking-wide uppercase
      transition-all duration-300 ease-out
      ${isActive
        ? 'text-[#f6e27a]'
        : 'text-white/75 hover:text-[#e8c66a]'
      }
      focus:outline-none focus-visible:text-[#f6e27a]
      group
    `}
    role="listitem"
    onClick={onClick}
  >
    {label}
    {/* Gold gradient underline */}
    <span
      className={`
        absolute bottom-0 left-0 right-0 h-[2px] rounded-full
        bg-gradient-to-r from-[#f6e27a] via-[#e8c66a] to-[#caa94d]
        transition-all duration-300 ease-out
        ${isActive
          ? 'opacity-100 shadow-[0_0_8px_rgba(246,226,122,0.6)]'
          : 'opacity-0 group-hover:opacity-80 group-hover:shadow-[0_0_6px_rgba(246,226,122,0.4)]'
        }
      `}
    />
  </Link>
));
NavLink.displayName = "NavLink";

const MobileNavLink = memo(({ href, label, isActive, onClick }: {
  href: string;
  label: string;
  isActive?: "page";
  onClick: () => void;
}) => (
  <Link
    href={href}
    onClick={onClick}
    aria-current={isActive}
    className={`
      relative block w-full px-4 py-3.5 text-base font-semibold tracking-wide uppercase
      rounded-lg transition-all duration-300 ease-out active:scale-[0.98]
      ${isActive
        ? 'text-[#f6e27a] bg-gradient-to-r from-white/8 to-white/5 border border-[#e8c66a]/30 shadow-[0_0_12px_rgba(246,226,122,0.15)]'
        : 'text-white/75 hover:text-[#e8c66a] hover:bg-white/5 border border-transparent hover:border-[#e8c66a]/20'
      }
    `}
  >
    {label}
    {/* Gold accent bar for active state */}
    {isActive && (
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-[#f6e27a] via-[#e8c66a] to-[#caa94d] rounded-r-full shadow-[0_0_8px_rgba(246,226,122,0.6)]" />
    )}
  </Link>
));
MobileNavLink.displayName = "MobileNavLink";

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

/* ===================== Custom Hook: Desktop Scroll ===================== */
function useDesktopNavScroll({
  activateAt = 72,
  scrollDelta = 10,
}: {
  activateAt?: number;
  scrollDelta?: number;
}) {
  const [stage, setStage] = useState<"visible" | "hidden">("visible");
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      setScrolled(currentScrollY > 50);

      if (currentScrollY < 20) {
        setStage("visible");
      } else if (delta > scrollDelta && currentScrollY > activateAt) {
        setStage("hidden");
      } else if (delta < -scrollDelta) {
        setStage("visible");
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activateAt, scrollDelta]);

  return { stage, scrolled };
}

/* ===================== Main Component ===================== */

const MOBILE_MOTION_VARIANTS = {
  visible: { y: 0 },
  hidden: { y: "-100%" },
} as const;

const DESKTOP_MOTION_VARIANTS = {
  visible: { y: 0 },
  hidden: { y: "-100%" },
} as const;

export default function NavbarClient({ initialUser }: { initialUser: User | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
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

  const next = useMemo(() => {
    const q = searchParams?.toString();
    return pathname + (q ? `?${q}` : "");
  }, [pathname, searchParams]);

  const prefersReduced = useReducedMotion();

  // Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen(v => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Desktop scroll behavior
  const { stage: desktopStage, scrolled } = useDesktopNavScroll({
    activateAt: 72,
    scrollDelta: 10,
  });

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close on route change
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        closeMobile();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen, closeMobile]);

  const loginUrl = useMemo(() => `/login?next=${encodeURIComponent(next)}`, [next]);

  // Determine if we're on mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Mobile navbar always visible, desktop uses scroll behavior
  const currentStage = isMobile ? "visible" : desktopStage;
  const motionVariants = isMobile ? MOBILE_MOTION_VARIANTS : DESKTOP_MOTION_VARIANTS;

  return (
    <>
      <motion.header
        aria-label="Site header"
        initial={false}
        animate={prefersReduced ? "visible" : currentStage}
        variants={motionVariants}
        transition={prefersReduced ? { duration: 0 } : { type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50"
        data-stage={currentStage}
        data-scrolled={scrolled}
      >
        <nav
          aria-label="Main"
          className="relative isolate w-full h-16 md:h-20 flex items-center justify-between px-3 sm:px-4 lg:px-8 text-white crimson-kintsugi nav-blur edge-glow border-b border-white/10 overflow-hidden transition-[background-color,backdrop-filter,box-shadow,border-color,height] duration-300 data-[scrolled=true]:bg-black/60 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.35)] data-[scrolled=true]:border-white/15 data-[scrolled=true]:h-14 md:data-[scrolled=true]:h-16"
          data-scrolled={scrolled}
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

            {/* Desktop navigation links */}
            <div
              className="hidden md:flex items-center gap-1 overflow-x-auto desktop-scroll pr-1 max-w-[85vw] lg:max-w-[88vw] xl:max-w-[90vw]"
              role="list"
              aria-label="Primary navigation"
            >
              {NAV_LINKS.map(({ href, label }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
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
              <div className="w-[18px] h-[14px] relative flex flex-col justify-between">
                <span
                  className={`
                    block h-[2px] w-full bg-white rounded-full
                    transition-all duration-300 origin-center
                    ${mobileOpen ? "rotate-45 translate-y-[6px]" : ""}
                  `}
                />
                <span
                  className={`
                    block h-[2px] w-full bg-white rounded-full
                    transition-all duration-300
                    ${mobileOpen ? "opacity-0 scale-x-0" : ""}
                  `}
                />
                <span
                  className={`
                    block h-[2px] w-full bg-white rounded-full
                    transition-all duration-300 origin-center
                    ${mobileOpen ? "-rotate-45 -translate-y-[6px]" : ""}
                  `}
                />
              </div>
              <span className="text-sm font-medium">
                {mobileOpen ? "Close" : "Menu"}
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile dropdown - 75% screen height with premium scrollbar */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "75vh", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden border-b border-white/15 bg-gradient-to-b from-zinc-950/95 via-zinc-900/95 to-zinc-950/98 backdrop-blur-xl text-white mobile-menu-container"
            >
              {/* Scrollable content area */}
              <div className="h-full overflow-y-auto overscroll-contain mobile-menu-scroll">
                {/* Top fade gradient */}
                <div className="pointer-events-none sticky top-0 left-0 right-0 h-4 bg-gradient-to-b from-zinc-950/90 to-transparent z-10" />

                <div className="flex flex-col gap-1.5 px-4 pb-4">
                  {NAV_LINKS.map(({ href, label }, index) => (
                    <motion.div
                      key={href}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: prefersReduced ? 0 : index * 0.04,
                        duration: prefersReduced ? 0 : 0.3,
                        ease: [0.22, 1, 0.36, 1]
                      }}
                    >
                      <MobileNavLink
                        href={href}
                        label={label}
                        isActive={isActive(href)}
                        onClick={closeMobile}
                      />
                    </motion.div>
                  ))}
                  
                  {/* Login/Logout button */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ 
                      delay: prefersReduced ? 0 : NAV_LINKS.length * 0.04,
                      duration: prefersReduced ? 0 : 0.3,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    className="mt-2"
                  >
                    {user ? (
                      <form method="post" action="/api/auth/sign-out">
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3.5 text-sm font-medium hover:bg-white/10 active:scale-[0.98] transition"
                          aria-label="Sign out"
                          onClick={closeMobile}
                        >
                          Sign out
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={loginUrl}
                        className="block w-full text-center rounded-lg border border-white/20 bg-white/5 px-4 py-3.5 text-sm font-medium hover:bg-white/10 active:scale-[0.98] transition"
                        onClick={closeMobile}
                      >
                        Login
                      </Link>
                    )}
                  </motion.div>
                </div>

                {/* Bottom fade gradient */}
                <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-950/95 to-transparent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />
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

        /* Simple mobile menu scrollbar */
        .mobile-menu-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.3) transparent;
        }
        .mobile-menu-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .mobile-menu-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 8px 0;
        }
        .mobile-menu-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.3);
          border-radius: 9999px;
        }
        .mobile-menu-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.5);
        }
      `}</style>
    </>
  );
}