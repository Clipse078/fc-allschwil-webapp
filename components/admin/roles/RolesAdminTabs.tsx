"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "roles", label: "Rollen", href: "/dashboard/administration/roles" },
  {
    key: "assignments",
    label: "Benutzerzuweisungen",
    href: "/dashboard/administration/roles/assignments",
  },
  {
    key: "effective-access",
    label: "Effektiver Zugriff",
    href: "/dashboard/administration/roles/effective-access",
  },
] as const;

/**
 * Tab navigation for the tenant Roles & Permissions module.
 * "Rollen" is active for both the overview and any role detail/creation
 * sub-route so the tab stays highlighted while drilling into a role.
 */
export default function RolesAdminTabs() {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label="Rollen & Berechtigungen"
      className="flex gap-1 border-b border-[var(--border)]"
    >
      {TABS.map((tab) => {
        const isActive =
          tab.key === "roles"
            ? pathname === tab.href || (!pathname.includes("/assignments") && !pathname.includes("/effective-access"))
            : pathname === tab.href || pathname.startsWith(tab.href + "/");

        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              isActive
                ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                : "border-transparent text-[var(--text-2)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
