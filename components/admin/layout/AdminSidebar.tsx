"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
    case "Benutzer":
      return Shield;
    default:
      return LayoutDashboard;
  }
}

function isVereinsleitungChild(label: string) {
  return label === "Meetings" || label === "Initiativen" || label === "KPIs";
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
                  ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50"
                  : "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50"
              }
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" />
                <path
                  d="M8 12h8M12 8l4 4-4 4"
                  stroke="#16a34a"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {!resolvedCollapsed ? (
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-green-600">
                  Platform
                </p>
                <h2 className="mt-0.5 font-[var(--font-display)] text-[1.35rem] font-bold uppercase leading-[0.92] tracking-[-0.03em] text-slate-900">
                  SportClubEvo
                </h2>
              </div>
            ) : null}
          </div>

          {!resolvedCollapsed ? (
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Menü einklappen"
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
              aria-label="Menü erweitern"
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
                        ? "flex h-12 items-center justify-center rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-[#0b4aa2] shadow-sm"
                        : "flex items-center gap-3 rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3.5 text-sm font-semibold text-[#0b4aa2] shadow-sm"
                      : resolvedCollapsed
                        ? "flex h-12 items-center justify-center rounded-[20px] text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                        : "flex items-center gap-3 rounded-[20px] px-4 py-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
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
                                ? "flex items-center gap-3 rounded-[16px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-[#0b4aa2]"
                                : "flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
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
                                ? "flex items-center gap-3 rounded-[16px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-[#0b4aa2]"
                                : "flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
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
