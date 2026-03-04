export default function Loading() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 flex flex-col">
      {/* Header skeleton */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-rose-100/50 px-5 pb-3 pt-12">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 bg-rose-100 rounded-full animate-pulse" />
            <div className="h-3 w-20 bg-rose-50 rounded-full animate-pulse" />
          </div>
          <div className="w-20 h-9 bg-rose-100 rounded-2xl animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <section className="px-4 pt-5 pb-32 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-3xl p-4 border border-rose-100/60 space-y-3"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-rose-100 rounded-xl animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-rose-50 rounded-full animate-pulse w-24" />
                <div className="h-2.5 bg-rose-50/60 rounded-full animate-pulse w-16" />
              </div>
            </div>
            <div className="h-3 bg-rose-50 rounded-full animate-pulse w-full" />
            <div className="h-3 bg-rose-50 rounded-full animate-pulse w-3/4" />
          </div>
        ))}
      </section>
    </main>
  );
}
