import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
              ) : null}

              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  className="font-medium transition hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "font-semibold text-slate-800" : "font-medium"}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
