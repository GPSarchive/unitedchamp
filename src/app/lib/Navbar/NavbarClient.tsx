// src/app/lib/Navbar/NavbarClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, memo, useRef } from "react";
import type { CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/supabaseBrowser";

/* ── Nav link data – split into two columns ── */
const COL_1 = [
  { href: "/home",        label: "HOME" },
  { href: "/tournaments", label: "ΤΟΥΡΝΟΥΑ" },
  { href: "/matches",     label: "ΑΓΩΝΕΣ" },
  { href: "/OMADES",      label: "ΟΜΑΔΕΣ" },
  { href: "/paiktes",     label: "ΠΑΙΚΤΕΣ" },
] as const;

const COL_2 = [
  { href: "/articles",        label: "ΑΡΘΡΑ & ΑΝΑΚΟΙΝΩΣΕΙΣ" },
  { href: "/kanonismos",      label: "ΚΑΝΟΝΙΣΜΟΣ" },
  { href: "/epikoinonia",     label: "ΕΠΙΚΟΙΝΩΝΙΑ" },
  { href: "/geniki-katataxi", label: "ΓΕΝΙΚΗ ΚΑΤΑΤΑΞΗ" },
] as const;

/* ── UserAvatar ── */
const UserAvatar = memo(({ user }: { user: User }) => {
  const { avatar_url, picture } = user?.user_metadata ?? {};
  const avatarUrl: string | undefined = avatar_url || picture;
  return (
    <Link
      href="/dashboard"
      aria-label={`Account: ${user.email ?? "Account"}`}
      title={user.email ?? "Account"}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#b8986a]/40 hover:border-[#b8986a] overflow-hidden bg-black/30 transition-[border-color] duration-300"
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt="Profile" width={36} height={36} className="object-cover w-full h-full" />
      ) : (
        <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
          <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-9 2.67-9 6v1h18v-1c0-3.33-3.67-6-9-6Z" />
        </svg>
      )}
    </Link>
  );
});
UserAvatar.displayName = "UserAvatar";

/* ── Animated gold kintsugi lines ── */
const AnimatedBackground = memo(() => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
    <svg
      className="kintsugi-svg w-full h-full mix-blend-screen"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="navGold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#f6e27a" />
          <stop offset="35%"  stopColor="#e8c66a" />
          <stop offset="65%"  stopColor="#caa94d" />
          <stop offset="100%" stopColor="#f6e27a" />
          <animate attributeName="x1" values="0;0.2;0" dur="9s"  repeatCount="indefinite" />
          <animate attributeName="x2" values="1;0.8;1" dur="9s"  repeatCount="indefinite" />
        </linearGradient>
        <filter id="navGlow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path
        d="M-20,55 C180,20 360,80 560,40 C760,0 960,80 1160,50 C1300,30 1460,55 1500,35"
        fill="none" stroke="url(#navGold)" strokeWidth="2.2"
        strokeLinecap="round" strokeOpacity=".9" filter="url(#navGlow)"
        strokeDasharray="10 18"
      >
        <animate attributeName="stroke-dashoffset" from="420" to="0" dur="10s" repeatCount="indefinite" />
      </path>
      <path
        d="M-40,70 C120,45 300,65 520,58 C740,50 900,15 1140,32 C1300,44 1480,24 1520,8"
        fill="none" stroke="url(#navGold)" strokeWidth="1.7"
        strokeLinecap="round" strokeOpacity=".85" filter="url(#navGlow)"
        strokeDasharray="8 20"
      >
        <animate attributeName="stroke-dashoffset" from="620" to="0" dur="12s" repeatCount="indefinite" />
      </path>
    </svg>
  </div>
));
AnimatedBackground.displayName = "AnimatedBackground";

/* ── Scroll hook ── */
function useNavScroll({
  activateAt = 72,
  scrollDelta = 10,
}: { activateAt?: number; scrollDelta?: number } = {}) {
  const [stage, setStage] = useState<"visible" | "hidden">("visible");
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      setScrolled(y > 50);
      if (y < 20) setStage("visible");
      else if (delta > scrollDelta && y > activateAt) setStage("hidden");
      else if (delta < -scrollDelta) setStage("visible");
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [activateAt, scrollDelta]);

  return { stage, scrolled };
}

/* ── Main Component ── */
export default function NavbarClient({ initialUser }: { initialUser: User | null }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const isActive = useCallback(
    (href: string) => (pathname === href ? ("page" as const) : undefined),
    [pathname]
  );

  /* auth */
  const [user, setUser] = useState<User | null>(initialUser);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  useEffect(() => {
    let ignore = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!ignore) setUser(user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!ignore) setUser(session?.user ?? null);
    });
    return () => { ignore = true; subscription.unsubscribe(); };
  }, [supabase]);

  const next = useMemo(() => {
    const q = searchParams?.toString();
    return pathname + (q ? `?${q}` : "");
  }, [pathname, searchParams]);
  const loginUrl = useMemo(() => `/login?next=${encodeURIComponent(next)}`, [next]);

  const prefersReduced = useReducedMotion();

  /* dropdown state */
  const [dropOpen, setDropOpen] = useState(false);
  const toggleDrop = useCallback(() => setDropOpen(v => !v), []);
  const closeDrop  = useCallback(() => setDropOpen(false), []);

  /* scroll hide (desktop only) */
  const { stage, scrolled } = useNavScroll({ activateAt: 72, scrollDelta: 10 });
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const currentStage = isMobile ? "visible" : stage;

  /* body scroll lock */
  useEffect(() => {
    document.body.style.overflow = dropOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [dropOpen]);

  /* close on route change */
  useEffect(() => { closeDrop(); }, [pathname, closeDrop]);

  /* Escape key */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && dropOpen) closeDrop(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dropOpen, closeDrop]);

  /* ================================================================ */
  return (
    <>
      {/* ── Fixed header ── */}
      <motion.header
        aria-label="Site header"
        initial={false}
        animate={prefersReduced ? "visible" : currentStage}
        variants={{ visible: { y: 0 }, hidden: { y: "-100%" } }}
        transition={
          prefersReduced
            ? { duration: 0 }
            : { type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }
        }
        className="fixed top-0 left-0 right-0 z-50"
      >
        {/* ── Navbar strip ── */}
        <nav
          aria-label="Main"
          data-scrolled={scrolled}
          className={[
            "relative isolate w-full h-20 flex items-center justify-between",
            "px-8 lg:px-10 text-white overflow-hidden",
            "crimson-kintsugi nav-blur edge-glow",
            "border-b border-white/10",
            "transition-[box-shadow,border-color] duration-300",
            "data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.45)]",
            "data-[scrolled=true]:border-white/15",
          ].join(" ")}
        >
          <AnimatedBackground />
          <div className="grain-layer" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/20" aria-hidden />

          {/* Left: hamburger + logo */}
          <div className="relative z-10 flex items-center gap-5">
            <button
              type="button"
              onClick={toggleDrop}
              aria-label={dropOpen ? "Close menu" : "Open menu"}
              aria-expanded={dropOpen}
              aria-controls="nav-dropdown"
              className="nav-hamburger"
            >
              <span className={dropOpen ? "h-top" : ""} />
              <span className={dropOpen ? "h-mid" : ""} />
              <span className={dropOpen ? "h-bot" : ""} />
            </button>

            <Link href="/home" className="flex items-center gap-3" aria-label="Ultra Champ – home">
              <Image
                src="/UltraChampLogo.png"
                alt="Ultra Champ"
                width={34}
                height={34}
                className="rounded-sm shadow"
                priority
              />
              <div className="leading-none select-none">
                <span className="block text-[17px] font-semibold tracking-[0.22em] uppercase text-white leading-none">
                  Ultra&nbsp;Champ
                </span>
                <span className="block text-[8px] font-normal tracking-[0.34em] uppercase text-[#b8986a] mt-1">
                  Championship&nbsp;·&nbsp;League
                </span>
              </div>
            </Link>
          </div>

          {/* Right: auth only */}
          <div className="relative z-10 flex items-center">
            {user ? (
              <UserAvatar user={user} />
            ) : (
              <Link href={loginUrl} className="btn-nav-login">
                Login
              </Link>
            )}
          </div>
        </nav>

        {/* ── Dropdown panel (attached below navbar, moves with it) ── */}
        <AnimatePresence>
          {dropOpen && (
            <motion.div
              id="nav-dropdown"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
              }
              className="drop-panel"
            >
              {/* ── Column 1 ── */}
              <div className="drop-col">
                {COL_1.map(({ href, label }, i) => {
                  const delay = i * 0.055;
                  return (
                    <motion.div
                      key={href}
                      initial={prefersReduced ? {} : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        href={href}
                        onClick={closeDrop}
                        aria-current={isActive(href)}
                        className="drop-link"
                        style={{ "--ul-delay": `${delay + 0.14}s` } as CSSProperties}
                      >
                        {label}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Column 2 + auth ── */}
              <div className="drop-col">
                {COL_2.map(({ href, label }, i) => {
                  const delay = (COL_1.length + i) * 0.055;
                  return (
                    <motion.div
                      key={href}
                      initial={prefersReduced ? {} : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        href={href}
                        onClick={closeDrop}
                        aria-current={isActive(href)}
                        className="drop-link"
                        style={{ "--ul-delay": `${delay + 0.14}s` } as CSSProperties}
                      >
                        {label}
                      </Link>
                    </motion.div>
                  );
                })}

                {/* Divider + auth */}
                <motion.div
                  initial={prefersReduced ? {} : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: prefersReduced ? 0 : (COL_1.length + COL_2.length) * 0.055 + 0.04,
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="drop-divider" aria-hidden />
                  {user ? (
                    <div className="drop-auth">
                      <span className="drop-auth-email">{user.email}</span>
                      <form method="post" action="/api/auth/sign-out">
                        <button type="submit" className="drop-auth-signout" onClick={closeDrop}>
                          Sign out
                        </button>
                      </form>
                    </div>
                  ) : (
                    <Link
                      href={loginUrl}
                      onClick={closeDrop}
                      className="drop-link"
                      style={{
                        "--ul-delay": `${(COL_1.length + COL_2.length) * 0.055 + 0.18}s`,
                        fontSize: "0.82rem",
                      } as CSSProperties}
                    >
                      Login
                    </Link>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Invisible backdrop – closes dropdown when clicking outside */}
      <AnimatePresence>
        {dropOpen && (
          <motion.div
            className="fixed inset-0 z-40"
            onClick={closeDrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <style jsx>{`
        /* ─── Hamburger ─── */
        .nav-hamburger {
          width: 28px;
          height: 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
          border: none;
          background: none;
          padding: 0;
          flex-shrink: 0;
        }
        .nav-hamburger span {
          display: block;
          width: 100%;
          height: 1px;
          background: #ffffff;
          transition: transform 0.35s ease, opacity 0.25s ease;
          transform-origin: center;
        }
        .nav-hamburger span.h-top { transform: translateY(8.5px) rotate(45deg); }
        .nav-hamburger span.h-mid { opacity: 0; }
        .nav-hamburger span.h-bot { transform: translateY(-8.5px) rotate(-45deg); }

        /* ─── Login / CTA button ─── */
        .btn-nav-login {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #1a1a18;
          background: #b8986a;
          padding: 10px 22px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          transition: background 0.25s ease, color 0.25s ease;
        }
        .btn-nav-login:hover { background: #ffffff; color: #1a1a18; }

        /* ─── Dropdown panel ─── */
        .drop-panel {
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          /* Matches the navbar's crimson-kintsugi palette exactly */
          background-color: #0d0707;
          background-image:
            radial-gradient(80% 160% at 50% -10%, rgba(248, 113, 113, 0.07), transparent 55%),
            radial-gradient(50% 100% at 0%  110%, rgba(127, 29,  29,  0.10), transparent 65%),
            radial-gradient(40% 80%  at 100% 0%,  rgba(190, 18,  60,  0.07), transparent 55%),
            linear-gradient(to bottom, #0d0707, #130909 55%, #0d0707);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 56px;
          padding: 32px 64px 40px;
        }

        /* ─── Column ─── */
        .drop-col {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* ─── Individual link ─── */
        .drop-link {
          display: inline-block;
          position: relative;
          font-style: italic;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.70);
          text-decoration: none;
          letter-spacing: 0.04em;
          line-height: 1.7;
          font-size: clamp(0.95rem, 1.55vw, 1.28rem);
          padding: 2px 0;
          transition: color 0.25s ease, letter-spacing 0.25s ease;
        }
        .drop-link:hover,
        .drop-link[aria-current="page"] {
          color: #ffffff;
          letter-spacing: 0.07em;
        }

        /* Underline: sweeps in from left as soon as the link appears */
        .drop-link::after {
          content: "";
          position: absolute;
          bottom: 1px;
          left: 0;
          height: 1px;
          width: 0;
          background: linear-gradient(90deg, #f5d37a, #d9a94f, #f5d37a);
          border-radius: 999px;
          animation: dropUlIn 0.55s ease forwards;
          animation-delay: var(--ul-delay, 0s);
        }
        @keyframes dropUlIn {
          from { width: 0; }
          to   { width: 100%; }
        }

        /* ─── Gold divider ─── */
        .drop-divider {
          width: 28px;
          height: 1px;
          background: #b8986a;
          opacity: 0.5;
          margin: 14px 0 10px;
        }

        /* ─── Auth section ─── */
        .drop-auth { display: flex; flex-direction: column; gap: 4px; }
        .drop-auth-email {
          font-size: 9px;
          letter-spacing: 0.18em;
          color: #b8986a;
          text-transform: uppercase;
          line-height: 2;
        }
        .drop-auth-signout {
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: block;
          text-align: left;
          transition: color 0.2s;
        }
        .drop-auth-signout:hover { color: #ffffff; }

        /* ─── Mobile: stack columns ─── */
        @media (max-width: 767px) {
          .drop-panel {
            grid-template-columns: 1fr;
            padding: 24px 32px 32px;
            gap: 0;
          }
          .drop-col + .drop-col {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
          }
        }
      `}</style>
    </>
  );
}
