// src/app/lib/Navbar/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, memo, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/supabaseBrowser";

/* ================================================================ *
 *  Navigation data - Two columns                                   *
 * ================================================================ */
const COLUMN_1 = [
  { href: "/home", label: "HOME" },
  { href: "/tournaments", label: "ΤΟΥΡΝΟΥΑ" },
  { href: "/matches", label: "ΑΓΩΝΕΣ" },
  { href: "/OMADES", label: "ΟΜΑΔΕΣ" },
  { href: "/paiktes", label: "ΠΑΙΚΤΕΣ" },
];

const COLUMN_2 = [
  { href: "/articles", label: "ΝΕΑ & ΑΝΑΚΟΙΝΩΣΕΙΣ" },
  { href: "/kanonismos", label: "ΚΑΝΟΝΙΣΜΟΣ" },
  { href: "/epikoinonia", label: "ΕΠΙΚΟΙΝΩΝΙΑ" },
  { href: "/geniki-katataxi", label: "ΓΕΝΙΚΗ ΚΑΤΑΤΑΞΗ" },
];

/* ================================================================ *
 *  Animated kintsugi background (original)                         *
 * ================================================================ */
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

/* ================================================================ *
 *  Menu link with luxurious underline animation                    *
 * ================================================================ */
const MenuLink = memo(
  ({
    href,
    label,
    isActive,
    onClick,
    index,
    columnOffset = 0,
    count,
  }: {
    href: string;
    label: string;
    isActive?: "page";
    onClick: () => void;
    index: number;
    columnOffset?: number;
    count?: number;
  }) => {
    const prefersReduced = useReducedMotion();
    const delay = prefersReduced ? 0 : 0.08 + (index + columnOffset) * 0.05;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay,
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <Link
          href={href}
          onClick={onClick}
          aria-current={isActive}
          className="group relative block py-3"
        >
          <span className="inline-flex items-center gap-2">
            <span
              className={`
                text-sm md:text-base font-medium tracking-[0.15em] uppercase
                transition-colors duration-500
                ${isActive === "page" ? "text-amber-400" : "text-white/70 group-hover:text-white"}
              `}
            >
              {label}
            </span>
            {count != null && count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-[0_0_8px_rgba(251,191,36,0.7),0_0_16px_rgba(251,191,36,0.4)]">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </span>
          
          {/* Luxurious underline */}
          <span className="absolute bottom-2 left-0 h-px w-full overflow-hidden">
            <span
              className={`
                block h-full bg-gradient-to-r from-amber-400/80 via-amber-300 to-amber-400/80
                transition-all duration-500 ease-out
                ${isActive === "page" ? "w-full" : "w-0 group-hover:w-full"}
              `}
              style={{ transformOrigin: "left" }}
            />
          </span>

          {/* Subtle glow on hover */}
          <span
            className={`
              absolute bottom-2 left-0 h-px w-full blur-sm
              bg-gradient-to-r from-transparent via-amber-400/50 to-transparent
              opacity-0 group-hover:opacity-100 transition-opacity duration-500
              ${isActive === "page" ? "opacity-50" : ""}
            `}
          />
        </Link>
      </motion.div>
    );
  },
);
MenuLink.displayName = "MenuLink";

/* ================================================================ *
 *  User avatar                                                     *
 * ================================================================ */
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

/* ================================================================ *
 *  Scroll behavior hook                                            *
 * ================================================================ */
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

/* ================================================================ *
 *  Main navbar                                                     *
 * ================================================================ */

const MOTION_VARIANTS = {
  visible: { y: 0 },
  hidden: { y: "-100%" },
} as const;

export default function NavbarClient({ initialUser, newsCount = 0 }: { initialUser: User | null; newsCount?: number }) {
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

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setMenuOpen(v => !v), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Desktop scroll behavior
  const { stage: desktopStage, scrolled } = useDesktopNavScroll({
    activateAt: 72,
    scrollDelta: 10,
  });

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Close on route change
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        closeMenu();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen, closeMenu]);

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

  return (
    <>
      <motion.header
        aria-label="Site header"
        initial={false}
        animate={prefersReduced ? "visible" : currentStage}
        variants={MOTION_VARIANTS}
        transition={prefersReduced ? { duration: 0 } : { type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50"
        data-stage={currentStage}
        data-scrolled={scrolled}
      >
        <nav
          aria-label="Main"
          className="relative isolate w-full h-16 md:h-32 flex items-center justify-between px-3 sm:px-4 lg:px-8 text-white crimson-kintsugi nav-blur edge-glow border-b border-white/10 overflow-hidden transition-[background-color,backdrop-filter,box-shadow,border-color,height] duration-300 data-[scrolled=true]:bg-black/60 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.35)] data-[scrolled=true]:border-white/15 data-[scrolled=true]:h-14 md:data-[scrolled=true]:h-28"
          data-scrolled={scrolled}
        >
          {/* Original animated background */}
          <AnimatedBackground />

          <div className="grain-layer" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/20" />

          {/* Left: Hamburger + Brand */}
          <div className="relative z-10 flex items-center gap-2 md:gap-4">
            {/* Hamburger button with Menu/Close label (from reference) */}
            <button
              type="button"
              onClick={toggleMenu}
              aria-label="Μενού"
              aria-expanded={menuOpen}
              aria-controls="main-menu"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/25 bg-black/40 hover:bg-white/10 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <div className="w-[18px] h-[14px] relative flex flex-col justify-between">
                <span
                  className={`
                    block h-[2px] w-full bg-white rounded-full
                    transition-all duration-300 origin-center
                    ${menuOpen ? "rotate-45 translate-y-[6px]" : ""}
                  `}
                />
                <span
                  className={`
                    block h-[2px] w-full bg-white rounded-full
                    transition-all duration-300
                    ${menuOpen ? "opacity-0 scale-x-0" : ""}
                  `}
                />
                <span
                  className={`
                    block h-[2px] w-full bg-white rounded-full
                    transition-all duration-300 origin-center
                    ${menuOpen ? "-rotate-45 -translate-y-[6px]" : ""}
                  `}
                />
              </div>
              <span className="text-sm font-medium">
                {menuOpen ? "Κλείσιμο" : "Μενού"}
              </span>
            </button>

            {/* Brand with Logo + Two-line text */}
            <Link href="/home" className="flex items-center gap-2 md:gap-3">
              <Image
                src="/UltraChampLogo.png"
                alt="Ultra Champ"
                width={28}
                height={28}
                className="rounded-sm shadow md:w-10 md:h-10"
                priority
              />
              <div className="flex flex-col">
                <span className="text-base md:text-lg font-bold tracking-wide leading-tight">
                  Ultra Champ
                </span>
                <span className="text-[10px] md:text-xs font-medium tracking-[0.15em] uppercase text-white/60 leading-tight">
                  Championship League
                </span>
              </div>
            </Link>
          </div>

          {/* Right: User avatar/login */}
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
                      aria-label="Αποσύνδεση"
                    >
                      Αποσύνδεση
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href={loginUrl}
                  className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 transition"
                >
                  Σύνδεση
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
                  aria-label="Σύνδεση"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 size-9"
                  title="Σύνδεση"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="opacity-90">
                    <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"/>
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* ─────────────── Dropdown Menu ─────────────── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="main-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
              }
              className="overflow-hidden"
            >
              {/* Menu background - static red/crimson gradient */}
              <div
                className="relative border-b border-white/10"
                style={{
                  background: "linear-gradient(180deg, #150a0a 0%, #0d0707 60%, #0a0606 100%)",
                }}
              >
                {/* Subtle vignette overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)",
                  }}
                />

                {/* Top accent line */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-red-800/40 to-transparent origin-center"
                />

                {/* Content container */}
                <div className="relative max-h-[75vh] overflow-y-auto overscroll-contain menu-scroll">
                  <div className="px-6 sm:px-10 lg:px-16 py-10 md:py-14">
                    {/* Two columns grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 lg:gap-x-24 gap-y-1 max-w-4xl mx-auto">
                      
                      {/* Column 1 */}
                      <div className="flex flex-col">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.05, duration: 0.4 }}
                          className="mb-4"
                        >
                          <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-white/30">
                            Πλοήγηση
                          </span>
                        </motion.div>

                        {COLUMN_1.map((item, idx) => (
                          <MenuLink
                            key={item.href}
                            href={item.href}
                            label={item.label}
                            isActive={isActive(item.href)}
                            onClick={closeMenu}
                            index={idx}
                            columnOffset={0}
                          />
                        ))}
                      </div>

                      {/* Column 2 */}
                      <div className="flex flex-col mt-8 md:mt-0">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.15, duration: 0.4 }}
                          className="mb-4"
                        >
                          <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-white/30">
                            Πληροφορίες
                          </span>
                        </motion.div>

                        {COLUMN_2.map((item, idx) => (
                          <MenuLink
                            key={item.href}
                            href={item.href}
                            label={item.label}
                            isActive={isActive(item.href)}
                            onClick={closeMenu}
                            index={idx}
                            columnOffset={COLUMN_1.length}
                            count={item.href === "/articles" ? newsCount : undefined}
                          />
                        ))}

                        {/* Auth section at bottom of column 2 */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: prefersReduced ? 0 : 0.08 + (COLUMN_1.length + COLUMN_2.length) * 0.05,
                            duration: 0.5,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="mt-8 pt-6 border-t border-white/10"
                        >
                          {user ? (
                            <div className="flex items-center justify-between gap-4">
                              <Link
                                href="/dashboard"
                                onClick={closeMenu}
                                className="group flex items-center gap-3"
                              >
                                <div className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-white/20 transition-all duration-300">
                                  {user.user_metadata?.avatar_url ? (
                                    <Image
                                      src={user.user_metadata.avatar_url}
                                      alt="Profile"
                                      width={40}
                                      height={40}
                                      className="rounded-full"
                                    />
                                  ) : (
                                    <svg viewBox="0 0 24 24" width={20} height={20} className="text-white/60">
                                      <path
                                        fill="currentColor"
                                        d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-white/40 uppercase tracking-wider">Λογαριασμός</span>
                                  <span className="text-sm font-medium text-white/80 group-hover:text-white truncate max-w-[180px] transition-colors duration-300">
                                    {user.email}
                                  </span>
                                </div>
                              </Link>
                              <form method="post" action="/api/auth/sign-out">
                                <button
                                  type="submit"
                                  onClick={closeMenu}
                                  className="px-5 py-2.5 text-xs font-medium tracking-wider uppercase text-white/50 hover:text-white border border-white/15 rounded-lg hover:bg-white/5 hover:border-white/25 transition-all duration-300"
                                >
                                  Αποσύνδεση
                                </button>
                              </form>
                            </div>
                          ) : (
                            <Link
                              href={loginUrl}
                              onClick={closeMenu}
                              className="group relative flex items-center justify-center gap-3 w-full py-4 overflow-hidden rounded-lg border border-white/10 hover:border-white/20 transition-all duration-500"
                            >
                              {/* Button background glow */}
                              <div className="absolute inset-0 bg-gradient-to-r from-red-950/30 via-red-900/20 to-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              
                              <svg viewBox="0 0 24 24" width={18} height={18} className="relative z-10 text-white/60 group-hover:text-amber-400 transition-colors duration-500">
                                <path
                                  fill="currentColor"
                                  d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"
                                />
                              </svg>
                              <span className="relative z-10 text-sm font-medium tracking-[0.15em] uppercase text-white/60 group-hover:text-white transition-colors duration-500">
                                Σύνδεση / Εγγραφή
                              </span>
                            </Link>
                          )}
                        </motion.div>
                      </div>
                    </div>

                    {/* Bottom decorative element */}
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{
                        delay: prefersReduced ? 0 : 0.5,
                        duration: 0.8,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="mt-12 mx-auto max-w-xs h-px bg-gradient-to-r from-transparent via-white/10 to-transparent origin-center"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Backdrop */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            onClick={closeMenu}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <style jsx>{`
        .menu-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }
        .menu-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .menu-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .menu-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 9999px;
        }
        .menu-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </>
  );
}