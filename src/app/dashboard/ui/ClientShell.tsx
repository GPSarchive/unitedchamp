// src/app/dashboard/ui/ClientShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Αρχική" },
  { href: "/dashboard/users", label: "Χρήστες" },
  { href: "/dashboard/teams", label: "Ομάδες" },
  { href: "/dashboard/players", label: "Παίκτες" },
  { href: "/dashboard/matches", label: "Αγώνες" },
  { href: "/dashboard/tournaments", label: "Διοργανώσεις" },
  { href: "/dashboard/announcements", label: "Ανακοινώσεις" },
];

export default function ClientShell({
  children,
  userEmail,
}: { children: React.ReactNode; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const LinkItem = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={[
          "rounded-lg px-3 py-2 transition",
          active
            ? "bg-emerald-600/20 text-white ring-1 ring-emerald-400/30"
            : "text-white/80 hover:text-white hover:bg-white/5"
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-white/10 bg-zinc-950 p-4 gap-4">
        <div className="text-xl font-bold">Διαχείριση</div>
        <nav className="flex flex-col gap-1">
          {NAV.map(item => <LinkItem key={item.href} {...item} />)}
        </nav>
        <div className="mt-auto space-y-3">
          <p className="text-xs text-white/50 break-all">{userEmail}</p>
          <form method="post" action="/api/auth/sign-out">
            <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800">
              <LogOut className="h-4 w-4" /> Αποσύνδεση
            </button>
          </form>
        </div>
      </aside>

      {/* Drawer (mobile) */}
      <div
        className={[
          "fixed inset-0 z-40 md:hidden transition",
          open ? "pointer-events-auto" : "pointer-events-none"
        ].join(" ")}
        aria-hidden={!open}
      >
        <div
          className={[
            "absolute inset-0 bg-black/50 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          ].join(" ")}
          onClick={() => setOpen(false)}
        />
        <aside
          className={[
            "absolute left-0 top-0 h-full w-[84%] max-w-xs bg-zinc-950 border-r border-white/10 p-4 flex flex-col gap-4 transition-transform",
            open ? "translate-x-0" : "-translate-x-full"
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Μενού</div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(item => <LinkItem key={item.href} {...item} />)}
          </nav>
          <div className="mt-auto space-y-3">
            <p className="text-xs text-white/50 break-all">{userEmail}</p>
            <form method="post" action="/api/auth/sign-out">
              <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800">
                <LogOut className="h-4 w-4" /> Αποσύνδεση
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur px-3 md:px-6 py-3 flex items-center gap-3">
          <button
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
            onClick={() => setOpen(true)}
            aria-label="Άνοιγμα μενού"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg md:text-xl font-semibold">Πίνακας Διαχείρισης</h1>
          <div className="ml-auto text-xs text-white/60 hidden sm:block">
            Συνδεδεμένος: <span className="text-white">{userEmail}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
