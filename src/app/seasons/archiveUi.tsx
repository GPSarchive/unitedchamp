// Shared shell + small blocks for the public season archive (/seasons/…).
// Same dark editorial language as /OMADES and /geniki-katataxi.
import Link from "next/link";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--f-brutal",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-body",
  display: "swap",
});

export const pad2 = (n: number | string) => String(n).padStart(2, "0");

export function ArchiveShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} relative min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
          }}
        />
        <div
          className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)" }}
        />
        <div
          className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)" }}
        />
      </div>
      {children}
    </div>
  );
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
      <Link href="/" className="transition-colors hover:text-[#fb923c]">
        Αρχική
      </Link>
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="flex items-center gap-2">
          <span>/</span>
          {it.href ? (
            <Link href={it.href} className="transition-colors hover:text-[#fb923c]">
              {it.label}
            </Link>
          ) : (
            <span className="text-[#F3EFE6]">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
      <span className="h-[2px] w-8 bg-[#fb923c]" />
      {children}
    </div>
  );
}

export function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-5">
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-2 font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6] md:text-3xl">
        {title}
      </h2>
    </div>
  );
}

export function StatTile({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="border border-[#F3EFE6]/15 bg-[#13131d]/70 px-3 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/50">{k}</div>
      <div className="mt-1 font-[var(--f-display)] text-2xl font-black italic text-[#F3EFE6]">{v}</div>
    </div>
  );
}

export function StateBlock({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="relative border-2 border-dashed border-[#F3EFE6]/25 p-12 text-center" style={{ background: "rgba(19,19,29,0.4)" }}>
      <div className="mx-auto max-w-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">/ 00 · {kicker}</span>
        <p className="mt-4 font-[var(--f-display)] text-3xl font-black italic leading-tight text-[#F3EFE6]">{title}</p>
        <p className="mt-3 text-sm text-[#F3EFE6]/60">{body}</p>
      </div>
    </div>
  );
}

export function ArchiveFooter({ label }: { label: string }) {
  return (
    <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-6 py-6 md:flex-row md:items-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">{label}</p>
        <Link
          href="/seasons"
          className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] transition-colors hover:bg-[#F3EFE6] hover:text-[#0a0a14]"
        >
          ← Αρχείο Σεζόν
        </Link>
      </div>
    </footer>
  );
}
