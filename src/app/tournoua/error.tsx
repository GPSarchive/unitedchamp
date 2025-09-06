// app/tournoua/error.tsx
"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-bold mb-3">Κάτι πήγε στραβά</h1>
      <p className="text-white/70 mb-6">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 rounded-md border border-white/20 hover:bg-white/10">
        Δοκίμασε ξανά
      </button>
    </div>
  );
}
