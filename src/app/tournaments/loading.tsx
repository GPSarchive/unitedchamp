export default function TournamentsLoading() {
  return (
    <section className="relative min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="h-10 w-48 rounded-xl bg-neutral-900 animate-pulse" />
        </div>

        {/* Search & filter skeleton */}
        <div className="mb-8 space-y-4">
          <div className="h-10 w-full max-w-md rounded-xl bg-neutral-900 animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 rounded-full bg-neutral-900 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl border border-white/10 bg-neutral-950 p-6 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-neutral-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 rounded bg-neutral-800" />
                  <div className="flex gap-2">
                    <div className="h-4 w-16 rounded-full bg-neutral-800" />
                    <div className="h-4 w-14 rounded-full bg-neutral-800" />
                  </div>
                </div>
              </div>
              <div className="mt-8 flex justify-between">
                <div className="flex gap-3">
                  <div className="h-4 w-16 rounded bg-neutral-800" />
                  <div className="h-4 w-16 rounded bg-neutral-800" />
                </div>
                <div className="h-4 w-16 rounded bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
