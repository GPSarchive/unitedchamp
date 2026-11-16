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
 *  Navigation data - one column, two groups                        *
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
  { href: "/seasons", label: "ΑΡΧΕΙΟ ΣΕΖΟΝ" },
];

const MENU_GROUPS = [COLUMN_1, COLUMN_2];

/* ================================================================ *
 *  Animated background: light streams                             *
 *  Shapes, colours and motion live in globals.css (.nav-stream*).  *
 *  Only `transform` animates, so nothing is repainted per frame.   *
 * ================================================================ */
const AnimatedBackground = memo(() => (
  <div className="nav-streams" aria-hidden>
    <div className="nav-stream nav-stream-a"><i /></div>
    <div className="nav-stream nav-stream-b"><i /></div>
    <div className="nav-stream nav-stream-c"><i /></div>
  </div>
));
AnimatedBackground.displayName = "AnimatedBackground";

/* ================================================================ *
 *  Menu link: one row of the single-column menu                    *
 *  Current page = solid orange row (same as the filter chips).     *
 *  Hover = a short orange tick that grows in (transform only).     *
 * ================================================================ */
const MenuLink = memo(
  ({
    href,
    label,
    isActive,
    onClick,
    count,
  }: {
    href: string;
    label: string;
    isActive?: "page";
    onClick: () => void;
    count?: number;
  }) => {
    const current = isActive === "page";
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={isActive}
        className={`
          group relative flex h-[38px] md:h-9 items-center gap-2 rounded-[3px] pl-3.5 pr-2.5
          text-[13px] tracking-[0.1em] uppercase whitespace-nowrap
          focus:outline-none focus-visible:ring-1 focus-visible:ring-[#fb923c]
          ${current
            ? "bg-[#fb923c] font-semibold text-[#0a0a14]"
            : "font-medium text-[#F3EFE6]/75 hover:text-[#F3EFE6]"}
        `}
      >
        {!current && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 scale-y-0 bg-[#fb923c] transition-transform duration-150 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
          />
        )}
        {label}
        {count != null && count > 0 && (
          <span
            className={`ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] px-1 text-[10px] font-bold leading-none tracking-normal ${
              current ? "bg-[#0a0a14] text-[#fb923c]" : "bg-[#fb923c] text-[#0a0a14]"
            }`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
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

  // Tell the page whether the bar is showing. globals.css turns this into
  // --nav-offset, which sticky bars use as their `top` so they follow the bar.
  useEffect(() => {
    document.documentElement.dataset.nav = currentStage;
    return () => {
      delete document.documentElement.dataset.nav;
    };
  }, [currentStage]);

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
          className="relative isolate w-full h-16 md:h-32 flex items-center justify-between px-3 sm:px-4 lg:px-8 text-white crimson-kintsugi edge-glow border-b border-white/10 overflow-hidden transition-[background-color,box-shadow,border-color] duration-300 data-[scrolled=true]:bg-black/60 data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.35)] data-[scrolled=true]:border-white/15"
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
                src="/UltraChampLogo3.png"
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
                  Mini Football Organization
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

        {/* ─────────────── Menu: one narrow column under the button ─────────────── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="main-menu"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : { type: "tween", duration: 0.16, ease: [0.22, 1, 0.36, 1] }
              }
              // Only transform + opacity animate: no layout or repaint per frame.
              className="absolute top-full left-3 sm:left-4 lg:left-8 mt-2 w-[236px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[4px] border border-[#F3EFE6]/15 bg-[#0a0a14] shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
            >
              {/* Orange top edge */}
              <div className="h-[2px] bg-[#fb923c]" aria-hidden />

              <div className="max-h-[calc(100dvh-5.5rem)] md:max-h-[calc(100dvh-9.5rem)] overflow-y-auto overscroll-contain p-1.5">
                {MENU_GROUPS.map((group, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${i > 0 ? "mt-1.5 border-t border-[#F3EFE6]/15 pt-1.5" : ""}`}
                  >
                    {group.map((item) => (
                      <MenuLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        isActive={isActive(item.href)}
                        onClick={closeMenu}
                        count={item.href === "/articles" ? newsCount : undefined}
                      />
                    ))}
                  </div>
                ))}

                {/* Account */}
                <div className="mt-1.5 border-t border-[#F3EFE6]/15 pt-1.5">
                  {user ? (
                    <div className="flex flex-col">
                      <Link
                        href="/dashboard"
                        onClick={closeMenu}
                        className="flex h-[38px] md:h-9 min-w-0 items-center gap-2 rounded-[3px] pl-3.5 pr-2.5 text-[#F3EFE6]/75 hover:text-[#F3EFE6] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#fb923c]"
                      >
                        {user.user_metadata?.avatar_url ? (
                          <Image
                            src={user.user_metadata.avatar_url}
                            alt=""
                            width={20}
                            height={20}
                            className="shrink-0 rounded-full"
                          />
                        ) : (
                          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className="shrink-0 text-[#fb923c]">
                            <path
                              fill="currentColor"
                              d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z"
                            />
                          </svg>
                        )}
                        <span className="truncate text-[12px]">{user.email}</span>
                      </Link>
                      <form method="post" action="/api/auth/sign-out">
                        <button
                          type="submit"
                          onClick={closeMenu}
                          className="flex h-[38px] md:h-9 w-full items-center rounded-[3px] pl-3.5 pr-2.5 text-left text-[12px] font-medium tracking-[0.1em] uppercase text-[#F3EFE6]/50 hover:text-[#fb923c] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#fb923c]"
                        >
                          Αποσύνδεση
                        </button>
                      </form>
                    </div>
                  ) : (
                    <Link
                      href={loginUrl}
                      onClick={closeMenu}
                      className="flex h-[38px] md:h-9 items-center justify-center gap-2 rounded-[3px] border border-[#fb923c]/70 text-[12px] font-semibold tracking-[0.1em] uppercase text-[#fb923c] hover:bg-[#fb923c] hover:text-[#0a0a14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#fb923c]"
                    >
                      <Image src="/UltraChampLogo3.png" alt="" width={20} height={20} className="rounded-[2px]" />
                      Σύνδεση / Εγγραφή
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Backdrop: flat dim, opacity only */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.15 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closeMenu}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

    </>
  );
}