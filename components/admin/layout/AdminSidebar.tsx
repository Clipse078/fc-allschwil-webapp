"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BadgeIcon,
  BarChart3,
  Briefcase,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  LayoutDashboard,
  ScrollText,
  Shield,
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react";
import SignOutButton from "@/components/admin/layout/SignOutButton";
import { getVisibleAdminNav } from "@/lib/permissions/get-visible-admin-nav";
import type { PermissionKey } from "@/lib/permissions/permissions";
import {
  ACTIVE_TENANT_LOGO_SRC,
  ACTIVE_TENANT_NAME,
  PLATFORM_NAME,
} from "@/lib/platform/constants";

type AdminSidebarProps = {
  firstName: string;
  lastName: string;
  email: string;
  permissionKeys: string[];
  collapsed?: boolean;
  onToggle?: () => void;
};

/**
 * Icon mapping keyed by route href — decoupled from label strings
 * so nav labels can be translated without affecting icon resolution.
 */
const NAV_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/vereinsleitung": Briefcase,
  // /vereinsleitung/meetings kept for icon fallback only — nav item now points to /meetings
  "/vereinsleitung/meetings": ScrollText,
  "/meetings": ScrollText,           // canonical Meetings route
  "/vereinsleitung/initiativen": Flag,
  "/vereinsleitung/kpis": BarChart3,
  "/dashboard/seasons": CalendarRange,
  "/dashboard/planner": ClipboardList,
  "/dashboard/planner/week": CalendarDays,
  "/dashboard/planner/day": CalendarDays,
  "/dashboard/teams": Users,
  "/dashboard/events": CalendarDays,
  "/dashboard/persons": UserCircle2,
  "/dashboard/players": UserRound,
  "/dashboard/trainers": BadgeIcon,
  "/dashboard/users": Shield,
};

function getNavIcon(href: string): React.ComponentType<{ className?: string }> {
  return NAV_ICON_MAP[href] ?? LayoutDashboard;
}

// Meetings was removed from this set — it is now a standalone top-level nav item at /meetings.
// Only Initiativen and KPIs remain as Vereinsleitung sub-navigation items.
const VEREINSLEITUNG_CHILD_HREFS = new Set([
  "/vereinsleitung/initiativen",
  "/vereinsleitung/kpis",
]);

const PLANNER_CHILD_HREFS = new Set([
  "/dashboard/planner/week",
  "/dashboard/planner/day",
]);

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
  const t = useTranslations("nav");

  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const resolvedCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((current) => !current);

  const mainItems = navItems.filter(
    (item) =>
      !VEREINSLEITUNG_CHILD_HREFS.has(item.href) && !PLANNER_CHILD_HREFS.has(item.href),
  );
  const vereinsleitungChildren = navItems.filter((item) =>
    VEREINSLEITUNG_CHILD_HREFS.has(item.href),
  );
  const plannerChildren = navItems.filter((item) => PLANNER_CHILD_HREFS.has(item.href));

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) return baseHref;
    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
  }

  /** Resolve the display label: use translationKey if present, fall back to label. */
  function getItemLabel(item: { label: string; translationKey?: string }): string {
    if (item.translationKey) {
      try {
        return t(item.translationKey as Parameters<typeof t>[0]);
      } catch {
        return item.label;
      }
    }
    return item.label;
  }

  return (
    <aside
      className={`${resolvedCollapsed ? "w-[96px]" : "w-[310px]"} flex min-h-screen shrink-0 flex-col border-r border-slate-200 bg-white/92 backdrop-blur-xl transition-[width] duration-200`}
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
            <div
              className={
                resolvedCollapsed
                  ? "relative h-11 w-11 shrink-0"
                  : "relative h-12 w-12 shrink-0"
              }
            >
              <Image
                src={ACTIVE_TENANT_LOGO_SRC}
                alt={ACTIVE_TENANT_NAME}
                fill
                className="object-contain"
                sizes="48px"
                priority
              />
            </div>

            {!resolvedCollapsed ? (
              <div className="min-w-0">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {PLATFORM_NAME}
                </p>
                <p className="fca-eyebrow leading-tight">{ACTIVE_TENANT_NAME}</p>
                <h2 className="mt-0.5 font-[var(--font-display)] text-[1.45rem] font-bold uppercase leading-[0.92] tracking-[-0.04em] text-[#0b4aa2]">
                  Admin
                </h2>
              </div>
            ) : null}
          </div>

          {!resolvedCollapsed ? (
            <button
              type="button"
              onClick={handleToggle}
              aria-label={t("menuEinklappen")}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
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
              aria-label={t("menuErweitern")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <nav className={resolvedCollapsed ? "flex-1 px-3 py-3" : "flex-1 px-4 py-3"}>
        <ul className="space-y-2">
          {mainItems.map((item) => {
            const Icon = getNavIcon(item.href);
            const resolvedHref = buildHref(item.href);
            const displayLabel = getItemLabel(item);
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={resolvedHref}
                  title={resolvedCollapsed ? displayLabel : undefined}
                  className={
                    isActive
                      ? resolvedCollapsed
                        ? "flex h-12 items-center justify-center rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-[#0b4aa2] shadow-sm"
                        : "flex items-center gap-3 rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3.5 text-sm font-semibold text-[#0b4aa2] shadow-sm"
                      : resolvedCollapsed
                        ? "flex h-12 items-center justify-center rounded-[20px] text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                        : "flex items-center gap-3 rounded-[20px] px-4 py-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!resolvedCollapsed ? <span>{displayLabel}</span> : null}
                </Link>

                {!resolvedCollapsed && item.href === "/vereinsleitung" ? (
                  <ul className="mt-2 space-y-2 pl-7">
                    {vereinsleitungChildren.map((child) => {
                      const ChildIcon = getNavIcon(child.href);
                      const childLabel = getItemLabel(child);
                      const childActive =
                        pathname === child.href ||
                        pathname.startsWith(`${child.href}/`);

                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={
                              childActive
                                ? "flex items-center gap-3 rounded-[16px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-[#0b4aa2]"
                                : "flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                            }
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span>{childLabel}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {!resolvedCollapsed && item.href === "/dashboard/planner" ? (
                  <ul className="mt-2 space-y-2 pl-7">
                    {plannerChildren.map((child) => {
                      const ChildIcon = getNavIcon(child.href);
                      const childHref = buildHref(child.href);
                      const childLabel = getItemLabel(child);
                      const childActive =
                        pathname === child.href ||
                        pathname.startsWith(`${child.href}/`);

                      return (
                        <li key={child.href}>
                          <Link
                            href={childHref}
                            className={
                              childActive
                                ? "flex items-center gap-3 rounded-[16px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-[#0b4aa2]"
                                : "flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                            }
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span>{childLabel}</span>
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
            ? "border-t border-slate-200 px-3 py-4"
            : "border-t border-slate-200 px-5 py-5"
        }
      >
        {!resolvedCollapsed ? (
          <div className="mb-4 rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              {firstName} {lastName}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">{email}</p>
          </div>
        ) : null}

        <SignOutButton collapsed={resolvedCollapsed} />
      </div>
    </aside>
  );
}
