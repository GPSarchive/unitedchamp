// src/app/error.tsx
'use client'

// ⚠️  error.tsx MUST be a Client Component.
// The `error` prop contains the real Error object, but we NEVER render
// error.message or error.stack — those can leak file paths, SQL queries,
// internal API URLs, or secrets.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-gray-200">
        Κάτι πήγε στραβά
      </h1>

      <p className="mt-4 max-w-md text-gray-400">
        Παρουσιάστηκε απρόσμενο σφάλμα. Δοκιμάστε ξανά ή επιστρέψτε στην αρχική.
      </p>

      {/* digest is a server-generated hash — safe to show for support tickets */}
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-gray-600">
          Ref: {error.digest}
        </p>
      )}

      <div className="mt-8 flex gap-4">
        <button
          onClick={reset}
          className="rounded-md bg-white/10 px-6 py-2.5 text-sm font-medium
                     text-white transition hover:bg-white/20"
        >
          Δοκιμάστε ξανά
        </button>

        <a
          href="/"
          className="rounded-md border border-white/10 px-6 py-2.5 text-sm
                     font-medium text-gray-400 transition hover:text-white"
        >
          Αρχική
        </a>
      </div>
    </div>
  )
}