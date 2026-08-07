import { cn } from "@/lib/utils";

/**
 * Skeleton loaders matching the shape of the real content, so route
 * transitions and Suspense fallbacks never collapse the layout.
 */

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-glass-border bg-surface/40 p-5">
      <Shimmer className="h-4 w-24" />
      <Shimmer className="mt-4 h-8 w-32" />
      <Shimmer className="mt-3 h-3 w-full" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface/30 p-3"
        >
          <Shimmer className="size-9 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-3 w-1/3" />
            <Shimmer className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="space-y-4 rounded-2xl border border-glass-border bg-surface/30 p-5"
    >
      <Shimmer className="h-4 w-40" />
      <ListSkeleton rows={3} />
    </div>
  );
}
