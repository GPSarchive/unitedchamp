'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useScrollingHeader } from './useScrollingHeader' // adjust path if you move the hook

const tile =
  "group relative block shrink-0 w-[300px] h-[120px] rounded-xl overflow-hidden " +
  "border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 " +
  "hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transition-all duration-300 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-black"

export default function Navbar() {
  const pathname = usePathname()
  const isActive = (href: string) => (pathname === href ? 'page' : undefined)

  // Vanilla hide/reveal on scroll
  const { hidden, scrolled } = useScrollingHeader({ threshold: 6, hideAt: 72 })

  return (
    <header
      data-hidden={hidden}
      data-scrolled={scrolled}
      className="sticky top-0 z-50 will-change-transform translate-y-0
                 transition-[transform] duration-300 ease-out
                 data-[hidden=true]:-translate-y-full
                 motion-reduce:transition-none"
    >
      <nav
        aria-label="Main"
        className="relative isolate w-full h-32 md:h-36 flex items-center justify-between px-4 sm:px-6 lg:px-8
                   text-white crimson-kintsugi nav-blur edge-glow border-b border-white/10 overflow-hidden
                   transition-[background-color,backdrop-filter,box-shadow,border-color,height] duration-300
                   data-[scrolled=true]:bg-black/60 data-[scrolled=true]:backdrop-blur-md
                   data-[scrolled=true]:shadow-[0_4px_20px_0_rgba(0,0,0,0.35)]
                   data-[scrolled=true]:border-white/15
                   data-[scrolled=true]:h-28 md:data-[scrolled=true]:h-32"
      >
        {/* Animation wrapper (clipped) */}
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <svg
            className="kintsugi-svg w-full h-full"
            viewBox="0 0 1440 200"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"  stopColor="#f6e27a"/>
                <stop offset="35%" stopColor="#e8c66a"/>
                <stop offset="65%" stopColor="#caa94d"/>
                <stop offset="100%" stopColor="#f6e27a"/>
                <animate attributeName="x1" values="0;0.2;0" dur="9s" repeatCount="indefinite" />
                <animate attributeName="x2" values="1;0.8;1" dur="9s" repeatCount="indefinite" />
              </linearGradient>
              {/* tighter glow so blur doesn't leak out */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="b"/>
                <feMerge>
                  <feMergeNode in="b"/><feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <path
              d="M-20,120 C180,40 360,200 560,90 C760,-10 960,220 1160,120 C1300,60 1460,120 1500,80"
              fill="none" stroke="url(#gold)" strokeWidth="2.5" strokeLinecap="round" strokeOpacity=".9"
              filter="url(#glow)" strokeDasharray="10 18"
            >
              <animate attributeName="stroke-dashoffset" from="420" to="0" dur="10s" repeatCount="indefinite" />
            </path>
            <path
              d="M-40,170 C120,110 300,160 520,140 C740,120 900,40 1140,80 C1300,110 1480,60 1520,20"
              fill="none" stroke="url(#gold)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity=".85"
              filter="url(#glow)" strokeDasharray="8 20"
            >
              <animate attributeName="stroke-dashoffset" from="620" to="0" dur="12s" repeatCount="indefinite" />
            </path>
            <path
              d="M-30,40 C160,90 340,20 520,70 C700,120 900,10 1140,60 C1300,95 1500,40 1540,70"
              fill="none" stroke="url(#gold)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity=".75"
              filter="url(#glow)" strokeDasharray="6 16"
            >
              <animate attributeName="stroke-dashoffset" from="540" to="0" dur="8s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>

        {/* Subtle richness */}
        <div className="grain-layer" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/20" />

        {/* IMAGE TILES */}
        <div className="relative z-10 flex gap-4 items-center">
          {/* Home */}
          <Link href="/home" aria-current={isActive('/home')} className={tile}>
            <Image
              src="/navbar1.jpg"
              alt="Home"
              fill
              sizes="300px"
              priority
              className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-110"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-md bg-black/30 px-3 py-1 text-white text-lg font-semibold tracking-wide backdrop-blur-[2px]">
                HOME
              </span>
            </div>
          </Link>

          {/* Ανακοινώσεις */}
          <Link href="/anakoinoseis" aria-current={isActive('/anakoinoseis')} className={tile}>
            <Image
              src="/navbar2.jpg"
              alt="Ανακοινώσεις"
              fill
              sizes="300px"
              className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-110"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-md bg-black/30 px-3 py-1 text-white text-lg font-semibold tracking-wide backdrop-blur-[2px]">
                ΑΝΑΚΟΙΝΩΣΕΙΣ
              </span>
            </div>
          </Link>

          {/* Ομάδες */}
          <Link href="/OMADES" aria-current={isActive('/OMADES')} className={tile}>
            <Image
              src="/navbar3.jpg"
              alt="Ομάδες"
              fill
              sizes="300px"
              className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-110"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-md bg-black/30 px-3 py-1 text-white text-lg font-semibold tracking-wide backdrop-blur-[2px]">
                ΟΜΑΔΕΣ
              </span>
            </div>
          </Link>
        </div>
      </nav>
    </header>
  )
}
