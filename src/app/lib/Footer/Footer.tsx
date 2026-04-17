"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { openConsentBanner } from "@/app/lib/consent/use-consent";

// Routes that own a full-screen layout and don't want the global footer.
const HIDDEN_ROUTES: ReadonlyArray<string> = ["/paiktes"];

export default function Footer() {
  const pathname = usePathname() ?? "";
  if (HIDDEN_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  return (
    <footer className="py-8 bg-zinc-950 text-white text-center">
      <div className="container mx-auto px-4">
        <p>© 2025 Ultra Champ.</p>
        <nav
          aria-label="Legal"
          className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
        >
          <Link href="/privacy" className="hover:underline">
            Πολιτική Απορρήτου
          </Link>
          <Link href="/terms" className="hover:underline">
            Όροι Χρήσης
          </Link>
          <Link href="/cookies" className="hover:underline">
            Cookies
          </Link>
          <Link href="/epikoinonia" className="hover:underline">
            Επικοινωνία
          </Link>
          <button
            type="button"
            onClick={openConsentBanner}
            className="hover:underline text-white/90"
          >
            Ρυθμίσεις Cookies
          </button>
        </nav>
        <div className="mt-4 text-zinc-400 text-sm">
          Κατασκευή ιστοσελίδας από{" "}
          <a
            href="https://www.digitalfootprint.gr"
            target="_blank"
            rel="noopener"
            className="hover:underline text-zinc-300"
          >
            Digital Footprint
          </a>
        </div>
      </div>
    </footer>
  );
}
