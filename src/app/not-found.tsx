// src/app/not-found.tsx
import Link from 'next/link'

export const metadata = {
  title: '404 — Σελίδα δεν βρέθηκε | UltraChamp.gr',
  // No description — don't help scanners fingerprint the stack
}

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-7xl font-bold tracking-tight text-gray-200">
        404
      </h1>

      <p className="mt-4 text-lg text-gray-400">
        Η σελίδα που ψάχνετε δεν υπάρχει ή έχει μετακινηθεί.
      </p>

      <Link
        href="/"
        className="mt-8 rounded-md bg-white/10 px-6 py-2.5 text-sm font-medium
                   text-white transition hover:bg-white/20"
      >
        Επιστροφή στην αρχική
      </Link>
    </div>
  )
}