/** Base shimmer block — compose into table rows / cards / stat tiles below. Replaces plain
 * "Загрузка…" text so the page's real layout is already visible while data streams in. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-line/60 ${className}`} />;
}

/** Matches WarehouseTable/UsersTable/etc.'s row shape (name + a few narrower columns). */
export function SkeletonTableRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-ink-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-4">
          <Skeleton className="h-4 w-1/4" />
          {Array.from({ length: columns - 1 }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Matches DashboardStats' stat-tile shape. */
export function SkeletonStatCard() {
  return (
    <div className="rounded-card bg-ink-card p-4 shadow-card sm:p-5">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="mt-3 h-6 w-1/2" />
    </div>
  );
}

/** Matches ProductsTable/PosMenu's image-card shape. */
export function SkeletonProductCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-line bg-ink-soft">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
