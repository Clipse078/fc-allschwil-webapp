"use client";

import Image from "next/image";
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
  Shield,
  Target,
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react";
import SignOutButton from "@/components/admin/layout/SignOutButton";
import { getVisibleAdminNav } from "@/lib/permissions/get-visible-admin-nav";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { cn } from "@/lib/cn";

type AdminSidebarProps = {
  firstName: string;
  lastName: string;
  email: string;
  permissionKeys: string[];
  collapsed?: boolean;
  onToggle?: () => void;
};

function getNavIcon(label: string) {
  switch (label) {
    case "Dashboard":       return LayoutDashboard;
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
    case "Benutzer":        return Shield;
    default:                return LayoutDashboard;
  }
}

function isVereinsleitungChild(label: string) {
  return ["Meetings", "Initiativen", "KPIs", "Ziele", "Vorlagen"].includes(label);
}

function isPlannerChild(label: string) {
  return ["Wochenplanner", "Tagesplanner"].includes(label);
}

function shouldCarrySeason(href: string) {
  return (
    href === "/dashboard" ||
    href.startsWith("/dashboard/seasons") ||
    href.startsWith("/dashboard/planner") ||
    href.startsWith("/dashboard/teams") ||
    href.startsWith("/dashboard/events")
  );
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function AdminSidebar({
  firstName,
  lastName,
  email,
  permissionKeys,
  collapsed,
  onToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");
  const navItems = getVisibleAdminNav(permissionKeys as PermissionKey[]);

  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((c) => !c);

  const mainItems = navItems.filter(
    (item) => !isVereinsleitungChild(item.label) && !isPlannerChild(item.label),
  );
  const vereinsleitungChildren = navItems.filter((item) => isVereinsleitungChild(item.label));
  const plannerChildren = navItems.filter((item) => isPlannerChild(item.label));

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) return baseHref;
    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
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
        <div className="relative shrink-0" style={{ width: isCollapsed ? 28 : 32, height: isCollapsed ? 28 : 32 }}>
          <Image
            src="/images/logos/fc-allschwil.png"
            alt="FC Allschwil"
            fill
            className="object-contain"
            sizes="32px"
            priority
          />
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              SportClubEvo
            </p>
            <p className="truncate text-[0.9rem] font-700 leading-tight tracking-tight text-[var(--blue)] font-bold">
              FC Allschwil
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
        <ul className="space-y-0.5">
          {mainItems.map((item) => {
            const Icon = getNavIcon(item.label);
            const resolvedHref = buildHref(item.href);
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
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

                {/* Vereinsleitung children */}
                {!isCollapsed && item.label === "Vereinsleitung" && vereinsleitungChildren.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {vereinsleitungChildren.map((child) => {
                      const ChildIcon = getNavIcon(child.label);
                      const isChildActive =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
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

                {/* Planner children */}
                {!isCollapsed && item.label === "Saisonplanner" && plannerChildren.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {plannerChildren.map((child) => {
                      const ChildIcon = getNavIcon(child.label);
                      const childHref = buildHref(child.href);
                      const isChildActive =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <li key={child.href}>
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
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-2 py-3 space-y-2">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
              style={{ background: "var(--blue)" }}
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
              style={{ background: "var(--blue)" }}
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
