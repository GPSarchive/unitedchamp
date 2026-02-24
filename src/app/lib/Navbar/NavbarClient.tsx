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
  { href: "/home",            label: "HOME",                 img: "/field2.jpg" },
  { href: "/articles",        label: "ΑΡΘΡΑ & ΑΝΑΚΟΙΝΩΣΕΙΣ", img: "/ανακοινωσεις.jpg" },
  { href: "/OMADES",          label: "ΟΜΑΔΕΣ",               img: "/Ομαδες.jpg" },
  { href: "/tournaments",     label: "ΤΟΥΡΝΟΥΑ",             img: "/tournamentPhoto.png" },
  { href: "/epikoinonia",     label: "ΕΠΙΚΟΙΝΩΝΙΑ",          img: "/επικοινωνια.jpg" },
  { href: "/paiktes",         label: "ΠΑΙΚΤΕΣ",              img: "/παικτες.jpg" },
  { href: "/matches",         label: "ΑΓΩΝΕΣ",               img: "/αγωνες.jpg" },
  { href: "/geniki-katataxi", label: "ΓΕΝΙΚΗ ΚΑΤΑΤΑΞΗ",      img: "/γενικη-καταταξη.jpg" },
  { href: "/kanonismos",      label: "ΚΑΝΟΝΙΣΜΟΣ",           img: "/κανονισμος.jpg" },
] as const;

/* ===================== UserAvatar ===================== */
const UserAvatar = memo(({ user }: { user: User }) => {
  const metadata = user?.user_metadata ?? {};
  const avatarUrl: string | undefined = metadata.avatar_url || metadata.picture;
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

/* ===================== AnimatedBackground ===================== */
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
          <animate attributeName="x1" values="0;0.2;0"   dur="9s"  repeatCount="indefinite" />
          <animate attributeName="x2" values="1;0.8;1"   dur="9s"  repeatCount="indefinite" />
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

/* ===================== Scroll Hook ===================== */
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

/* ===================== Main Component ===================== */
export default function NavbarClient({ initialUser }: { initialUser: User | null }) {
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const isActive = useCallback(
    (href: string) => (pathname === href ? ("page" as const) : undefined),
    [pathname]
  );

  /* ── Auth state ── */
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

  /* ── Overlay state ── */
  const [overlayOpen, setOverlayOpen] = useState(false);
  const toggleOverlay = useCallback(() => setOverlayOpen(v => !v), []);
  const closeOverlay  = useCallback(() => setOverlayOpen(false), []);

  /* ── Scroll behaviour (desktop hides on scroll-down) ── */
  const { stage, scrolled } = useNavScroll({ activateAt: 72, scrollDelta: 10 });
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const currentStage = isMobile ? "visible" : stage;

  /* ── Body scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [overlayOpen]);

  /* ── Close on route change ── */
  useEffect(() => { closeOverlay(); }, [pathname, closeOverlay]);

  /* ── Escape key ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && overlayOpen) closeOverlay(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlayOpen, closeOverlay]);

  /* ================================================================ */
  return (
    <>
      {/* ── Fixed navbar ── */}
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
        data-stage={currentStage}
        data-scrolled={scrolled}
      >
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

          {/* ── Logo ── */}
          <Link href="/home" className="relative z-10 flex items-center gap-3" aria-label="Ultra Champ – home">
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

          {/* ── Right controls ── */}
          <div className="relative z-10 flex items-center gap-6">
            {user ? (
              <UserAvatar user={user} />
            ) : (
              <Link href={loginUrl} className="btn-nav-login">
                Login
              </Link>
            )}

            {/* Hamburger */}
            <button
              type="button"
              onClick={toggleOverlay}
              aria-label={overlayOpen ? "Close menu" : "Open menu"}
              aria-expanded={overlayOpen}
              aria-controls="nav-overlay"
              className="nav-hamburger"
            >
              <span className={overlayOpen ? "h-top" : ""} />
              <span className={overlayOpen ? "h-mid" : ""} />
              <span className={overlayOpen ? "h-bot" : ""} />
            </button>
          </div>
        </nav>
      </motion.header>

      {/* ── Full-screen overlay menu ── */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            id="nav-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.45, ease: "easeInOut" }}
            className="nav-overlay"
          >
            {/* Left: decorative image panel – click to close */}
            <div
              className="overlay-img-panel"
              onClick={closeOverlay}
              aria-hidden="true"
            >
              <Image
                src="/field2.jpg"
                alt=""
                fill
                className="object-cover"
                style={{ opacity: 0.55 }}
              />
            </div>

            {/* Right: navigation links */}
            <div className="overlay-links-panel">
              <nav aria-label="Overlay navigation">
                {NAV_LINKS.map(({ href, label }, i) => (
                  <motion.div
                    key={href}
                    initial={prefersReduced ? {} : { opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: prefersReduced ? 0 : i * 0.04,
                      duration: 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Link
                      href={href}
                      onClick={closeOverlay}
                      aria-current={isActive(href)}
                      className="overlay-nav-link link-underline"
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}

                {/* Divider */}
                <div className="overlay-divider" aria-hidden />

                {/* Auth row */}
                <motion.div
                  initial={prefersReduced ? {} : { opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: prefersReduced ? 0 : NAV_LINKS.length * 0.04,
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {user ? (
                    <div className="overlay-auth">
                      <span className="overlay-auth-email">{user.email}</span>
                      <form method="post" action="/api/auth/sign-out">
                        <button
                          type="submit"
                          className="overlay-auth-signout"
                          onClick={closeOverlay}
                        >
                          Sign out
                        </button>
                      </form>
                    </div>
                  ) : (
                    <Link
                      href={loginUrl}
                      onClick={closeOverlay}
                      className="overlay-nav-link link-underline"
                      style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.8rem)" }}
                    >
                      Login
                    </Link>
                  )}
                </motion.div>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        /* ─── Hamburger ─── */
        .nav-hamburger {
          width: 30px;
          height: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
          border: none;
          background: none;
          padding: 0;
        }
        .nav-hamburger span {
          display: block;
          width: 100%;
          height: 1px;
          background: #ffffff;
          transition: transform 0.35s ease, opacity 0.25s ease;
          transform-origin: center;
        }
        .nav-hamburger span.h-top { transform: translateY(9.5px) rotate(45deg); }
        .nav-hamburger span.h-mid { opacity: 0; }
        .nav-hamburger span.h-bot { transform: translateY(-9.5px) rotate(-45deg); }

        /* ─── Login / CTA button (Ritual Book-Now style) ─── */
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

        /* ─── Full-screen overlay ─── */
        .nav-overlay {
          position: fixed;
          inset: 0;
          z-index: 40;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(11, 6, 6, 0.97);
        }

        /* ─── Left image panel ─── */
        .overlay-img-panel {
          position: relative;
          height: 100%;
          overflow: hidden;
          cursor: pointer;
        }

        /* ─── Right links panel ─── */
        .overlay-links-panel {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 100px 64px 80px 60px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(184, 152, 106, 0.35) transparent;
        }
        .overlay-links-panel::-webkit-scrollbar { width: 4px; }
        .overlay-links-panel::-webkit-scrollbar-track { background: transparent; }
        .overlay-links-panel::-webkit-scrollbar-thumb {
          background: rgba(184, 152, 106, 0.35);
          border-radius: 9999px;
        }
        .overlay-links-panel::-webkit-scrollbar-thumb:hover {
          background: rgba(184, 152, 106, 0.6);
        }

        /* ─── Overlay nav links ─── */
        .overlay-nav-link {
          display: block;
          font-style: italic;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.70);
          text-decoration: none;
          letter-spacing: 0.04em;
          line-height: 1.55;
          font-size: clamp(1.4rem, 3vw, 2.5rem);
          transition: color 0.25s ease, letter-spacing 0.25s ease;
        }
        .overlay-nav-link:hover,
        .overlay-nav-link[aria-current="page"] {
          color: #ffffff;
          letter-spacing: 0.08em;
        }

        /* ─── Gold divider ─── */
        .overlay-divider {
          width: 30px;
          height: 1px;
          background: #b8986a;
          opacity: 0.5;
          margin: 14px 0;
        }

        /* ─── Auth section ─── */
        .overlay-auth {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .overlay-auth-email {
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.18em;
          color: #b8986a;
          text-transform: uppercase;
          line-height: 2;
        }
        .overlay-auth-signout {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: block;
          text-align: left;
          transition: color 0.2s ease;
        }
        .overlay-auth-signout:hover { color: #ffffff; }

        /* ─── Mobile ─── */
        @media (max-width: 767px) {
          .nav-overlay { grid-template-columns: 1fr; }
          .overlay-img-panel { display: none; }
          .overlay-links-panel { padding: 100px 32px 80px 32px; }
        }
      `}</style>
    </>
  );
}
