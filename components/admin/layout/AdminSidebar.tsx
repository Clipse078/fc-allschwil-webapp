"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
import PlatformBrandMark from "@/components/shared/PlatformBrandMark";
import { getVisibleAdminNav } from "@/lib/permissions/get-visible-admin-nav";
import type { PermissionKey } from "@/lib/permissions/permissions";

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
    case "Dashboard":
      return LayoutDashboard;
    case "Vereinsleitung":
      return Briefcase;
    case "Meetings":
      return ScrollText;
    case "Initiativen":
      return Flag;
    case "KPIs":
      return BarChart3;
    case "Ziele":
      return Target;
    case "Vorlagen":
      return FileText;
    case "Saisons":
      return CalendarRange;
    case "Saisonplanner":
      return ClipboardList;
    case "Wochenplanner":
      return CalendarDays;
    case "Tagesplanner":
      return CalendarDays;
    case "Teams":
      return Users;
    case "Events":
      return CalendarDays;
    case "Personen":
      return UserCircle2;
    case "Spieler":
      return UserRound;
    case "Trainer":
      return BadgeIcon;
    case "Organisation":
      return Building2;
    case "Benutzer":
      return Shield;
    default:
      return LayoutDashboard;
  }
}

function isVereinsleitungChild(label: string) {
  return label === "Meetings" || label === "Initiativen" || label === "KPIs" || label === "Ziele" || label === "Vorlagen";
}

function isPlannerChild(label: string) {
  return label === "Wochenplanner" || label === "Tagesplanner";
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

  const resolvedCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((current) => !current);

  const mainItems = navItems.filter(
    (item) => !isVereinsleitungChild(item.label) && !isPlannerChild(item.label),
  );
  const vereinsleitungChildren = navItems.filter((item) =>
    isVereinsleitungChild(item.label),
  );
  const plannerChildren = navItems.filter((item) => isPlannerChild(item.label));

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) {
      return baseHref;
    }

    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
  }

  return (
    <aside
      className={`${resolvedCollapsed ? "w-[96px]" : "w-[310px]"} sce-sidebar flex min-h-screen shrink-0 flex-col transition-[width] duration-200`}
    >
      <div className={resolvedCollapsed ? "px-4 py-5" : "px-5 py-5"}>
        <div className="flex items-start justify-between gap-3">
          <div
            className={
              resolvedCollapsed
                ? "flex w-full justify-center"
                : "flex min-w-0 items-center gap-3"
            }
          >
            <PlatformBrandMark size={resolvedCollapsed ? "sm" : "md"} />

            {!resolvedCollapsed ? (
              <div className="min-w-0">
                <p className="sce-eyebrow">SportClubEvo</p>
                <h2 className="mt-1 font-[var(--font-display)] text-[1.7rem] font-bold uppercase leading-[0.92] tracking-[-0.04em] text-[var(--sce-heading)]">
                  Operations
                </h2>
                <div className="mt-2">
                  <span className="sce-tenant-chip">Workspace: FC Allschwil</span>
                </div>
              </div>
            ) : null}
          </div>

          {!resolvedCollapsed ? (
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Menü einklappen"
              className="sce-sidebar-control mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {resolvedCollapsed ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Menü erweitern"
              className="sce-sidebar-control flex h-9 w-9 items-center justify-center rounded-full transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <nav className={resolvedCollapsed ? "flex-1 px-3 py-3" : "flex-1 px-4 py-3"}>
        <ul className="space-y-2">
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
                  title={resolvedCollapsed ? item.label : undefined}
                  className={
                    isActive
                      ? resolvedCollapsed
                        ? "sce-sidebar-link-active flex h-12 items-center justify-center rounded-[20px]"
                        : "sce-sidebar-link-active flex items-center gap-3 rounded-[20px] px-4 py-3.5 text-sm font-semibold"
                      : resolvedCollapsed
                        ? "sce-sidebar-link flex h-12 items-center justify-center rounded-[20px] transition"
                        : "sce-sidebar-link flex items-center gap-3 rounded-[20px] px-4 py-3.5 text-sm font-medium transition"
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!resolvedCollapsed ? <span>{item.label}</span> : null}
                </Link>

                {!resolvedCollapsed && item.label === "Vereinsleitung" ? (
                  <ul className="mt-2 space-y-2 pl-7">
                    {vereinsleitungChildren.map((child) => {
                      const ChildIcon = getNavIcon(child.label);
                      const childActive =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);

                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={
                              childActive
                                ? "sce-sidebar-link-child-active flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-semibold"
                                : "sce-sidebar-link flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium transition"
                            }
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {!resolvedCollapsed && item.label === "Saisonplanner" ? (
                  <ul className="mt-2 space-y-2 pl-7">
                    {plannerChildren.map((child) => {
                      const ChildIcon = getNavIcon(child.label);
                      const childHref = buildHref(child.href);
                      const childActive =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);

                      return (
                        <li key={child.href}>
                          <Link
                            href={childHref}
                            className={
                              childActive
                                ? "sce-sidebar-link-child-active flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-semibold"
                                : "sce-sidebar-link flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium transition"
                            }
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={
          resolvedCollapsed
            ? "border-t border-[var(--sce-border)] px-3 py-4"
            : "border-t border-[var(--sce-border)] px-5 py-5"
        }
      >
        {!resolvedCollapsed ? (
          <div className="mb-4 rounded-[24px] border border-[var(--sce-border)] bg-[var(--sce-surface-muted)] p-4 shadow-sm">
            <p className="text-sm font-semibold text-[var(--sce-heading)]">
              {firstName} {lastName}
            </p>
            <p className="mt-1 truncate text-xs text-[var(--sce-muted)]">{email}</p>
          </div>
        ) : null}

        <SignOutButton collapsed={resolvedCollapsed} />
      </div>
    </aside>
  );
}
