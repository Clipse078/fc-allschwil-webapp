import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageBreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

/**
 * PageBreadcrumbs
 *
 * Renders a horizontal, accessible breadcrumb trail above the page header.
 * The last item is treated as the current page and rendered without a link.
 *
 * Usage:
 *   <PageBreadcrumbs
 *     items={[
 *       { label: "Dashboard", href: "/dashboard" },
 *       { label: "Teams", href: "/dashboard/teams" },
 *       { label: "FC Musterhausen 1" },
 *     ]}
 *   />
 */
export function PageBreadcrumbs({ items, className }: PageBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("mb-4 flex min-w-0 items-center gap-1", className)}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]"
                  aria-hidden="true"
                />
              )}
              {isLast || !item.href ? (
                <span
                  className={cn(
                    "truncate text-xs font-medium",
                    isLast
                      ? "text-[var(--foreground)]"
                      : "text-[var(--text-2)]",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="truncate text-xs font-medium text-[var(--text-2)] transition-colors hover:text-[var(--tenant-primary)]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
