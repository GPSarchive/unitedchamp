// app/tournoua/loading.tsx
export default function Loading() {
    return (
      <div className="px-6 py-10 animate-pulse">
        <div className="h-8 w-64 bg-white/10 rounded mb-6" />
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-white/10 bg-white/5" />
          ))}
        </div>
        <div className="h-6 w-48 bg-white/10 rounded mt-12 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg border border-white/10 bg-white/5" />
          ))}
        </div>
      </div>
    );
  }
  