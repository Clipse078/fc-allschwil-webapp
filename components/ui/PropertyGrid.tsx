import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type PropertyItem = {
  /** Field label (e.g. "Kategorie", "Status"). */
  label: string;
  /** Field value — any ReactNode. Falsy/empty shows `emptyText`. */
  value?: ReactNode;
  /** Optional icon rendered left of the value. */
  icon?: ReactNode;
  /** When provided, wraps the value in a Next.js Link. */
  href?: string;
  /** Fallback text when value is empty. Defaults to "—". */
  emptyText?: string;
};

type PropertyGridProps = {
  items: PropertyItem[];
  /** Number of columns at sm+ breakpoint. Defaults to 2. */
  columns?: 1 | 2 | 3;
  className?: string;
};

/**
 * PropertyGrid
 *
 * SportClubEvo Design System primitive.
 * Responsive grid of label/value pairs — the canonical replacement for the
 * legacy `sce-data-field` / `sce-data-label` / `sce-data-value` pattern.
 *
 * Usage:
 *   <PropertyGrid
 *     items={[
 *       { label: "Kategorie", value: "Aktive" },
 *       { label: "Status", value: "Aktiv", icon: <CheckCircle /> },
 *       { label: "Einheit", value: "FC Demo", href: "/dashboard/org-units/abc" },
 *       { label: "Geburtsdatum", value: null },
 *     ]}
 *     columns={2}
 *   />
 */
export function PropertyGrid({ items, columns = 2, className }: PropertyGridProps) {
  const colClass: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  const isEmpty = (v: ReactNode) =>
    v === null || v === undefined || v === "" || v === false;

  return (
    <dl className={cn("grid gap-x-8 gap-y-4", colClass[columns], className)}>
      {items.map((item, idx) => (
        <div key={idx} className="min-w-0">
          <dt className="text-xs font-medium text-[var(--muted)]">
            {item.label}
          </dt>
          <dd className="mt-1">
            {!isEmpty(item.value) ? (
              item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sce-primary)] hover:underline"
                >
                  {item.icon ? (
                    <span className="shrink-0 text-[var(--muted)]" aria-hidden>
                      {item.icon}
                    </span>
                  ) : null}
                  {item.value}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                  {item.icon ? (
                    <span className="shrink-0 text-[var(--muted)]" aria-hidden>
                      {item.icon}
                    </span>
                  ) : null}
                  {item.value}
                </span>
              )
            ) : (
              <span className="text-sm text-[var(--muted)]">
                {item.emptyText ?? "—"}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
