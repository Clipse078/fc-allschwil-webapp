"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BadgeIcon,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Flag,
  LayoutDashboard,
  ScrollText,
  Settings2,
  Shield,
  Target,
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react";
import SignOutButton from "@/components/admin/layout/SignOutButton";
import TenantLogo from "@/components/admin/branding/TenantLogo";
import { getVisibleNavSections } from "@/lib/nav/nav-config";
import type { NavSection } from "@/lib/nav/nav-config";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { cn } from "@/lib/cn";

type AdminSidebarProps = {
  firstName: string;
  lastName: string;
  email: string;
  permissionKeys: string[];
  /** Tenant display name. Falls back to "SportClubEvo" when not provided. */
  clubName?: string;
  /** Raw logoUrl from tenant config. Null/invalid → fallback icon. */
  logoUrl?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
};

function getNavIcon(label: string) {
  switch (label) {
    case "Dashboard":       return LayoutDashboard;
    case "Admin":           return Settings2;
    case "Vereinsleitung":  return Briefcase;
    case "Meetings":        return ScrollText;
    case "Initiativen":     return Flag;
    case "KPIs":            return BarChart3;
    case "Ziele":           return Target;
    case "Vorlagen":        return FileText;
    case "Saisons":         return CalendarRange;
    case "Saisonplanner":   return ClipboardList;
    case "Wochenplanner":   return CalendarDays;
    case "Tagesplanner":    return CalendarDays;
    case "Teams":           return Users;
    case "Events":          return CalendarDays;
    case "Personen":        return UserCircle2;
    case "Spieler":         return UserRound;
    case "Trainer":         return BadgeIcon;
    case "Organisation":    return Building2;
    case "Zielgruppen":     return Target;
    case "Benutzer":        return Shield;
    default:                return LayoutDashboard;
  }
}

const SEASON_CARRY_PREFIXES = [
  "/dashboard",
  "/dashboard/seasons",
  "/dashboard/planner",
  "/dashboard/teams",
  "/dashboard/events",
];

function shouldCarrySeason(href: string) {
  return SEASON_CARRY_PREFIXES.some((prefix) => href === prefix || href.startsWith(prefix + "/") || href.startsWith(prefix + "?"));
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function AdminSidebar({
  firstName,
  lastName,
  email,
  permissionKeys,
  clubName,
  logoUrl,
  collapsed,
  onToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");

  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((c) => !c);

  const sections: NavSection[] = getVisibleNavSections(
    permissionKeys as PermissionKey[],
  );

  const displayClubName = clubName ?? "SportClubEvo";

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) return baseHref;
    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
  }

  function isItemActive(href: string): boolean {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  }

  return (
    <aside
      className={cn(
        "sce-sidebar flex-shrink-0",
        isCollapsed && "collapsed",
      )}
    >
      {/* Brand header */}
      <div className="sce-sidebar-brand">
        {/* Tenant logo — falls back to platform Trophy icon when no logoUrl configured */}
        <TenantLogo
          logoUrl={logoUrl}
          size={isCollapsed ? 28 : 32}
          alt={clubName ? `${clubName} logo` : "Club logo"}
        />

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              SportClubEvo
            </p>
            <p className="truncate text-[0.9rem] font-700 leading-tight tracking-tight text-[var(--tenant-primary)] font-bold">
              {displayClubName}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleToggle}
          aria-label={isCollapsed ? "Menü erweitern" : "Menü einklappen"}
          className="sce-icon-button shrink-0 ml-auto"
        >
          {isCollapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {sections.map((section, sectionIdx) => (
          <div key={section.sectionLabel ?? "__top__"}>
            {/* Section divider */}
            {section.sectionLabel && !isCollapsed && (
              <p
                className={cn(
                  "px-2 pb-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]",
                  sectionIdx > 0 && "mt-4",
                )}
              >
                {section.sectionLabel}
              </p>
            )}
            {section.sectionLabel && isCollapsed && sectionIdx > 0 && (
              <div className="my-2 mx-2 border-t border-[var(--border)]" />
            )}

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = getNavIcon(item.label);
                const resolvedHref = buildHref(item.href);
                const childActive = item.children?.some((c) => isItemActive(c.href)) ?? false;
                const isActive = isItemActive(item.href) || childActive;

                return (
                  <li key={item.key}>
                    <Link
                      href={resolvedHref}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "sce-nav-item",
                        isActive && "active",
                        isCollapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>

                    {/* Children (always expanded when sidebar is open) */}
                    {!isCollapsed && item.children && item.children.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.children.map((child) => {
                          const ChildIcon = getNavIcon(child.label);
                          const childHref = buildHref(child.href);
                          const isChildActive = isItemActive(child.href);
                          return (
                            <li key={child.key}>
                              <Link
                                href={childHref}
                                className={cn("sce-nav-child", isChildActive && "active")}
                              >
                                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                                <span>{child.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-2 py-3 space-y-2">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
              style={{ background: "var(--tenant-primary)" }}
              aria-hidden="true"
            >
              {getInitials(firstName, lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                {firstName} {lastName}
              </p>
              <p className="truncate text-[0.7rem] text-[var(--muted)]">{email}</p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="flex justify-center">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
              style={{ background: "var(--tenant-primary)" }}
              title={`${firstName} ${lastName}`}
            >
              {getInitials(firstName, lastName)}
            </div>
          </div>
        )}

        <SignOutButton collapsed={isCollapsed} />
      </div>
    </aside>
  );
}
