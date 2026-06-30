import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type LoadingSkeletonVariant = "card" | "table" | "list" | "form" | "page";

export type LoadingSkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Layout preset that shapes the skeleton. @default "card" */
  variant?: LoadingSkeletonVariant;
  /** Number of repeated rows (used by table/list/form variants). @default 3 */
  rows?: number;
};

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--surface-2)]",
        className,
      )}
      aria-hidden="true"
    />
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <Bone className="h-4 w-32" />
        <Bone className="h-7 w-20" />
      </div>
      <div className="mt-4 space-y-2.5">
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-5/6" />
        <Bone className="h-3 w-4/6" />
      </div>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 border-b border-[var(--border)] px-4 py-3">
        <Bone className="h-3 w-24" />
        <Bone className="h-3 w-32" />
        <Bone className="h-3 w-20" />
        <Bone className="ml-auto h-3 w-16" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3.5 last:border-b-0"
        >
          <Bone className="h-3 w-28" />
          <Bone className="h-3 w-36" />
          <Bone className="h-5 w-14 rounded-full" />
          <Bone className="ml-auto h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
        >
          <Bone className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3 w-32" />
            <Bone className="h-2.5 w-48" />
          </div>
          <Bone className="h-5 w-12 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-3 w-24" />
          <Bone className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <Bone className="h-5 w-48" />
        <Bone className="h-3.5 w-72" />
      </div>
      {/* Cards row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      {/* Table */}
      <TableSkeleton rows={4} />
    </div>
  );
}

/**
 * LoadingSkeleton
 *
 * Animated placeholder that matches the shape of the content being loaded.
 * Prevents layout shift and provides visual feedback during async operations.
 *
 * Variants: card | table | list | form | page
 *
 * Usage:
 *   <LoadingSkeleton variant="table" rows={5} />
 *   <LoadingSkeleton variant="form" rows={4} />
 *   <LoadingSkeleton variant="page" />
 */
export function LoadingSkeleton({
  variant = "card",
  rows = 3,
  className,
  ...props
}: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Wird geladen…"
      className={cn(className)}
      {...props}
    >
      {variant === "card"  && <CardSkeleton />}
      {variant === "table" && <TableSkeleton rows={rows} />}
      {variant === "list"  && <ListSkeleton rows={rows} />}
      {variant === "form"  && <FormSkeleton rows={rows} />}
      {variant === "page"  && <PageSkeleton />}
      <span className="sr-only">Wird geladen…</span>
    </div>
  );
}
