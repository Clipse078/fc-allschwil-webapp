"use client";

import Link from "next/link";
import { ChevronRight, FolderClosed } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BreadcrumbItem } from "@/lib/workspace/breadcrumbs";

type WorkspaceBreadcrumbsProps = {
  path: BreadcrumbItem[];
};

export function WorkspaceBreadcrumbs({ path }: WorkspaceBreadcrumbsProps) {
  const t = useTranslations("Workspace.breadcrumbs");

  const allItems: Array<{ id: string | null; name: string }> = [
    { id: null, name: t("rootLabel") },
    ...path,
  ];

  return (
    <nav
      aria-label="Workspace Pfad"
      className="flex min-w-0 items-center gap-1 overflow-hidden"
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-0.5">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isFirst = index === 0;

          return (
            <li key={item.id ?? "root"} className="flex items-center gap-0.5">
              {isFirst ? (
                <FolderClosed
                  className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]"
                  aria-hidden="true"
                />
              )}

              {isLast || item.id === null ? (
                <span
                  className={`max-w-32 truncate text-xs font-medium ${
                    isLast ? "text-[var(--text)]" : "text-[var(--text-2)]"
                  }`}
                  aria-current={isLast ? "page" : undefined}
                  title={item.name}
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={`/dashboard/workspace?folder=${encodeURIComponent(item.id)}`}
                  className="max-w-32 truncate text-xs font-medium text-[var(--text-2)] transition-colors hover:text-[var(--blue)] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
                  title={item.name}
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
