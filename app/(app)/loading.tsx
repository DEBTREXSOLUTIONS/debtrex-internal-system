// Shown INSTANTLY when navigating to any page under app/(app)/, while the
// page's Server Component is fetching data on the server. Replaced with the
// real content as soon as the server is done.
//
// Kept generic on purpose — it should hint at the page's structure (header
// row, KPI cards, content grid) without trying to match every page exactly.
export default function Loading() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <Skel className="h-8 w-48" />
        <Skel className="h-9 w-32 rounded-md" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <Skel className="h-8 w-8 rounded-md" />
            <Skel className="h-7 w-16" />
            <Skel className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 space-y-4">
          <Skel className="h-5 w-40 mb-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 pb-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center justify-between">
                <Skel className="h-4 w-2/3" />
                <Skel className="h-5 w-16 rounded-full" />
              </div>
              <Skel className="h-3 w-1/2" />
            </div>
          ))}
        </div>

        <div className="card p-6 space-y-4">
          <Skel className="h-5 w-32 mb-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
              <Skel className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skel className="h-3 w-3/4" />
                <Skel className="h-2 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Skel({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
