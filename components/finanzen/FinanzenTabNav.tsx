"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  {
    label: "Übersicht",
    href: "/vereinsleitung/finanzen",
    icon: BarChart3,
    exact: true,
  },
  {
    label: "Rechnungen",
    href: "/vereinsleitung/finanzen/rechnungen",
    icon: FileText,
    exact: false,
  },
] as const;

export function FinanzenTabNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-100",
              isActive
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--text-2)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
